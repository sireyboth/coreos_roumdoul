<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAssignment;

/**
 * The only place that should ever write to employee_assignments: opens the
 * first assignment when an employee is created, and on a reassignment closes
 * the current row (effective_to = today) and opens a new one instead of
 * overwriting it, so branch/department/team history is preserved.
 */
class EmployeeAssignmentService
{
    /**
     * @param  array{branch_id?: int|null, department_id?: int|null, team_id?: int|null, manager_employee_id?: int|null, job_title?: string|null}  $data
     */
    public function open(Employee $employee, array $data): EmployeeAssignment
    {
        return $employee->assignments()->create([
            'company_id' => $employee->company_id,
            'branch_id' => $data['branch_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'team_id' => $data['team_id'] ?? null,
            'manager_employee_id' => $data['manager_employee_id'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'effective_from' => now()->toDateString(),
            'effective_to' => null,
        ]);
    }

    /**
     * Only touches employee_assignments when at least one assignment field
     * is actually present in $data — a plain profile edit (email, phone,
     * etc.) shouldn't churn out a pointless new assignment row.
     *
     * @param  array{branch_id?: int|null, department_id?: int|null, team_id?: int|null, manager_employee_id?: int|null, job_title?: string|null}  $data
     */
    public function reassign(Employee $employee, array $data): ?EmployeeAssignment
    {
        $assignmentFields = ['branch_id', 'department_id', 'team_id', 'manager_employee_id', 'job_title'];

        if (empty(array_intersect_key($data, array_flip($assignmentFields)))) {
            return null;
        }

        $current = $employee->currentAssignment;

        $next = array_merge([
            'branch_id' => $current?->branch_id,
            'department_id' => $current?->department_id,
            'team_id' => $current?->team_id,
            'manager_employee_id' => $current?->manager_employee_id,
            'job_title' => $current?->job_title,
        ], $data);

        $unchanged = $current
            && $current->branch_id === $next['branch_id']
            && $current->department_id === $next['department_id']
            && $current->team_id === $next['team_id']
            && $current->manager_employee_id === $next['manager_employee_id']
            && $current->job_title === $next['job_title'];

        if ($unchanged) {
            return $current;
        }

        $current?->update(['effective_to' => now()->toDateString()]);

        return $this->open($employee, $next);
    }
}
