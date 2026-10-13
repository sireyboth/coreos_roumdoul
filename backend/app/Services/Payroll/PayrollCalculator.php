<?php

namespace App\Services\Payroll;

use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeePayItem;
use App\Models\EmployeePayProfile;
use App\Models\EmployeeSalary;
use App\Models\PayComponent;
use App\Models\PayrollAdjustment;
use App\Models\StatutoryRate;
use App\Models\TaxExchangeRate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Works out one employee's pay for one month, in a fixed order (tax needs
 * gross, gross needs the deductions):
 *
 *   rates → base → earnings and attendance deductions → gross
 *         → NSSF and tax on salary → after-tax deductions → net
 *
 * Pure: it reads, never writes. PayRunService saves the result; the preview
 * endpoint shows it without saving. Every line carries the words and the
 * rule that produced it, so a payslip can always be explained.
 */
class PayrollCalculator
{
    public function __construct(
        private readonly PayTemplates $templates,
        private readonly StatutoryCalculator $statutory,
        private readonly PayrollSetup $setup,
    ) {}

    /**
     * Everything that is the same for every employee in the month, loaded once.
     *
     * @return array<string, mixed>
     */
    public function context(Company $company, string $month): array
    {
        $policy = $this->setup->ensure($company);
        $start = CarbonImmutable::parse("{$month}-01");
        $end = $start->endOfMonth()->startOfDay();
        $official = TaxExchangeRate::query()->where('month', $month)->value('rate');

        return [
            'company' => $company,
            'month' => $month,
            'start' => $start,
            'end' => $end,
            'days_in_month' => $start->daysInMonth,
            'policy' => $policy,
            'components' => PayComponent::query()->withoutGlobalScopes()
                ->where('company_id', $company->id)->where('is_active', true)
                ->orderBy('sort_order')->orderBy('id')->get(),
            'tax' => StatutoryRate::inForce('tax_on_salary', $end->toDateString())?->params,
            'nssf' => StatutoryRate::inForce('nssf', $end->toDateString())?->params,
            'exchange_rate' => $official ?? $policy->fallback_exchange_rate,
            'exchange_rate_source' => $official ? 'official' : ($policy->fallback_exchange_rate ? 'company_fallback' : null),
        ];
    }

    /**
     * The employees a month's payroll covers: everyone employed for at least
     * one day of it, regardless of the caller's branch access (payroll is company-wide).
     *
     * @return Collection<int, Employee>
     */
    public function employees(Company $company, string $month): Collection
    {
        $start = CarbonImmutable::parse("{$month}-01");
        $end = $start->endOfMonth();

        return Employee::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where(fn ($q) => $q->whereNull('hire_date')->orWhereDate('hire_date', '<=', $end->toDateString()))
            ->where(fn ($q) => $q->whereNotIn('employment_status', Employee::LEFT_STATUSES)
                ->orWhereDate('termination_date', '>=', $start->toDateString()))
            ->with(['salaries', 'payProfile', 'payItems'])
            ->inDisplayOrder()
            ->get();
    }

    /**
     * @param  array<string, mixed>  $ctx  from context()
     * @param  array<string, mixed>  $attendance  this employee's MonthlyAttendance totals
     * @param  Collection<int, PayrollAdjustment>  $adjustments  this employee's adjustments for the month
     * @return array<string, mixed> a payslip, or ['skipped' => reason]
     */
    public function calculate(array $ctx, Employee $employee, array $attendance, Collection $adjustments): array
    {
        $policy = $ctx['policy'];
        [$from, $to] = $this->employedSpan($ctx, $employee);
        $segments = $this->segments($employee, $from, $to);

        if ($segments->isEmpty()) {
            return ['skipped' => 'no_salary'];
        }

        $current = $segments->last()['salary'];
        $currency = $current->currency;
        $payType = $current->pay_type;
        $mixedCurrency = $segments->pluck('salary.currency')->unique()->count() > 1;
        $warnings = [];

        // ── Rates ──
        $basis = match ($policy->rate_basis) {
            'calendar' => $ctx['days_in_month'],
            'scheduled' => max(1, $attendance['planned']['work']),
            default => max(1, $policy->rate_basis_days),
        };
        $dailyRate = $payType === 'monthly' ? (float) $current->amount / $basis : (float) $current->amount;
        $hourlyRate = $dailyRate / max(0.5, $policy->hours_per_day);
        $minuteRate = $hourlyRate / 60;

        // Days with a missing scan, by the company's policy.
        $missing = (int) $attendance['incomplete_days'];
        if ($missing > 0 && $policy->missing_scan_policy === 'review') {
            $warnings[] = $this->warning('missing_scans', "{$missing} ".($missing === 1 ? 'day has' : 'days have').' a missing scan. Fix them in Attendance, or change the missing-scan setting.', true);
        }
        $countMissingAsAbsent = $policy->missing_scan_policy === 'absent' ? $missing : 0;

        $vars = [
            'pay_type' => $payType,
            'daily_rate' => $dailyRate,
            'hourly_rate' => $hourlyRate,
            'minute_rate' => $minuteRate,
            'absent_days' => (float) $attendance['absent_days'] + $countMissingAsAbsent,
            'unpaid_leave_days' => (float) $attendance['leave']['unpaid_share'],
            'late_count' => count($attendance['late_by_day']),
            'late_by_day' => $attendance['late_by_day'],
            'early_leave_by_day' => $attendance['early_leave_by_day'],
            'unpaid_excused_minutes' => (int) $attendance['excused']['unpaid'],
            'ot_workday_hours' => round($attendance['overtime_workday_minutes'] / 60, 2),
            'ot_day_off_hours' => round($attendance['overtime_day_off_minutes'] / 60, 2),
            'ot_holiday_hours' => round($attendance['overtime_holiday_minutes'] / 60, 2),
        ];

        // ── Lines ──
        $lines = [];
        foreach ($ctx['components'] as $component) {
            $line = match ($component->method) {
                'base' => $this->baseLine($ctx, $segments, $payType, $dailyRate, $attendance, $countMissingAsAbsent, $currency, $mixedCurrency, $from, $to),
                'employee_item' => $this->itemLine($ctx, $employee, $component, $currency),
                'template' => $this->templateLine($component, $vars, $currency),
                default => null,
            };

            if ($line !== null && $line['amount'] > 0) {
                $lines[] = [
                    'pay_component_id' => $component->id, 'code' => $component->code, 'name' => $component->name, 'kind' => $component->kind,
                    'taxable' => $component->taxable, 'nssf_insurable' => $component->nssf_insurable, 'order' => $component->sort_order,
                    ...$line,
                ];
            }
        }

        foreach ($adjustments as $adjustment) {
            $lines[] = [
                'pay_component_id' => null, 'code' => 'ADJUSTMENT', 'name' => $adjustment->name, 'kind' => $adjustment->kind,
                'taxable' => $adjustment->taxable, 'nssf_insurable' => $adjustment->taxable, 'order' => 900,
                'amount' => Money::round((float) $adjustment->amount, $currency),
                'explanation' => $adjustment->reason ?: 'Adjustment',
                'details' => ['adjustment_id' => $adjustment->id, 'source' => $adjustment->source],
            ];
        }

        // ── Gross ──
        $sum = fn (callable $filter) => array_sum(array_map(fn ($l) => $l['amount'], array_filter($lines, $filter)));
        $deductions = $sum(fn ($l) => $l['kind'] === 'deduction');
        $gross = $sum(fn ($l) => $l['kind'] === 'earning') - $deductions;
        if ($gross < 0) {
            $warnings[] = $this->warning('deductions_exceed_pay', 'Deductions are larger than the pay for the month. Check the attendance and the rules.', true);
            $gross = 0.0;
        }
        $taxable = max(0.0, $sum(fn ($l) => $l['kind'] === 'earning' && $l['taxable']) - $deductions);
        $insurable = max(0.0, $sum(fn ($l) => $l['kind'] === 'earning' && $l['nssf_insurable']) - $deductions);

        // ── NSSF and tax ──
        $rate = $currency === 'KHR' ? 1.0 : (float) $ctx['exchange_rate'];
        $statutory = ['nssf_employee' => 0.0, 'employer' => [], 'tax' => 0.0, 'lines' => []];
        if ($rate <= 0) {
            $warnings[] = $this->warning('no_exchange_rate', "There is no tax exchange rate for {$ctx['month']} yet, so tax and NSSF can't be worked out. Set a fallback rate in payroll settings.", true);
        } else {
            if (! $ctx['tax']) {
                $warnings[] = $this->warning('no_tax_rates', 'Tax on salary rates are not set up on the platform.', true);
            }
            $statutory = $this->statutory->calculate($currency, $rate, $insurable, $taxable, $this->profile($employee), $ctx['nssf'], $ctx['tax']);
        }

        // ── Net ──
        $netDeductions = $sum(fn ($l) => $l['kind'] === 'net_deduction');
        $net = $gross - $statutory['nssf_employee'] - $statutory['tax'] - $netDeductions;
        if ($currency === 'KHR' && $policy->khr_rounding > 1) {
            $net = round($net / $policy->khr_rounding) * $policy->khr_rounding;
        }
        $net = Money::round($net, $currency);
        if ($net < 0) {
            $warnings[] = $this->warning('negative_net', 'Net pay is below zero.', true);
        }

        if ($attendance['overtime_pending_minutes'] > 0) {
            $warnings[] = $this->warning('pending_overtime', Money::quantity($attendance['overtime_pending_minutes'] / 60).' h of overtime is still waiting for approval and is not paid.', false);
        }
        if ($mixedCurrency) {
            $warnings[] = $this->warning('mixed_currency', "The salary changed currency this month; the whole month is paid in {$currency} at the current salary.", false);
        }

        return [
            'employee_id' => $employee->id,
            'currency' => $currency,
            'pay_type' => $payType,
            'base_salary' => (float) $current->amount,
            'daily_rate' => round($dailyRate, 4),
            'hourly_rate' => round($hourlyRate, 4),
            'exchange_rate' => $currency === 'KHR' ? null : ($rate > 0 ? $rate : null),
            'gross' => Money::round($gross, $currency),
            'nssf_employee' => Money::round($statutory['nssf_employee'], $currency),
            'tax' => Money::round($statutory['tax'], $currency),
            'net' => $net,
            'employer_cost' => Money::round($gross + array_sum($statutory['employer']), $currency),
            'warnings' => $warnings,
            'inputs' => [
                'attendance' => collect($attendance)->except(['late_by_day', 'early_leave_by_day'])->all(),
                'variables' => collect($vars)->except(['late_by_day', 'early_leave_by_day'])->all(),
                'rate_basis' => ['method' => $policy->rate_basis, 'days' => $basis, 'hours_per_day' => $policy->hours_per_day],
                'missing_scan_policy' => $policy->missing_scan_policy,
                'employed' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'salaries' => $segments->map(fn ($s) => [
                    'amount' => (float) $s['salary']->amount, 'currency' => $s['salary']->currency, 'pay_type' => $s['salary']->pay_type,
                    'from' => $s['from']->toDateString(), 'to' => $s['to']->toDateString(),
                ])->values()->all(),
                'profile' => $this->profile($employee),
                'exchange_rate_source' => $currency === 'KHR' ? null : $ctx['exchange_rate_source'],
                'taxable' => Money::round($taxable, $currency),
                'insurable' => Money::round($insurable, $currency),
            ],
            'lines' => $this->ordered($lines, $statutory['lines']),
        ];
    }

    // ───────────────────────────── Lines ─────────────────────────────

    private function baseLine(array $ctx, Collection $segments, string $payType, float $dailyRate, array $attendance, int $missingAsAbsent, string $currency, bool $mixedCurrency, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $days = $ctx['days_in_month'];

        if ($payType === 'daily') {
            $policy = $ctx['policy'];
            $worked = max(0, $attendance['present_days'] - $missingAsAbsent);
            $holidays = $policy->daily_paid_holidays ? $attendance['planned']['holiday'] : 0;
            $paidLeave = (float) $attendance['leave']['paid_share'];
            $paidDays = $worked + $holidays + $paidLeave;

            return [
                'amount' => Money::round($paidDays * $dailyRate, $currency),
                'explanation' => collect([
                    "{$worked} worked",
                    $holidays > 0 ? "{$holidays} holiday".($holidays > 1 ? 's' : '') : null,
                    $paidLeave > 0 ? Money::quantity($paidLeave).' paid leave' : null,
                ])->filter()->join(' + ').' = '.Money::quantity($paidDays).' days × '.Money::rate($dailyRate, $currency),
                'details' => ['paid_days' => $paidDays, 'daily_rate' => $dailyRate],
            ];
        }

        if ($mixedCurrency) {
            $current = $segments->last();
            $employedDays = (int) round($from->diffInDays($to)) + 1;
            $segments = collect([['salary' => $current['salary'], 'from' => $from, 'to' => $to, 'days' => $employedDays]]);
        }

        $whole = $segments->count() === 1 && $segments->first()['days'] === $days;
        $amount = $segments->sum(fn ($s) => (float) $s['salary']->amount * $s['days'] / $days);

        return [
            'amount' => Money::round($amount, $currency),
            'explanation' => $whole
                ? 'Full month'
                : $segments->map(fn ($s) => Money::format((float) $s['salary']->amount, $currency)." × {$s['days']}/{$days} days")->join(' + '),
            'details' => ['segments' => $segments->map(fn ($s) => ['amount' => (float) $s['salary']->amount, 'days' => $s['days']])->values()->all(), 'days_in_month' => $days],
        ];
    }

    private function itemLine(array $ctx, Employee $employee, PayComponent $component, string $currency): ?array
    {
        $items = $employee->payItems->filter(fn (EmployeePayItem $item) => $item->pay_component_id === $component->id
            && $item->effective_from->toDateString() <= $ctx['end']->toDateString()
            && ($item->effective_to === null || $item->effective_to->toDateString() >= $ctx['start']->toDateString()));

        if ($items->isEmpty()) {
            return null;
        }

        return [
            'amount' => Money::round((float) $items->sum('amount'), $currency),
            'explanation' => $items->count() === 1 ? ($items->first()->note ?: 'Monthly amount') : $items->count().' items',
            'details' => ['items' => $items->map(fn ($i) => ['id' => $i->id, 'amount' => (float) $i->amount])->values()->all()],
        ];
    }

    private function templateLine(PayComponent $component, array $vars, string $currency): ?array
    {
        $result = $this->templates->run($component->template, $component->params ?? [], $vars, $currency);

        return $result === null ? null : [
            'amount' => $result['amount'],
            'explanation' => $result['explanation'],
            'details' => ['template' => $component->template, 'params' => $component->params, 'formula' => $result['formula'], 'variables' => $result['variables']],
        ];
    }

    /** Earnings, then deductions, NSSF and tax, after-tax deductions, and what the employer pays on top. */
    private function ordered(array $lines, array $statutory): array
    {
        $rank = ['earning' => 0, 'deduction' => 1, 'statutory' => 2, 'net_deduction' => 3, 'employer' => 4];
        $all = [...$lines, ...array_map(fn ($l) => [...$l, 'pay_component_id' => null, 'order' => 0], $statutory)];

        usort($all, fn ($a, $b) => [$rank[$a['kind']], $a['order']] <=> [$rank[$b['kind']], $b['order']]);

        return array_values(array_map(fn ($l, $i) => [
            'pay_component_id' => $l['pay_component_id'], 'code' => $l['code'], 'name' => $l['name'], 'kind' => $l['kind'],
            'amount' => $l['amount'], 'explanation' => $l['explanation'], 'details' => $l['details'] ?? null, 'sort_order' => $i + 1,
        ], $all, array_keys($all)));
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} the days of the month this person was employed */
    private function employedSpan(array $ctx, Employee $employee): array
    {
        $from = $ctx['start'];
        $to = $ctx['end'];

        if ($employee->hire_date && $employee->hire_date->toDateString() > $from->toDateString()) {
            $from = CarbonImmutable::parse($employee->hire_date->toDateString());
        }
        if ($employee->termination_date && $employee->hasLeft() && $employee->termination_date->toDateString() < $to->toDateString()) {
            $to = CarbonImmutable::parse($employee->termination_date->toDateString());
        }

        return [$from, $to];
    }

    /**
     * The salaries in force during [$from, $to], each clipped to that span.
     *
     * @return Collection<int, array{salary: EmployeeSalary, from: CarbonImmutable, to: CarbonImmutable, days: int}>
     */
    private function segments(Employee $employee, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        if ($from->gt($to)) {
            return collect();
        }

        return $employee->salaries
            ->filter(fn (EmployeeSalary $s) => $s->effective_from->toDateString() <= $to->toDateString()
                && ($s->effective_to === null || $s->effective_to->toDateString() >= $from->toDateString()))
            ->map(function (EmployeeSalary $s) use ($from, $to) {
                $start = CarbonImmutable::parse(max($from->toDateString(), $s->effective_from->toDateString()));
                $end = CarbonImmutable::parse($s->effective_to ? min($to->toDateString(), $s->effective_to->toDateString()) : $to->toDateString());

                return ['salary' => $s, 'from' => $start, 'to' => $end, 'days' => (int) round($start->diffInDays($end)) + 1];
            })
            ->values();
    }

    /** @return array<string, mixed> */
    private function profile(Employee $employee): array
    {
        $profile = $employee->payProfile;

        return $profile
            ? collect(EmployeePayProfile::DEFAULTS)->keys()->mapWithKeys(fn ($key) => [$key => $profile->{$key}])->all()
            : EmployeePayProfile::DEFAULTS;
    }

    private function warning(string $code, string $message, bool $blocking): array
    {
        return ['code' => $code, 'message' => $message, 'blocking' => $blocking];
    }
}
