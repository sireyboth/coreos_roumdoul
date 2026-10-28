<?php

namespace App\Services\Payroll;

use App\Models\Employee;
use App\Models\EmployeeSalary;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Keeps an employee's salary history consistent: one open-ended row, rows
 * never overlap, days already paid can't be rewritten, and employees.base_salary
 * always mirrors the salary in force today (so existing screens keep working).
 */
class EmployeeSalaryService
{
    public function __construct(private readonly PayGroupService $groups) {}

    public function record(
        Employee $employee,
        float $amount,
        string $currency,
        string $payType,
        string $effectiveFrom,
        string $reason = 'change',
        ?string $note = null,
        ?User $by = null,
    ): EmployeeSalary {
        $this->assertMonthOpen($employee, $effectiveFrom);

        return DB::transaction(function () use ($employee, $amount, $currency, $payType, $effectiveFrom, $reason, $note, $by) {
            $rows = $this->history($employee);

            if ($later = $rows->first(fn (EmployeeSalary $row) => $row->effective_from->toDateString() > $effectiveFrom)) {
                throw ValidationException::withMessages([
                    'effective_from' => [__('A salary change is already set from :date. Remove it first, or pick a later date.', ['date' => $later->effective_from->toDateString()])],
                ]);
            }

            $attributes = [
                'amount' => $amount, 'currency' => $currency, 'pay_type' => $payType,
                'reason' => $reason, 'note' => $note, 'created_by' => $by?->id,
            ];

            // Same start date: a correction of that row, not a new change.
            if ($same = $rows->first(fn (EmployeeSalary $row) => $row->effective_from->toDateString() === $effectiveFrom)) {
                $same->update($attributes);
                $salary = $same;
            } else {
                $rows->whereNull('effective_to')->each(fn (EmployeeSalary $open) => $open->update([
                    'effective_to' => CarbonImmutable::parse($effectiveFrom)->subDay()->toDateString(),
                ]));

                $salary = EmployeeSalary::query()->create([
                    ...$attributes,
                    'company_id' => $employee->company_id,
                    'employee_id' => $employee->id,
                    'effective_from' => $effectiveFrom,
                ]);
            }

            $this->syncProfile($employee);

            return $salary;
        });
    }

    /** Only the latest row can be removed (the one before it then runs on again). */
    public function remove(EmployeeSalary $salary): void
    {
        $employee = $salary->employee;
        $this->assertMonthOpen($employee, $salary->effective_from->toDateString());

        DB::transaction(function () use ($employee, $salary) {
            $rows = $this->history($employee);

            if ($rows->last()?->id !== $salary->id) {
                throw ValidationException::withMessages(['salary' => [__('Only the latest salary can be removed.')]]);
            }

            $salary->delete();
            $rows->slice(-2, 1)->first()?->update(['effective_to' => null]);
            $this->syncProfile($employee);
        });
    }

    /**
     * The employee form still edits base_salary directly: a change there
     * becomes a history row from today (or from the hire date for the very first one).
     */
    public function followProfile(Employee $employee, ?User $by = null): void
    {
        if ($employee->base_salary === null || $employee->salary_currency === null) {
            return;
        }

        $today = $this->today($employee);
        $current = $this->inForce($employee, $today) ?? $this->history($employee)->last();

        if ($current && (float) $current->amount === (float) $employee->base_salary && $current->currency === $employee->salary_currency) {
            return;
        }

        $from = $current === null ? ($employee->hire_date?->toDateString() ?? $today) : $today;
        if ($from > $today || $this->monthPaid($employee, $from)) {
            $from = $today;
        }
        if ($current && $current->effective_from->toDateString() > $from) {
            $from = $current->effective_from->toDateString();
        }

        $this->record(
            $employee, (float) $employee->base_salary, $employee->salary_currency, $current?->pay_type ?? 'monthly',
            $from, $current === null ? 'hired' : 'change', 'Changed on the employee profile', $by,
        );
    }

    public function inForce(Employee $employee, string $date): ?EmployeeSalary
    {
        return $this->history($employee)->first(fn (EmployeeSalary $row) => $row->effective_from->toDateString() <= $date
            && ($row->effective_to === null || $row->effective_to->toDateString() >= $date));
    }

    /** @return Collection<int, EmployeeSalary> oldest first */
    public function history(Employee $employee)
    {
        return EmployeeSalary::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->orderBy('effective_from')->orderBy('id')
            ->get();
    }

    /** Mirrors the salary in force today onto the employee row, quietly (the history row is the audited change). */
    private function syncProfile(Employee $employee): void
    {
        $current = $this->inForce($employee, $this->today($employee));

        $employee->forceFill([
            'base_salary' => $current?->amount,
            'salary_currency' => $current?->currency,
        ])->saveQuietly();
    }

    private function assertMonthOpen(Employee $employee, string $date): void
    {
        if ($this->monthPaid($employee, $date)) {
            throw ValidationException::withMessages([
                'effective_from' => [__(':name is already paid through :date. Choose a later date, or add an adjustment to the next pay run.', ['name' => $employee->name, 'date' => CarbonImmutable::parse($this->groups->paidThrough($employee))->format('j M Y')])],
            ]);
        }
    }

    /** Whether an approved pay run already paid this person for $date (or a later day). */
    private function monthPaid(Employee $employee, string $date): bool
    {
        $paid = $this->groups->paidThrough($employee);

        return $paid !== null && $date <= $paid;
    }

    private function today(Employee $employee): string
    {
        return now($employee->company?->timezone ?: config('attendance.default_timezone'))->toDateString();
    }
}
