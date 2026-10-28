<?php

namespace App\Services\Payroll;

use App\Models\AttendanceLock;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeePayGroup;
use App\Models\PayGroup;
use App\Models\PayrollAdjustment;
use App\Models\PayRun;
use App\Models\Payslip;
use App\Models\PayslipLine;
use App\Models\User;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\AuditLogger;
use App\Support\SelfApproval;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * One pay group's pay run for one period: draft → calculated → approved → paid.
 *
 * Calculating replaces every payslip, as often as needed; one person can be
 * recalculated alone after a fix. Approving needs the period to be over,
 * recalculates one last time, refuses while any payslip has a blocking
 * warning, then locks the attendance it used — for those people and those
 * days only. After that nothing changes: fixes go into a later period as
 * adjustments — or, for a mistake in the run itself, an approver reopens it.
 */
class PayRunService
{
    public function __construct(
        private readonly PayrollCalculator $calculator,
        private readonly AttendanceRecorder $recorder,
    ) {}

    /**
     * A run for the group's period starting on $start. Fixed schedules work
     * the end out themselves; a custom group needs $end.
     */
    public function create(Company $company, PayGroup $group, string $start, ?string $end, ?User $by): PayRun
    {
        [$start, $end] = $this->period($group, $start, $end);
        $today = $this->today($company);

        if ($start->toDateString() > $today) {
            throw ValidationException::withMessages(['period_start' => [__('Payroll can\'t be run for a period that hasn\'t started.')]]);
        }

        $overlap = PayRun::query()->withoutGlobalScopes()->where('pay_group_id', $group->id)
            ->whereDate('period_start', '<=', $end->toDateString())->whereDate('period_end', '>=', $start->toDateString())
            ->first();
        if ($overlap) {
            throw ValidationException::withMessages(['period_start' => [
                __(':group already has a pay run for :period.', ['group' => $group->name, 'period' => self::periodLabel($overlap->period_start, $overlap->period_end)]),
            ]]);
        }

        $run = PayRun::query()->create([
            'company_id' => $company->id, 'pay_group_id' => $group->id, 'month' => $end->format('Y-m'),
            'period_start' => $start->toDateString(), 'period_end' => $end->toDateString(), 'status' => 'draft',
        ]);

        return $this->calculate($run, $by);
    }

    public function calculate(PayRun $run, ?User $by): PayRun
    {
        $this->assertEditable($run);

        $ctx = $this->context($run);
        $employees = $this->calculator->employees($ctx);
        $attendance = $this->calculator->attendance($ctx, $employees);
        $adjustments = $this->adjustments($run, $employees->pluck('id'));

        $results = $employees->map(fn (Employee $employee) => [
            'employee' => $employee,
            'result' => $this->calculator->calculate($ctx, $employee, $attendance->get($employee->id), $adjustments->get($employee->id, collect())),
        ]);

        $skipped = $results->filter(fn ($r) => isset($r['result']['skipped']))->pluck('employee');
        $payslips = $results->reject(fn ($r) => isset($r['result']['skipped']))->pluck('result');

        DB::transaction(function () use ($run, $payslips, $skipped, $ctx, $by) {
            $run->payslips()->delete();

            foreach ($payslips as $result) {
                $this->savePayslip($run, $result);
            }

            $run->update([
                'status' => 'calculated',
                'warnings' => $this->runWarnings($run, $ctx, $skipped),
                'totals' => $this->totals($payslips->all()),
                'policy_snapshot' => $this->snapshot($run, $ctx, $skipped),
                'calculated_at' => now(),
                'calculated_by' => $by?->id,
            ]);
        });

        return $run->fresh();
    }

    /** Recalculates one person only (after fixing their attendance or pay), leaving everyone else as they were. */
    public function calculateEmployee(PayRun $run, int $employeeId, ?User $by): PayRun
    {
        $this->assertEditable($run);

        $ctx = $this->context($run);
        $employee = $this->calculator->employees($ctx)->firstWhere('id', $employeeId);
        if (! $employee) {
            throw ValidationException::withMessages(['employee_id' => [__('This person isn\'t in this pay run\'s group for its period. Recalculate the whole run instead.')]]);
        }

        $attendance = $this->calculator->attendance($ctx, collect([$employee]))->get($employee->id);
        $adjustments = $this->adjustments($run, collect([$employee->id]))->get($employee->id, collect());
        $result = $this->calculator->calculate($ctx, $employee, $attendance, $adjustments);

        DB::transaction(function () use ($run, $employee, $result, $ctx, $by) {
            $run->payslips()->where('employee_id', $employee->id)->delete();
            $skippedIds = collect($run->policy_snapshot['skipped_employee_ids'] ?? [])->reject(fn ($id) => $id === $employee->id);

            if (isset($result['skipped'])) {
                $skippedIds->push($employee->id);
            } else {
                $this->savePayslip($run, $result);
            }

            $skipped = Employee::query()->withoutGlobalScopes()->whereIn('id', $skippedIds)->inDisplayOrder()->get();
            $snapshot = $run->policy_snapshot ?? [];
            $fingerprint = $snapshot['fingerprint'] ?? [];
            $mine = $this->employeeFingerprints($run, collect([$employee->id]));

            $run->update([
                'warnings' => $this->runWarnings($run, $ctx, $skipped),
                'totals' => $this->totals($run->payslips()->get()->map(fn (Payslip $p) => [
                    'currency' => $p->currency, 'gross' => (float) $p->gross, 'nssf_employee' => (float) $p->nssf_employee,
                    'tax' => (float) $p->tax, 'net' => (float) $p->net, 'employer_cost' => (float) $p->employer_cost,
                ])->all()),
                'policy_snapshot' => [
                    ...$snapshot,
                    'skipped_employee_ids' => $skipped->pluck('id')->values()->all(),
                    'fingerprint' => [
                        'global' => $fingerprint['global'] ?? null,
                        'employees' => array_replace($fingerprint['employees'] ?? [], [$employee->id => $mine[$employee->id]]),
                    ],
                ],
                'calculated_at' => now(),
                'calculated_by' => $by?->id,
            ]);
        });

        return $run->fresh();
    }

    public function approve(PayRun $run, User $by): PayRun
    {
        if ($run->status !== 'calculated') {
            throw ValidationException::withMessages(['status' => [__('Only a calculated pay run can be approved.')]]);
        }

        // Whoever prepared the run doesn't also sign it off, unless the company allows it.
        if ($run->calculated_by === $by->id && ! SelfApproval::allowed($by)) {
            throw ValidationException::withMessages(['status' => [__('You prepared this pay run, so someone else needs to approve it.')]]);
        }

        // Once more against the final attendance, so what is approved is exactly what was checked.
        // Still credited to whoever prepared it: the approver is recorded separately.
        $preparer = $run->calculated_by ? User::query()->find($run->calculated_by) : null;
        $run = $this->calculate($run, $preparer);

        $blocking = collect($run->warnings)->where('blocking', true);
        $payslipBlocking = $run->payslips()->get()->filter(fn (Payslip $p) => collect($p->warnings)->contains('blocking', true));

        if ($blocking->isNotEmpty() || $payslipBlocking->isNotEmpty()) {
            throw ValidationException::withMessages(['status' => [
                $blocking->pluck('message')->first()
                    ?? $payslipBlocking->count().' '.($payslipBlocking->count() === 1 ? 'payslip has' : 'payslips have').' a problem to fix before approving.',
            ]]);
        }

        DB::transaction(function () use ($run, $by) {
            $run->update(['status' => 'approved', 'approved_at' => now(), 'approved_by' => $by->id]);

            // The attendance these payslips used can't change any more — only these people's, only these days.
            // Where the money goes is fixed now too, so a later account change can't redirect it.
            $payslips = $run->payslips()->with(['employee' => fn ($q) => $q->withoutGlobalScopes()->with('payProfile')])->get();
            foreach ($payslips as $payslip) {
                $payslip->update(['payment' => $payslip->paymentDetails()]);

                AttendanceLock::query()->create([
                    'company_id' => $run->company_id, 'employee_id' => $payslip->employee_id, 'pay_run_id' => $run->id,
                    'start_date' => $payslip->inputs['employed']['from'] ?? $run->period_start->toDateString(),
                    'end_date' => $payslip->inputs['employed']['to'] ?? $run->period_end->toDateString(),
                ]);
            }
        });
        $this->recorder->forgetLocks();
        AuditLogger::record('pay_run.approved', $run, ['period' => [$run->period_start->toDateString(), $run->period_end->toDateString()], 'totals' => $run->totals]);

        return $run->fresh();
    }

    public function markPaid(PayRun $run, User $by): PayRun
    {
        if ($run->status !== 'approved') {
            throw ValidationException::withMessages(['status' => [__('Only an approved pay run can be marked as paid.')]]);
        }

        $run->update(['status' => 'paid', 'paid_at' => now(), 'paid_by' => $by->id]);

        return $run->fresh();
    }

    /**
     * Sends an approved or paid run back to calculated, for a mistake found
     * after sign-off: the attendance it locked opens again, so it can be fixed,
     * recalculated and approved anew. The reason is kept in the audit log.
     */
    public function reopen(PayRun $run, User $by, string $reason): PayRun
    {
        if (! $run->isLocked()) {
            throw ValidationException::withMessages(['status' => [__('Only an approved or paid pay run can be reopened.')]]);
        }

        $before = $run->only(['status', 'approved_at', 'approved_by', 'paid_at', 'paid_by']);

        DB::transaction(function () use ($run) {
            AttendanceLock::query()->withoutGlobalScopes()->where('pay_run_id', $run->id)->delete();
            $run->update(['status' => 'calculated', 'approved_at' => null, 'approved_by' => null, 'paid_at' => null, 'paid_by' => null]);
        });
        $this->recorder->forgetLocks();
        AuditLogger::record('pay_run.reopened', $run, ['status' => 'calculated'], $run->company_id, $before, $reason);

        return $run->fresh();
    }

    public function delete(PayRun $run): void
    {
        $this->assertEditable($run);
        $run->delete();
    }

    /**
     * Runs a group prepares by itself: for each group set to calculate
     * automatically, the period that ended most recently gets its run (never
     * approved — a person still checks and approves it).
     *
     * @return Collection<int, PayRun> the runs created
     */
    public function prepareDue(): Collection
    {
        return PayGroup::query()->withoutGlobalScopes()->where('auto_calculate', true)->where('schedule', '!=', 'custom')
            ->with('company')->get()
            ->map(function (PayGroup $group) {
                $company = $group->company;
                if (! $company || in_array($company->status, ['suspended', 'cancelled'], true) || ! $company->hasModule('payroll')) {
                    return null;
                }
                $current = $group->periodFor($this->today($group->company));
                $last = $group->periodFor($current[0]->subDay());

                $exists = PayRun::query()->withoutGlobalScopes()->where('pay_group_id', $group->id)
                    ->whereDate('period_start', '<=', $last[1]->toDateString())->whereDate('period_end', '>=', $last[0]->toDateString())
                    ->exists();

                return $exists ? null : $this->create($group->company, $group, $last[0]->toDateString(), null, null);
            })
            ->filter()->values();
    }

    /**
     * What changed since the run was calculated: everyone (a rule, a group,
     * someone joining…) or only some people (their attendance, salary,
     * adjustments…), so the page can ask for a recalculation instead of
     * showing stale pay — and say whose.
     *
     * @return array{everyone: bool, employee_ids: array<int, int>}
     */
    public function staleness(PayRun $run): array
    {
        if ($run->isLocked()) {
            return ['everyone' => false, 'employee_ids' => []];
        }

        $stored = $run->policy_snapshot['fingerprint'] ?? null;
        // Calculated before per-person fingerprints existed: there's no telling, so ask for one recalculation.
        if (! is_array($stored)) {
            return ['everyone' => true, 'employee_ids' => []];
        }
        if ($stored['global'] !== $this->globalFingerprint($run)) {
            return ['everyone' => true, 'employee_ids' => []];
        }

        $ids = collect(array_keys($stored['employees'] ?? []))->map(fn ($id) => (int) $id);
        $current = $this->employeeFingerprints($run, $ids);

        return [
            'everyone' => false,
            'employee_ids' => $ids->filter(fn (int $id) => ($stored['employees'][$id] ?? null) !== ($current[$id] ?? null))->values()->all(),
        ];
    }

    public function isStale(PayRun $run): bool
    {
        $stale = $this->staleness($run);

        return $stale['everyone'] || $stale['employee_ids'] !== [];
    }

    /** "1 – 30 Sep 2026", "26 Mar – 25 Apr 2026". */
    public static function periodLabel($start, $end): string
    {
        $start = CarbonImmutable::parse($start);
        $end = CarbonImmutable::parse($end);

        if ($start->year !== $end->year) {
            return $start->format('j M Y').' – '.$end->format('j M Y');
        }

        return ($start->month === $end->month ? $start->format('j') : $start->format('j M')).' – '.$end->format('j M Y');
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    /** @return array<string, mixed> */
    private function context(PayRun $run): array
    {
        return $this->calculator->context(
            $run->company,
            $run->payGroup,
            CarbonImmutable::parse($run->period_start->toDateString()),
            CarbonImmutable::parse($run->period_end->toDateString()),
        );
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function period(PayGroup $group, string $start, ?string $end): array
    {
        $startDay = CarbonImmutable::parse($start)->startOfDay();

        if ($group->hasFixedPeriods()) {
            $period = $group->periodFor($startDay);
            // After a schedule change, a period can start the day after the group's last run instead.
            $afterRun = PayRun::query()->withoutGlobalScopes()->where('pay_group_id', $group->id)
                ->whereDate('period_end', $startDay->subDay()->toDateString())->exists();
            if (! $period[0]->isSameDay($startDay) && ! $afterRun) {
                throw ValidationException::withMessages(['period_start' => [__(':group\'s periods don\'t start on that day. The period holding it is :period.', ['group' => $group->name, 'period' => self::periodLabel($period[0], $period[1])])]]);
            }

            return [$startDay, $period[1]];
        }

        if ($end === null) {
            throw ValidationException::withMessages(['period_end' => [__('Pick the last day of the period.')]]);
        }
        $endDay = CarbonImmutable::parse($end)->startOfDay();
        if ($endDay->lt($startDay)) {
            throw ValidationException::withMessages(['period_end' => [__('The period can\'t end before it starts.')]]);
        }
        if ($startDay->diffInDays($endDay) + 1 > PayGroup::MAX_CUSTOM_DAYS) {
            throw ValidationException::withMessages(['period_end' => ['A pay period can be at most '.PayGroup::MAX_CUSTOM_DAYS.' days.']]);
        }

        return [$startDay, $endDay];
    }

    /** @return Collection<int, Collection<int, PayrollAdjustment>> keyed by employee id */
    private function adjustments(PayRun $run, Collection $employeeIds): Collection
    {
        return PayrollAdjustment::query()->withoutGlobalScopes()
            ->where('company_id', $run->company_id)->whereIn('employee_id', $employeeIds)
            ->whereDate('date', '>=', $run->period_start->toDateString())->whereDate('date', '<=', $run->period_end->toDateString())
            ->orderBy('id')->get()->groupBy('employee_id');
    }

    private function savePayslip(PayRun $run, array $result): void
    {
        $payslip = Payslip::query()->create([
            ...collect($result)->except('lines')->all(),
            'company_id' => $run->company_id,
            'pay_run_id' => $run->id,
        ]);

        PayslipLine::query()->insert(array_map(fn ($line) => [
            ...$line,
            'payslip_id' => $payslip->id,
            'details' => $line['details'] === null ? null : json_encode($line['details']),
        ], $result['lines']));
    }

    /**
     * @param  Collection<int, Employee>  $skipped  people in the group with no salary for the period
     * @return array<int, array<string, mixed>>
     */
    private function runWarnings(PayRun $run, array $ctx, Collection $skipped): array
    {
        $warnings = [];
        if ($skipped->isEmpty() && ! $run->payslips()->exists()) {
            // The usual cause: people were moved in, but from a date after this period.
            $later = EmployeePayGroup::query()->withoutGlobalScopes()->where('pay_group_id', $ctx['group']->id)
                ->whereDate('effective_from', '>', $ctx['end']->toDateString())->get();
            $first = $later->min(fn (EmployeePayGroup $m) => $m->effective_from->toDateString());

            $warnings[] = [
                'code' => 'no_members', 'blocking' => true,
                'message' => __('Nobody is in :group for these dates, so there is no one to pay.', ['group' => $ctx['group']->name])
                    .($later->isNotEmpty()
                        ? ' '.$later->count().' '.($later->count() === 1 ? 'person was' : 'people were').' moved into it only from '.CarbonImmutable::parse($first)->format('j M Y')
                            .', after this period. On their Pay tab, undo that change and move them again from '.$ctx['start']->format('j M Y').' or earlier, then recalculate.'
                        : ' Put employees in this group on their Pay tab (Change group) from '.$ctx['start']->format('j M Y').' or earlier, then recalculate'
                            .($ctx['group']->is_default ? '.' : ' — or run the group they are in now.')),
            ];
        }
        if ($skipped->isNotEmpty()) {
            $n = $skipped->count();
            $warnings[] = [
                'code' => 'no_salary', 'blocking' => false,
                'message' => $n.' '.($n === 1 ? 'employee has' : 'employees have').' no salary for this period and '.($n === 1 ? 'is' : 'are').' left out: '
                    .$skipped->take(10)->map(fn ($e) => $e->name)->join(', ').($n > 10 ? '…' : '').'.',
                'employee_ids' => $skipped->pluck('id')->values()->all(),
            ];
        }
        if (! $ctx['statutory']) {
            $warnings[] = [
                'code' => 'no_tax_nssf', 'blocking' => false,
                'message' => __('Tax on salary and NSSF are not worked out for this pay period yet (only for 1st → end-of-month periods). Handle them outside payroll for now.'),
            ];
        }
        if ($ctx['end']->toDateString() >= $this->today($run->company)) {
            $warnings[] = ['code' => 'period_not_over', 'blocking' => true, 'message' => __('The period isn\'t over yet, so these numbers are a preview.')];
        }

        return $warnings;
    }

    /** @return array<string, mixed> */
    private function snapshot(PayRun $run, array $ctx, Collection $skipped): array
    {
        $ids = $run->payslips()->pluck('employee_id')->merge($skipped->pluck('id'));

        return [
            'policy' => $ctx['policy']->only(['rate_basis', 'rate_basis_days', 'hours_per_day', 'missing_scan_policy', 'daily_paid_holidays', 'enforce_overtime_minimums', 'khr_rounding', 'fallback_exchange_rate']),
            'group' => $ctx['group']->only(['id', 'name', 'schedule', 'cutoff_days', 'anchor_date']),
            'period' => ['start' => $ctx['start']->toDateString(), 'end' => $ctx['end']->toDateString(), 'days' => $ctx['days_in_period'], 'salary_share' => $ctx['salary_share']],
            'components' => $ctx['components']->map->only(['code', 'name', 'kind', 'method', 'template', 'params', 'taxable', 'nssf_insurable'])->values()->all(),
            'statutory' => $ctx['statutory'],
            'exchange_rate' => $ctx['exchange_rate'],
            'exchange_rate_source' => $ctx['exchange_rate_source'],
            'tax' => $ctx['tax'],
            'nssf' => $ctx['nssf'],
            'skipped_employee_ids' => $skipped->pluck('id')->values()->all(),
            'fingerprint' => [
                'global' => $this->globalFingerprint($run),
                'employees' => $this->employeeFingerprints($run, $ids),
            ],
        ];
    }

    /**
     * Inputs everyone shares — rules, the group, rates — plus who is in the
     * group (pay group moves, hires, leavers). Row count + latest change:
     * counts catch deletions, timestamps catch edits.
     */
    private function globalFingerprint(PayRun $run): string
    {
        $company = $run->company_id;
        $state = fn (string $table, ?callable $scope = null) => (array) DB::table($table)
            ->when($scope, $scope)
            ->selectRaw('count(*) as n, max(updated_at) as at')
            ->first();
        $own = fn ($q) => $q->where('company_id', $company);

        return md5(json_encode([
            $state('pay_components', $own),
            $state('payroll_policies', $own),
            $state('pay_groups', $own),
            $state('employee_pay_groups', $own),
            // Hires and leavers change who is in the run; other edits to people are per person, below.
            (array) DB::table('employees')->where('company_id', $company)
                ->selectRaw('count(*) as n, max(hire_date) as h, max(termination_date) as t, sum(case when employment_status in (?, ?, ?, ?) then 1 else 0 end) as gone', Employee::LEFT_STATUSES)
                ->first(),
            $state('statutory_rates'),
            $state('tax_exchange_rates', fn ($q) => $q->where('month', $run->month)),
        ]));
    }

    /**
     * Each person's own inputs for the period: their attendance, salary,
     * items, profile and adjustments. One grouped query per table.
     *
     * @return array<int, string> employee id => fingerprint
     */
    private function employeeFingerprints(PayRun $run, Collection $employeeIds): array
    {
        if ($employeeIds->isEmpty()) {
            return [];
        }

        $start = $run->period_start->toDateString();
        $end = $run->period_end->toDateString();
        $state = fn (string $table, string $column, ?callable $scope = null) => DB::table($table)
            ->whereIn($column, $employeeIds)
            ->when($scope, $scope)
            ->groupBy($column)
            ->selectRaw("{$column} as id, count(*) as n, max(updated_at) as at")
            ->get()->keyBy('id');
        $inPeriod = fn (string $column) => fn ($q) => $q->whereDate($column, '>=', $start)->whereDate($column, '<=', $end);

        $tables = [
            $state('attendance_days', 'employee_id', $inPeriod('date')),
            $state('payroll_adjustments', 'employee_id', $inPeriod('date')),
            $state('employee_salaries', 'employee_id'),
            $state('employee_pay_items', 'employee_id'),
            $state('employee_pay_profiles', 'employee_id'),
            $state('employees', 'id'),
        ];

        return $employeeIds->mapWithKeys(fn (int $id) => [
            $id => md5(json_encode(array_map(fn (Collection $rows) => [(int) ($rows[$id]->n ?? 0), $rows[$id]->at ?? null], $tables))),
        ])->all();
    }

    private function assertEditable(PayRun $run): void
    {
        if ($run->isLocked()) {
            throw ValidationException::withMessages(['status' => [__('This pay run is approved and can no longer change. Add an adjustment to a later period instead.')]]);
        }
    }

    private function today(Company $company): string
    {
        return now($company->timezone ?: config('attendance.default_timezone'))->toDateString();
    }

    /**
     * Sums per currency (USD and KHR salaries are never added together).
     *
     * @param  array<int, array<string, mixed>>  $payslips
     * @return array<string, array<string, float|int>>
     */
    private function totals(array $payslips): array
    {
        return collect($payslips)->groupBy('currency')->map(fn ($group, $currency) => [
            'employees' => $group->count(),
            'gross' => Money::round($group->sum('gross'), $currency),
            'nssf_employee' => Money::round($group->sum('nssf_employee'), $currency),
            'tax' => Money::round($group->sum('tax'), $currency),
            'net' => Money::round($group->sum('net'), $currency),
            'employer_cost' => Money::round($group->sum('employer_cost'), $currency),
        ])->all();
    }
}
