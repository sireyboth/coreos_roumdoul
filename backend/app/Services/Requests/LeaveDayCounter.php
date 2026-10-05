<?php

namespace App\Services\Requests;

use App\Models\Employee;
use App\Models\LeaveType;
use App\Services\Attendance\ScheduleResolver;
use Carbon\CarbonImmutable;

/**
 * Which dates a leave request takes, and how much of each. For most types
 * only scheduled work days count — a holiday, a weekly day off or a day off
 * inside the range costs nothing — so "Mon–Fri" over a public holiday is 4
 * days. Calendar-day types (maternity) count every date. Someone with no
 * schedule assigned has every non-holiday date counted.
 *
 * Read against the plain schedule, ignoring leave already approved: whether
 * the dates are free is a separate question (see EmployeeRequestService).
 */
final class LeaveDayCounter
{
    /**
     * @return array<int, array{date: string, portion: float, part: string}>
     */
    public function count(Employee $employee, LeaveType $type, string $start, string $end, string $part = 'full'): array
    {
        $resolver = new ScheduleResolver($employee->company, [$employee->id], $start, $end, withLeave: false);
        $portion = $part === 'full' ? 1.0 : 0.5;
        $days = [];

        for ($date = CarbonImmutable::parse($start); $date->toDateString() <= $end; $date = $date->addDay()) {
            $day = $date->toDateString();

            $expected = $resolver->resolve($employee->id, $day);

            // No schedule at all: every date counts except a holiday, as there is
            // no way to tell work days from days off.
            if ($type->countsCalendarDays() || $expected->isWork() || $expected->kind === 'unscheduled') {
                $days[] = ['date' => $day, 'portion' => $portion, 'part' => $part];
            }
        }

        return $days;
    }
}
