<?php

namespace App\Services\Payroll;

use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeePayItem;
use App\Models\EmployeePayProfile;
use App\Models\EmployeeSalary;
use App\Models\PayComponent;
use App\Models\PayGroup;
use App\Models\PayrollAdjustment;
use App\Models\PayrollPolicy;
use App\Models\StatutoryRate;
use App\Models\TaxExchangeRate;
use App\Services\Attendance\MonthlyAttendance;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Works out one employee's pay for one pay period, in a fixed order (tax
 * needs gross, gross needs the deductions):
 *
 *   rates → base → earnings and attendance deductions → gross
 *         → NSSF and tax on salary → after-tax deductions → net
 *
 * A period is one pay group's (see PayGroup): it can cross months and be
 * shorter than one. A monthly salary pays the group's share of it per period
 * (all of it monthly, half twice a month, 12/52 weekly), split by days only
 * when someone joins, leaves, changes group or salary inside the period.
 * Tax and NSSF are monthly by law, so for now they are worked out only for
 * periods that are exactly one calendar month.
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
        private readonly PayGroupService $groups,
    ) {}

    /**
     * Everything that is the same for every employee in the period, loaded once.
     *
     * @return array<string, mixed>
     */
    public function context(Company $company, PayGroup $group, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $start = $start->startOfDay();
        $end = $end->startOfDay();
        $policy = $this->policyFor($this->setup->ensure($company), $group);
        // Tax rates and the exchange rate are monthly: the month the period ends in.
        $month = $end->format('Y-m');
        $official = TaxExchangeRate::query()->where('month', $month)->value('rate');
        $statutory = PayGroup::isCalendarMonth($start, $end);

        return [
            'company' => $company,
            'group' => $group,
            'default_group_id' => $this->setup->defaultGroup($company)->id,
            'month' => $month,
            'start' => $start,
            'end' => $end,
            'days_in_period' => (int) $start->diffInDays($end) + 1,
            'salary_share' => $group->salaryShare($start, $end),
            'salary_share_label' => $group->salaryShareLabel($start, $end),
            'policy' => $policy,
            'components' => $this->componentsFor($company, $group),
            'statutory' => $statutory,
            'tax' => $statutory ? StatutoryRate::inForce('tax_on_salary', $end->toDateString())?->params : null,
            'nssf' => $statutory ? StatutoryRate::inForce('nssf', $end->toDateString())?->params : null,
            'exchange_rate' => $official ?? $policy->fallback_exchange_rate,
            'exchange_rate_source' => $official ? 'official' : ($policy->fallback_exchange_rate ? 'company_fallback' : null),
        ];
    }

    /** The company's policy with the group's own settings on top (not saved). */
    public function policyFor(PayrollPolicy $policy, PayGroup $group): PayrollPolicy
    {
        $effective = $policy->replicate();

        foreach (PayGroup::POLICY_FIELDS as $field) {
            if ($group->{$field} !== null) {
                $effective->{$field} = $group->{$field};
            }
        }

        return $effective;
    }

    /**
     * The company's components as this group uses them: a group can switch
     * one on or off and give a rule other params, without touching anyone else.
     *
     * @return Collection<int, PayComponent> active ones, in payslip order
     */
    public function componentsFor(Company $company, PayGroup $group): Collection
    {
        $rules = $group->component_rules ?? [];

        return PayComponent::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->orderBy('sort_order')->orderBy('id')->get()
            ->map(function (PayComponent $component) use ($rules) {
                $rule = $rules[$component->id] ?? $rules[(string) $component->id] ?? null;
                if ($rule === null) {
                    return $component;
                }
                if (array_key_exists('is_active', $rule)) {
                    $component->is_active = (bool) $rule['is_active'];
                }
                if (isset($rule['params']) && $component->method === 'template') {
                    $component->params = $rule['params'];
                }

                return $component;
            })
            ->filter(fn (PayComponent $component) => $component->is_active)
            ->values();
    }

    /**
     * The employees a period's payroll covers: everyone in the group and
     * employed for at least one day of it, regardless of the caller's branch
     * access (payroll is company-wide).
     *
     * @param  array<string, mixed>  $ctx  from context()
     * @return Collection<int, Employee>
     */
    public function employees(array $ctx): Collection
    {
        return Employee::query()->withoutGlobalScopes()
            ->where('company_id', $ctx['company']->id)
            ->where(fn ($q) => $q->whereNull('hire_date')->orWhereDate('hire_date', '<=', $ctx['end']->toDateString()))
            ->where(fn ($q) => $q->whereNotIn('employment_status', Employee::LEFT_STATUSES)
                ->orWhereDate('termination_date', '>=', $ctx['start']->toDateString()))
            ->with(['salaries', 'payProfile', 'payItems', 'payGroups'])
            ->inDisplayOrder()
            ->get()
            ->filter(fn (Employee $employee) => $this->memberSpan($ctx, $employee) !== null)
            ->values();
    }

    /**
     * The days of the period the employee is in this run's group.
     *
     * @param  array<string, mixed>  $ctx
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public function memberSpan(array $ctx, Employee $employee): ?array
    {
        return $this->groups->spanIn($employee, $ctx['group'], $ctx['start'], $ctx['end'], $ctx['default_group_id']);
    }

    /**
     * Attendance totals for each employee over their days in the group —
     * usually the whole period, fewer for someone who moved group in it.
     *
     * @param  array<string, mixed>  $ctx
     * @param  Collection<int, Employee>  $employees
     * @return Collection<int, array<string, mixed>> keyed by employee id
     */
    public function attendance(array $ctx, Collection $employees): Collection
    {
        $totals = collect();

        $employees
            ->groupBy(fn (Employee $employee) => implode('|', array_map(fn ($d) => $d->toDateString(), $this->memberSpan($ctx, $employee) ?? [$ctx['start'], $ctx['end']])))
            ->each(function (Collection $group, string $span) use ($ctx, $totals) {
                [$start, $end] = array_map(fn ($d) => CarbonImmutable::parse($d), explode('|', $span));

                MonthlyAttendance::for($ctx['company'], $group->values(), $start, $end)
                    ->each(fn (array $row, int $id) => $totals->put($id, $row));
            });

        return $totals;
    }

    /**
     * @param  array<string, mixed>  $ctx  from context()
     * @param  array<string, mixed>  $attendance  this employee's attendance totals for the period
     * @param  Collection<int, PayrollAdjustment>  $adjustments  this employee's adjustments dated in the period
     * @return array<string, mixed> a payslip, or ['skipped' => reason]
     */
    public function calculate(array $ctx, Employee $employee, array $attendance, Collection $adjustments): array
    {
        $policy = $ctx['policy'];
        $member = $this->memberSpan($ctx, $employee) ?? [$ctx['start'], $ctx['end']];
        [$from, $to] = $this->employedSpan($employee, $member);
        $segments = $this->segments($employee, $from, $to);
        // Adjustments dated while they were in another group belong to that group's run.
        $adjustments = $adjustments->filter(fn (PayrollAdjustment $a) => $a->date->toDateString() >= $member[0]->toDateString()
            && $a->date->toDateString() <= $member[1]->toDateString());

        if ($segments->isEmpty()) {
            return ['skipped' => 'no_salary'];
        }

        $current = $segments->last()['salary'];
        $currency = $current->currency;
        $payType = $current->pay_type;
        $mixedCurrency = $segments->pluck('salary.currency')->unique()->count() > 1;
        $warnings = [];

        // ── Rates ── (calendar and scheduled: the period's salary over the period's days)
        $basis = match ($policy->rate_basis) {
            'calendar' => $ctx['days_in_period'] / $ctx['salary_share'],
            'scheduled' => max(1, $attendance['planned']['work']) / $ctx['salary_share'],
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
            'enforce_overtime_minimums' => (bool) ($policy->enforce_overtime_minimums ?? true),
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
            $warnings[] = $this->warning('deductions_exceed_pay', 'Deductions are larger than the pay for the period. Check the attendance and the rules.', true);
            $gross = 0.0;
        }
        $taxable = max(0.0, $sum(fn ($l) => $l['kind'] === 'earning' && $l['taxable']) - $deductions);
        $insurable = max(0.0, $sum(fn ($l) => $l['kind'] === 'earning' && $l['nssf_insurable']) - $deductions);

        // ── NSSF and tax ── (monthly by law: only for a period that is one calendar month, for now)
        $rate = $currency === 'KHR' ? 1.0 : (float) $ctx['exchange_rate'];
        $statutory = ['nssf_employee' => 0.0, 'employer' => [], 'tax' => 0.0, 'lines' => []];
        if (! $ctx['statutory']) {
            // Not worked out; the run says so once for everyone.
        } elseif ($rate <= 0) {
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
            $warnings[] = $this->warning('mixed_currency', "The salary changed currency in this period; the whole period is paid in {$currency} at the current salary.", false);
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
                'period' => ['start' => $ctx['start']->toDateString(), 'end' => $ctx['end']->toDateString(), 'days' => $ctx['days_in_period'], 'salary_share' => $ctx['salary_share']],
                'employed' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                // Gross split over the calendar months the paid days fall in, by day, for monthly reports and (later) tax.
                'months' => $this->monthSplit($from, $to, $gross, $currency),
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
        $days = $ctx['days_in_period'];

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

        $share = $ctx['salary_share'];
        $shareWords = $ctx['salary_share_label'] ? ' × '.$ctx['salary_share_label'] : '';
        $whole = $segments->count() === 1 && $segments->first()['days'] === $days;
        $amount = $segments->sum(fn ($s) => (float) $s['salary']->amount * $share * $s['days'] / $days);

        return [
            'amount' => Money::round($amount, $currency),
            'explanation' => match (true) {
                $whole && $shareWords === '' => 'Full month',
                $whole => Money::format((float) $segments->first()['salary']->amount, $currency).$shareWords,
                default => $segments->map(fn ($s) => Money::format((float) $s['salary']->amount, $currency)."{$shareWords} × {$s['days']}/{$days} days")->join(' + '),
            },
            'details' => [
                'segments' => $segments->map(fn ($s) => ['amount' => (float) $s['salary']->amount, 'days' => $s['days']])->values()->all(),
                'days_in_period' => $days,
                'salary_share' => $share,
            ],
        ];
    }

    /** Recurring items are monthly amounts: a period pays the group's share of them, like the salary. */
    private function itemLine(array $ctx, Employee $employee, PayComponent $component, string $currency): ?array
    {
        $items = $employee->payItems->filter(fn (EmployeePayItem $item) => $item->pay_component_id === $component->id
            && $item->effective_from->toDateString() <= $ctx['end']->toDateString()
            && ($item->effective_to === null || $item->effective_to->toDateString() >= $ctx['start']->toDateString()));

        if ($items->isEmpty()) {
            return null;
        }

        $monthly = (float) $items->sum('amount');
        $label = $ctx['salary_share_label'];

        return [
            'amount' => Money::round($monthly * $ctx['salary_share'], $currency),
            'explanation' => $label
                ? Money::format($monthly, $currency)." a month × {$label}"
                : ($items->count() === 1 ? ($items->first()->note ?: 'Monthly amount') : $items->count().' items'),
            'details' => ['items' => $items->map(fn ($i) => ['id' => $i->id, 'amount' => (float) $i->amount])->values()->all(), 'salary_share' => $ctx['salary_share']],
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

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}  $member  their days in the group
     * @return array{0: CarbonImmutable, 1: CarbonImmutable} the days of the period this person was employed and in the group
     */
    private function employedSpan(Employee $employee, array $member): array
    {
        [$from, $to] = $member;

        if ($employee->hire_date && $employee->hire_date->toDateString() > $from->toDateString()) {
            $from = CarbonImmutable::parse($employee->hire_date->toDateString());
        }
        if ($employee->termination_date && $employee->hasLeft() && $employee->termination_date->toDateString() < $to->toDateString()) {
            $to = CarbonImmutable::parse($employee->termination_date->toDateString());
        }

        return [$from, $to];
    }

    /**
     * Gross shared out over the calendar months of [$from, $to] by day; the
     * last month takes the rounding so the parts add up to gross exactly.
     *
     * @return array<int, array{month: string, days: int, gross: float}>
     */
    private function monthSplit(CarbonImmutable $from, CarbonImmutable $to, float $gross, string $currency): array
    {
        if ($from->gt($to)) {
            return [];
        }

        $months = PayGroup::monthsIn($from, $to);
        $total = array_sum(array_column($months, 'days'));
        $left = Money::round($gross, $currency);

        return array_map(function (array $m, int $i) use ($months, $total, $gross, $currency, &$left) {
            $part = $i === count($months) - 1 ? $left : Money::round($gross * $m['days'] / $total, $currency);
            $left = Money::round($left - $part, $currency);

            return ['month' => $m['month'], 'days' => $m['days'], 'gross' => $part];
        }, $months, array_keys($months));
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
