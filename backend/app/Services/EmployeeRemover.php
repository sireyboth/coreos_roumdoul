<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Deletes employees for good: the row and everything hanging off it
 * (attendance, schedules, assignments, days off — the foreign keys cascade),
 * their photo, and their login. Nothing is kept, so the same employee ID or
 * email can be imported again straight away.
 */
class EmployeeRemover
{
    /**
     * @param  iterable<Employee>  $employees
     */
    public function remove(iterable $employees, User $actor): void
    {
        $employees = collect($employees);

        // An admin deleting their own employee record would delete their own login.
        if ($employees->contains(fn (Employee $employee) => $employee->user_id === $actor->id)) {
            throw ValidationException::withMessages([
                'employee' => ['You cannot delete your own employee record.'],
            ]);
        }

        $photos = [];

        DB::transaction(function () use ($employees, &$photos) {
            foreach ($employees as $employee) {
                $user = $employee->user;

                $employee->delete();

                if ($user) {
                    $this->removeLogin($user);
                }

                if ($employee->photo_path) {
                    $photos[] = $employee->photo_path;
                }
            }
        });

        // Only once the rows are really gone, so a rollback never leaves a record without its photo.
        if ($photos !== []) {
            Storage::disk('local')->delete($photos);
        }
    }

    private function removeLogin(User $user): void
    {
        $user->tokens()->delete();

        // Corrections this person filed for others still point at their account,
        // so it can't go. Lock it and free the employee ID for someone else instead.
        if (DB::table('attendance_corrections')->where('requested_by', $user->id)->exists()) {
            $user->update(['is_active' => false]);
            $user->membership?->update(['login_id' => null]);
            AuditLogger::record('user.deactivated', $user, ['reason' => 'employee deleted']);

            return;
        }

        AuditLogger::record('user.removed', $user, ['name' => $user->name, 'email' => $user->email, 'reason' => 'employee deleted']);
        $user->delete();
    }
}
