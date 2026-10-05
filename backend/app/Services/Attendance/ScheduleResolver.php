<?php

namespace App\Services\Attendance;

use App\Models\Company;
use App\Models\DayOff;
use App\Models\EmployeeRequestDay;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Holiday;
use App\Models\RequestTypeSetting;
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
 *  1. approved leave for the whole day   → leave
 *  2. a one-day override on the roster   → that schedule's slots for the weekday
 *  3. a company holiday                  → holiday
 *  4. a one-off day off for the person   → day off
 *  5. the assignment covering the date   → weekly day off, or its slots
 *  6. nothing                            → unscheduled
 *
 * Approved leave for half a day keeps it a work day with only the other
 * half's slots expected, so the half on leave is never late or missing.
 *
 * An override beats a holiday on purpose: it is how a manager says "the
 * shop opens on this holiday and Dara works". The day is still marked as a
 * holiday, so overtime on it is counted as holiday work. Leave beats both:
 * someone on leave isn't expected at work whatever the roster says.
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

    /** @var Collection<string, Collection<int, EmployeeRequestDay>> approved leave and late / early permissions, keyed "employeeId|date" */
    private Collection $leave;

    /** Whether excused late / early time is paid (100) or not (0) — the company's setting. */
    private int $permissionPay = 100;

    /**
     * @param  iterable<int>  $employeeIds
     * @param  bool  $withLeave  false = the plain schedule, as if no leave were approved (to count a request's days)
     */
    public function __construct(private readonly Company $company, iterable $employeeIds, string $from, string $to, bool $withLeave = true)
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

        $this->leave = ! $withLeave ? collect() : EmployeeRequestDay::query()
            ->with(['request' => fn ($q) => $q->withoutGlobalScopes()->with(['leaveType' => fn ($t) => $t->withoutGlobalScopes()])])
            ->whereIn('employee_id', $ids)
            ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
            ->whereHas('request', fn ($q) => $q->withoutGlobalScopes()
                ->where('company_id', $company->id)->whereIn('type', ['leave', 'late_early'])->where('status', 'approved'))
            ->get()
            ->groupBy(fn (EmployeeRequestDay $d) => $d->employee_id.'|'.$d->date->toDateString());

        $this->permissionPay = RequestTypeSetting::forCompany($company->id, 'late_early')->pay_percent;
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
        $rows = $this->leave->get($employeeId.'|'.$date, collect());
        $expected = $this->applyLeave($employeeId, $date, $this->resolveSchedule($employeeId, $date), $rows->filter(fn (EmployeeRequestDay $d) => $d->request->type === 'leave'));

        // Approved late arrival / early leave: the day is judged against the approved time.
        $permits = $rows->filter(fn (EmployeeRequestDay $d) => $d->request->type === 'late_early');
        if ($permits->isNotEmpty() && $expected->isWork()) {
            $expected = $expected->withPermission($permits->map(fn (EmployeeRequestDay $d) => [
                'request_id' => $d->employee_request_id,
                'kind' => $d->request->details['kind'],
                'time' => $d->request->details['time'],
                'minutes' => (int) ($d->request->details['minutes'] ?? 0),
                'pay_percent' => $this->permissionPay,
            ])->values()->all());
        }

        return $expected;
    }

    /** Approved leave on the date: the whole day off, or half of it. */
    private function applyLeave(int $employeeId, string $date, ExpectedDay $expected, Collection $leave): ExpectedDay
    {
        if ($leave->isEmpty()) {
            return $expected;
        }

        $portion = min(1.0, (float) $leave->sum('portion'));
        $parts = $leave->pluck('part')->unique()->values()->all();
        // Two halves on one date (a morning and an afternoon request) are a whole day.
        $part = $portion >= 1.0 ? 'full' : $parts[0];
        $names = $leave->map(fn (EmployeeRequestDay $d) => $d->request->leaveType?->name ?? 'Leave')->unique()->join(' + ');
        $info = [
            'request_ids' => $leave->pluck('employee_request_id')->unique()->values()->all(),
            'type' => $names,
            'code' => $leave->first()->request->leaveType?->code,
            'portion' => $portion,
            'part' => $part,
            'pay_percent' => (int) ($leave->first()->request->leaveType?->pay_percent ?? 100),
        ];

        if ($part === 'full') {
            $schedule = $this->assignmentOn($employeeId, $date)?->workSchedule;

            return $this->offDay(CarbonImmutable::parse($date, $this->timezone)->startOfDay(), 'leave', $names, $schedule, 'assignment', $expected->holidayName, $info);
        }

        // Half a day with nothing expected anyway (no schedule): only noted, for payroll.
        return $expected->isWork() ? $expected->withHalfDayOff($part, $info) : $expected->withLeave($info);
    }

    /** What the schedule alone says about the date, before any leave. */
    private function resolveSchedule(int $employeeId, string $date): ExpectedDay
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
    private function offDay(CarbonImmutable $day, string $kind, string $label, ?WorkSchedule $schedule, string $source, ?string $holiday = null, ?array $leave = null): ExpectedDay
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
            leave: $leave,
        );
    }

    private function holidayOn(CarbonImmutable $day): ?Holiday
    {
        return $this->holidays->first(fn (Holiday $holiday) => $holiday->is_recurring_yearly
            ? $holiday->date->format('m-d') === $day->format('m-d')
            : $holiday->date->toDateString() === $day->toDateString());
    }
}
