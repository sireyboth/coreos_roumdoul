<?php

namespace Tests\Concerns;

use App\Models\AttendanceDay;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Schedule;
use App\Models\WorkSchedule;

/**
 * Builds work schedules, assignments and roster overrides for tests, straight
 * into the database (no API), so a test can focus on what it's testing.
 */
trait CreatesWorkSchedules
{
    /**
     * A schedule with the same slots on the given weekdays (default: every day).
     *
     * @param  array<int, array{0: string, 1: string, 2?: bool}>  $slots  [type, HH:MM, next_day]
     */
    protected function makeWorkSchedule(Company $company, array $slots = [['in', '08:00'], ['out', '17:00']], array $attributes = [], ?array $weekdays = null): WorkSchedule
    {
        $schedule = WorkSchedule::query()->withoutGlobalScopes()->create(array_merge([
            'company_id' => $company->id,
            'name' => 'Schedule '.uniqid(),
            'is_active' => true,
        ], $attributes));

        foreach ($weekdays ?? range(0, 6) as $weekday) {
            $day = $schedule->days()->create(['weekday' => $weekday]);
            foreach ($slots as $i => $slot) {
                $day->slots()->create(['sequence' => $i + 1, 'type' => $slot[0], 'time' => $slot[1], 'next_day' => $slot[2] ?? false]);
            }
        }

        return $schedule->fresh();
    }

    protected function assignSchedule(Employee $employee, WorkSchedule $schedule, string $from = '2020-01-01', ?string $to = null, array $daysOff = []): EmployeeScheduleAssignment
    {
        return EmployeeScheduleAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_schedule_id' => $schedule->id,
            'effective_from' => $from,
            'effective_to' => $to,
            'days_off' => $daysOff,
        ]);
    }

    protected function overrideOn(Employee $employee, WorkSchedule $schedule, string $date, ?int $workLocationId = null): Schedule
    {
        return Schedule::query()->withoutGlobalScopes()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_schedule_id' => $schedule->id,
            'work_location_id' => $workLocationId,
            'date' => $date,
        ]);
    }

    protected function attendanceDay(Employee $employee, ?string $date = null): ?AttendanceDay
    {
        return AttendanceDay::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)
            ->when($date, fn ($q) => $q->whereDate('date', $date))
            ->latest('date')
            ->first();
    }
}
