<?php

namespace App\Services\Attendance;

use App\Models\Company;
use App\Models\DayOff;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Holiday;
use App\Models\Schedule;
use App\Models\WorkSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Works out what each employee was expected to do on each date. Loads
 * everything for a set of employees and a date range up front (a handful of
 * queries in total), so a team's month resolves without a query per day.
 *
 * Priority, highest first:
 *  1. a one-day override on the roster   → that schedule's slots for the weekday
 *  2. a company holiday                  → holiday
 *  3. a one-off day off for the person   → day off
 *  4. the assignment covering the date   → weekly day off, or its slots
 *  5. nothing                            → unscheduled
 *
 * An override beats a holiday on purpose: it is how a manager says "the
 * shop opens on this holiday and Dara works". The day is still marked as a
 * holiday, so overtime on it is counted as holiday work.
 *
 * Every query filters by company explicitly — this also runs from the
 * console, where there is no signed-in user to scope by.
 */
final class ScheduleResolver
{
    private string $timezone;

    private Collection $holidays;

    /** @var Collection<string, Schedule> keyed "employeeId|date" */
    private Collection $overrides;

    /** @var Collection<string, DayOff> keyed "employeeId|date" */
    private Collection $daysOff;

    /** @var Collection<int, Collection<int, EmployeeScheduleAssignment>> by employee id */
    private Collection $assignments;

    /**
     * @param  iterable<int>  $employeeIds
     */
    public function __construct(private readonly Company $company, iterable $employeeIds, string $from, string $to)
    {
        $ids = collect($employeeIds)->values();
        $this->timezone = $company->timezone ?: config('attendance.default_timezone');
        $withSlots = ['workSchedule' => fn ($q) => $q->withTrashed()->withoutGlobalScopes()->with('days.slots')];

        $this->holidays = Holiday::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where(fn ($q) => $q->where(fn ($r) => $r->whereDate('date', '>=', $from)->whereDate('date', '<=', $to))->orWhere('is_recurring_yearly', true))
            ->get();

        $this->overrides = Schedule::query()->withoutGlobalScopes()->with($withSlots)
            ->where('company_id', $company->id)
            ->whereIn('employee_id', $ids)
            ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
            ->whereNotNull('work_schedule_id')
            ->get()
            ->keyBy(fn (Schedule $s) => $s->employee_id.'|'.$s->date->toDateString());

        $this->daysOff = DayOff::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereIn('employee_id', $ids)
            ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
            ->get()
            ->keyBy(fn (DayOff $d) => $d->employee_id.'|'.$d->date->toDateString());

        $this->assignments = EmployeeScheduleAssignment::query()->withoutGlobalScopes()->with($withSlots)
            ->where('company_id', $company->id)
            ->whereIn('employee_id', $ids)
            ->overlapping($from, $to)
            ->orderBy('effective_from')
            ->get()
            ->groupBy('employee_id');
    }

    /** Convenience for a single employee around a single date (the date and its neighbours). */
    public static function around(Company $company, int $employeeId, string $date, int $daysBefore = 1, int $daysAfter = 1): self
    {
        $day = CarbonImmutable::parse($date);

        return new self($company, [$employeeId], $day->subDays($daysBefore)->toDateString(), $day->addDays($daysAfter)->toDateString());
    }

    public function timezone(): string
    {
        return $this->timezone;
    }

    public function resolve(int $employeeId, string $date): ExpectedDay
    {
        $day = CarbonImmutable::parse($date, $this->timezone)->startOfDay();
        $key = $employeeId.'|'.$date;
        $holiday = $this->holidayOn($day);
        $assignment = $this->assignmentOn($employeeId, $date);

        if ($override = $this->overrides->get($key)) {
            return $this->workDay($day, $override->workSchedule, 'override', $holiday?->name, $override->work_location_id)
                ?? $this->offDay($day, 'weekly_off', 'No hours on this weekday', $override->workSchedule, 'override', $holiday?->name);
        }

        if ($holiday) {
            return $this->offDay($day, 'holiday', $holiday->name, $assignment?->workSchedule, 'assignment', $holiday->name);
        }

        if ($dayOff = $this->daysOff->get($key)) {
            return $this->offDay($day, 'day_off', $dayOff->reason ?: 'Day off', $assignment?->workSchedule, 'assignment');
        }

        if (! $assignment) {
            return new ExpectedDay($date, $this->timezone, 'unscheduled');
        }

        if (in_array($day->dayOfWeek, $assignment->daysOff(), true)) {
            return $this->offDay($day, 'weekly_off', 'Weekly day off', $assignment->workSchedule, 'assignment');
        }

        return $this->workDay($day, $assignment->workSchedule, 'assignment', null, null)
            ?? $this->offDay($day, 'weekly_off', 'No hours on this weekday', $assignment->workSchedule, 'assignment');
    }

    /** The assignment in force on a date, if any (the latest-starting one wins). */
    public function assignmentOn(int $employeeId, string $date): ?EmployeeScheduleAssignment
    {
        return $this->assignments->get($employeeId, collect())
            ->filter(fn (EmployeeScheduleAssignment $a) => $a->effective_from->toDateString() <= $date
                && ($a->effective_to === null || $a->effective_to->toDateString() >= $date))
            ->last();
    }

    private function workDay(CarbonImmutable $day, WorkSchedule $schedule, string $source, ?string $holiday, ?int $workLocationId): ?ExpectedDay
    {
        $slots = $schedule->slotsFor($day->dayOfWeek);

        if ($slots === []) {
            return null;
        }

        $slots = array_map(function (array $slot) use ($day) {
            [$hour, $minute] = array_map('intval', explode(':', $slot['time']));
            $slot['at'] = $day->addDays($slot['next_day'] ? 1 : 0)->setTime($hour, $minute);

            return $slot;
        }, $slots);

        return new ExpectedDay(
            date: $day->toDateString(),
            timezone: $this->timezone,
            kind: 'work',
            source: $source,
            workScheduleId: $schedule->id,
            scheduleName: $schedule->name,
            label: $schedule->name,
            holidayName: $holiday,
            rules: $schedule->rules(),
            slots: $slots,
            workLocationId: $workLocationId,
        );
    }

    /** A day with nothing to scan. The schedule's rules still apply to any work done on it (overtime). */
    private function offDay(CarbonImmutable $day, string $kind, string $label, ?WorkSchedule $schedule, string $source, ?string $holiday = null): ExpectedDay
    {
        return new ExpectedDay(
            date: $day->toDateString(),
            timezone: $this->timezone,
            kind: $kind,
            source: $schedule ? $source : null,
            workScheduleId: $schedule?->id,
            scheduleName: $schedule?->name,
            label: $label,
            holidayName: $holiday,
            rules: $schedule?->rules(),
        );
    }

    private function holidayOn(CarbonImmutable $day): ?Holiday
    {
        return $this->holidays->first(fn (Holiday $holiday) => $holiday->is_recurring_yearly
            ? $holiday->date->format('m-d') === $day->format('m-d')
            : $holiday->date->toDateString() === $day->toDateString());
    }
}
