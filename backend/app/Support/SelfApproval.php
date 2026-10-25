<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * A second pair of eyes: nobody approves or changes their own attendance,
 * overtime, leave balance or pay — unless their company turned on
 * Company::allow_self_approval (a company run by a single admin).
 */
class SelfApproval
{
    public static function allowed(User $user): bool
    {
        return (bool) $user->company?->allow_self_approval;
    }

    /**
     * @param  string  $field  the form field the error is shown on
     * @param  string  $what  finishes "You can't … yourself", e.g. "approve overtime for"
     */
    public static function assertNotSelf(User $user, Employee|int|null $employee, string $field, string $what): void
    {
        $employeeUserId = $employee instanceof Employee
            ? $employee->user_id
            : ($employee === null ? null : Employee::query()->withoutGlobalScopes()->whereKey($employee)->value('user_id'));

        if ($employeeUserId === null || $employeeUserId !== $user->id || self::allowed($user)) {
            return;
        }

        throw ValidationException::withMessages([
            $field => ["You can't {$what} yourself — ask someone else who has the permission."],
        ]);
    }
}
