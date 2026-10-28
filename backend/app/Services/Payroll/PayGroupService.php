<?php

namespace App\Services\Payroll;

use App\Models\Employee;
use App\Models\EmployeePayGroup;
use App\Models\PayGroup;
use App\Models\Payslip;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Who is in which pay group, and when. Kept like salary history: one
 * open-ended row, rows never overlap or leave gaps, and nothing already paid
 * can be moved. Before someone's first row they are in the default group,
 * so people never put in a group are simply paid with it.
 */
class PayGroupService
{
    /**
     * The days of [$start, $end] the employee spent in $group, as one span.
     * Expects $employee->payGroups loaded (oldest first).
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public function spanIn(Employee $employee, PayGroup $group, CarbonImmutable $start, CarbonImmutable $end, int $defaultGroupId): ?array
    {
        $from = null;
        $to = null;

        foreach ($this->stretches($employee, $defaultGroupId) as [$groupId, $stretchFrom, $stretchTo]) {
            if ($groupId !== $group->id) {
                continue;
            }
            $a = $stretchFrom === null || $stretchFrom->lt($start) ? $start : $stretchFrom;
            $b = $stretchTo === null || $stretchTo->gt($end) ? $end : $stretchTo;
            if ($a->lte($b)) {
                $from = $from === null || $a->lt($from) ? $a : $from;
                $to = $to === null || $b->gt($to) ? $b : $to;
            }
        }

        return $from ? [$from, $to] : null;
    }

    /** The group the employee is in on $date. Expects $employee->payGroups loaded. */
    public function groupIdOn(Employee $employee, string $date, int $defaultGroupId): int
    {
        $day = CarbonImmutable::parse($date);

        foreach ($this->stretches($employee, $defaultGroupId) as [$groupId, $from, $to]) {
            if (($from === null || $from->lte($day)) && ($to === null || $to->gte($day))) {
                return $groupId;
            }
        }

        return $defaultGroupId;
    }

    /**
     * How many current (not departed) employees are in each group today.
     *
     * @return array<int, int> group id => people
     */
    public function memberCounts(int $companyId, string $today, int $defaultGroupId): array
    {
        return Employee::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereNotIn('employment_status', Employee::LEFT_STATUSES)
            ->with('payGroups')
            ->get()
            ->countBy(fn (Employee $employee) => $this->groupIdOn($employee, $today, $defaultGroupId))
            ->all();
    }

    /**
     * Moves the employee into $group from $from. The same start date as the
     * latest row corrects that row instead of adding one.
     */
    public function assign(Employee $employee, PayGroup $group, string $from, ?User $by = null): EmployeePayGroup
    {
        $this->assertNotPaid($employee, $from);

        return DB::transaction(function () use ($employee, $group, $from, $by) {
            $rows = $this->history($employee);

            if ($later = $rows->first(fn (EmployeePayGroup $row) => $row->effective_from->toDateString() > $from)) {
                throw ValidationException::withMessages([
                    'effective_from' => [__('A pay group change is already set from :date. Remove it first, or pick a later date.', ['date' => $later->effective_from->toDateString()])],
                ]);
            }

            if ($same = $rows->first(fn (EmployeePayGroup $row) => $row->effective_from->toDateString() === $from)) {
                $same->update(['pay_group_id' => $group->id, 'created_by' => $by?->id]);

                return $same;
            }

            $current = $rows->whereNull('effective_to')->last();
            if ($current?->pay_group_id === $group->id) {
                throw ValidationException::withMessages(['pay_group_id' => [__(':name is already in :group.', ['name' => $employee->name, 'group' => $group->name])]]);
            }

            $rows->whereNull('effective_to')->each(fn (EmployeePayGroup $open) => $open->update([
                'effective_to' => CarbonImmutable::parse($from)->subDay()->toDateString(),
            ]));

            return EmployeePayGroup::query()->create([
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'pay_group_id' => $group->id,
                'effective_from' => $from,
                'created_by' => $by?->id,
            ]);
        });
    }

    /** Only the latest row can be removed (the one before it then runs on again). */
    public function remove(EmployeePayGroup $row): void
    {
        $employee = $row->employee;
        $this->assertNotPaid($employee, $row->effective_from->toDateString());

        DB::transaction(function () use ($employee, $row) {
            $rows = $this->history($employee);

            if ($rows->last()?->id !== $row->id) {
                throw ValidationException::withMessages(['pay_group' => [__('Only the latest pay group change can be removed.')]]);
            }

            $row->delete();
            $rows->slice(-2, 1)->first()?->update(['effective_to' => null]);
        });
    }

    /**
     * The last day this employee has been paid through by an approved pay
     * run: nothing on or before it (salary, pay group, adjustments) can change.
     */
    public function paidThrough(Employee $employee): ?string
    {
        $end = Payslip::query()->withoutGlobalScopes()
            ->join('pay_runs', 'pay_runs.id', '=', 'payslips.pay_run_id')
            ->where('payslips.employee_id', $employee->id)
            ->whereIn('pay_runs.status', ['approved', 'paid'])
            ->max('pay_runs.period_end');

        return $end ? substr((string) $end, 0, 10) : null;
    }

    /**
     * Which of these people an approved pay run already paid for $date.
     *
     * @param  Collection<int, int>|array<int, int>  $employeeIds
     * @return Collection<int, int>
     */
    public function paidOn(Collection|array $employeeIds, string $date): Collection
    {
        return Payslip::query()->withoutGlobalScopes()
            ->join('pay_runs', 'pay_runs.id', '=', 'payslips.pay_run_id')
            ->whereIn('payslips.employee_id', collect($employeeIds))
            ->whereIn('pay_runs.status', ['approved', 'paid'])
            ->whereDate('pay_runs.period_start', '<=', $date)->whereDate('pay_runs.period_end', '>=', $date)
            ->pluck('payslips.employee_id')->unique()->values();
    }

    /** @return Collection<int, EmployeePayGroup> oldest first */
    public function history(Employee $employee): Collection
    {
        return EmployeePayGroup::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->orderBy('effective_from')->orderBy('id')
            ->get();
    }

    /**
     * The employee's time as [group id, from, to] stretches, null = open
     * ended; the first stretch is the default group up to their first row.
     *
     * @return array<int, array{0: int, 1: ?CarbonImmutable, 2: ?CarbonImmutable}>
     */
    private function stretches(Employee $employee, int $defaultGroupId): array
    {
        $rows = $employee->relationLoaded('payGroups') ? $employee->payGroups : $this->history($employee);

        if ($rows->isEmpty()) {
            return [[$defaultGroupId, null, null]];
        }

        $first = CarbonImmutable::parse($rows->first()->effective_from->toDateString());

        return [
            [$defaultGroupId, null, $first->subDay()],
            ...$rows->map(fn (EmployeePayGroup $row) => [
                $row->pay_group_id,
                CarbonImmutable::parse($row->effective_from->toDateString()),
                $row->effective_to ? CarbonImmutable::parse($row->effective_to->toDateString()) : null,
            ])->all(),
        ];
    }

    private function assertNotPaid(Employee $employee, string $date): void
    {
        $paid = $this->paidThrough($employee);

        if ($paid !== null && $date <= $paid) {
            throw ValidationException::withMessages([
                'effective_from' => [__(':name is already paid through :date. Pick a later date.', ['name' => $employee->name, 'date' => CarbonImmutable::parse($paid)->format('j M Y')])],
            ]);
        }
    }
}
