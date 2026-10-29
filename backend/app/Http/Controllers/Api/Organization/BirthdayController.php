<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Upcoming birthdays, part of the "birthdays" module (see BirthdayNotifier).
 *
 * date_of_birth is a personal field only employees.manage may read, so this
 * sends the day and month alone: never the year, so never anyone's age.
 * The branch_access scope still applies, so people only see the branches
 * they can already see.
 */
class BirthdayController extends Controller
{
    public function index(Request $request)
    {
        $company = $request->user()->company;
        $today = CarbonImmutable::now($company->timezone ?: config('attendance.default_timezone'))->startOfDay();

        $employees = Employee::query()
            ->whereNotIn('employment_status', Employee::LEFT_STATUSES)
            ->whereNotNull('date_of_birth')
            ->with(['branch', 'department', 'currentAssignment'])
            ->get();

        $rows = $employees->map(function (Employee $employee) use ($today) {
            $next = $this->nextBirthday($employee->date_of_birth, $today);

            return [
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'employee_code' => $employee->employee_code,
                    'job_title' => $employee->job_title,
                    'photo_url' => $employee->photo_url,
                    'branch' => $employee->branch?->only(['id', 'name']),
                    'department' => $employee->department?->only(['id', 'name']),
                ],
                'month' => (int) $employee->date_of_birth->format('n'),
                'day' => (int) $employee->date_of_birth->format('j'),
                'next_date' => $next->toDateString(),
                'days_until' => (int) $today->diffInDays($next),
            ];
        })->sortBy([['days_until', 'asc'], ['employee.name', 'asc']])->values();

        return response()->json(['today' => $today->toDateString(), 'data' => $rows]);
    }

    /** Today or later. Feb 29 birthdays fall on Feb 28 in other years, as the alerts do. */
    private function nextBirthday(\DateTimeInterface $dateOfBirth, CarbonImmutable $today): CarbonImmutable
    {
        $month = (int) $dateOfBirth->format('n');
        $day = (int) $dateOfBirth->format('j');

        // setDate keeps $today's timezone, so the comparison below is like for like.
        $on = function (int $year) use ($today, $month, $day) {
            $leapDay = $month === 2 && $day === 29 && ! $today->setDate($year, 1, 1)->isLeapYear();

            return $today->setDate($year, $month, $leapDay ? 28 : $day);
        };

        $next = $on($today->year);

        return $next->lessThan($today) ? $on($today->year + 1) : $next;
    }
}
