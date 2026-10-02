<?php

namespace App\Services\Attendance;

use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\AttendancePeriod;
use App\Models\Company;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Keeps AttendanceDay rows in step with their inputs. Whenever anything that
 * affects a day changes — a scan, an approved correction, an override, an
 * assignment, a holiday — the day is recalculated from scratch: resolve what
 * was expected, gather the day's scans, judge them, save the result.
 *
 * Days in a locked month are never recalculated.
 */
class AttendanceRecorder
{
    /** @var array<string, bool> "companyId|YYYY-MM" => locked, for the life of the request */
    private array $lockCache = [];

    /**
     * Which work date a scan belongs to. Normally its own calendar date — but
     * when the previous day's schedule runs past midnight (a 22:00→06:00 night
     * shift), an early-morning scan closes that shift rather than opening a
     * new day. The cut-off is halfway between the night shift's end and the
     * new day's first slot (or a few hours after the shift if none).
     */
    public function workDateFor(Employee $employee, CarbonInterface $at, ?ScheduleResolver $resolver = null): string
    {
        $timezone = $this->timezone($employee);
        $local = CarbonImmutable::instance($at)->setTimezone($timezone);
        $date = $local->toDateString();
        $previousDate = $local->subDay()->toDateString();

        $resolver ??= ScheduleResolver::around($employee->company, $employee->id, $date);
        $previous = $resolver->resolve($employee->id, $previousDate);

        if (! $previous->crossesMidnight()) {
            return $date;
        }

        $nightEnds = $previous->lastSlotAt();
        $today = $resolver->resolve($employee->id, $date);
        $todayStarts = $today->isWork() ? $today->firstSlotAt() : null;

        $boundary = $todayStarts && $todayStarts->gt($nightEnds)
            ? $nightEnds->addSeconds(intdiv($todayStarts->getTimestamp() - $nightEnds->getTimestamp(), 2))
            : $nightEnds->addMinutes((int) config('attendance.close_after_minutes', 240));

        return $local->lt($boundary) ? $previousDate : $date;
    }

    /** Recalculates one day. Returns the saved day, or null when there is nothing to keep. */
    public function recalculate(Employee $employee, string $date): ?AttendanceDay
    {
        return $this->recalculateRange($employee, $date, $date)->first();
    }

    /**
     * Recalculates every day from $from to $to (inclusive) for one employee,
     * sharing one schedule lookup and one scan query across the range.
     *
     * @return Collection<string, AttendanceDay|null> keyed by date
     */
    public function recalculateRange(Employee $employee, string $from, string $to): Collection
    {
        $timezone = $this->timezone($employee);
        $start = CarbonImmutable::parse($from, $timezone)->startOfDay();
        $end = CarbonImmutable::parse($to, $timezone)->startOfDay();
        $resolver = new ScheduleResolver($employee->company, [$employee->id], $start->subDay()->toDateString(), $end->addDays(2)->toDateString());

        // Every scan that could belong to these days: from the evening before to two mornings after.
        $events = AttendanceEvent::query()->withoutGlobalScopes()
            ->where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id)
            ->where('event_time', '>=', $start->subDay()->utc())
            ->where('event_time', '<', $end->addDays(2)->utc())
            ->orderBy('event_time')
            ->get()
            ->groupBy(fn (AttendanceEvent $event) => $this->workDateFor($employee, $event->event_time, $resolver));

        $results = collect();
        for ($day = $start; $day->lte($end); $day = $day->addDay()) {
            $date = $day->toDateString();
            $results[$date] = $this->store($employee, $resolver->resolve($employee->id, $date), $events->get($date, collect()));
        }

        return $results;
    }

    /**
     * Saves the calculated day. Days with nothing to show are not kept: a day
     * off nobody worked, an unscheduled day without scans, a future work day.
     * A review decision on overtime survives recalculation as long as the
     * overtime itself didn't change.
     */
    private function store(Employee $employee, ExpectedDay $expected, Collection $events): ?AttendanceDay
    {
        $existing = AttendanceDay::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)->whereDate('date', $expected->date)->first();

        if ($this->isLocked($employee->company_id, $expected->date)) {
            return $existing;
        }

        // A closed day still on the same schedule keeps the expectation it was
        // judged by: editing a schedule's times or rules changes the future,
        // not days already done. (Changing WHICH schedule applies — another
        // assignment, an override, a holiday — is a deliberate correction and
        // does take effect.)
        $now = CarbonImmutable::now();

        if ($existing?->expected
            && $existing->kind === $expected->kind
            && $existing->source === $expected->source
            && $existing->work_schedule_id === $expected->workScheduleId) {
            $frozen = ExpectedDay::fromSnapshot($expected->date, $expected->timezone, $existing->expected, $expected->label, $expected->workLocationId);

            // "Finished" by the clock, not only by the stored flag — a day nobody
            // has recalculated since it ended is still finished.
            if ($existing->is_closed || $now->gte($frozen->closesAt())) {
                $expected = $frozen;
            }
        }
        $isFuture = $expected->date > $now->setTimezone($expected->timezone)->toDateString();

        // Someone who has left isn't absent from work they no longer have.
        $hasLeft = $employee->hasLeft()
            && ($employee->termination_date === null || $expected->date > $employee->termination_date->toDateString());

        if ($events->isEmpty() && (! $expected->isWork() || $isFuture || $hasLeft)) {
            $existing?->delete();

            return null;
        }

        $scans = $events->map(fn (AttendanceEvent $event) => [
            'id' => $event->id,
            'at' => CarbonImmutable::instance($event->event_time),
            'method' => $event->method,
        ])->values()->all();

        $attributes = AttendanceCalculator::calculate($expected, $scans, $now);

        if ($existing
            && in_array($existing->overtime_status, ['approved', 'rejected'], true)
            && $existing->overtime_reviewed_by !== null
            && $existing->overtime_minutes === $attributes['overtime_minutes']
            && $existing->overtime_type === $attributes['overtime_type']) {
            $attributes['overtime_status'] = $existing->overtime_status;
            $attributes['exceptions'] = array_values(array_diff($attributes['exceptions'], ['overtime_pending']));
        } else {
            $attributes['overtime_reviewed_by'] = null;
            $attributes['overtime_reviewed_at'] = null;
        }

        $day = $existing ?? new AttendanceDay([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'date' => $expected->date,
        ]);
        $day->fill($attributes)->save();

        return $day;
    }

    /** Recalculates the day before $date if it is still open, so it closes as soon as possible. */
    public function settlePreviousDay(Employee $employee, string $date): void
    {
        $previous = CarbonImmutable::parse($date)->subDay()->toDateString();
        $open = AttendanceDay::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)->whereDate('date', $previous)->where('is_closed', false)->exists();

        if ($open) {
            $this->recalculate($employee, $previous);
        }
    }

    /**
     * Recalculates the given dates for everyone in a company — after a
     * company-wide change such as a holiday being added, moved or removed.
     * Only dates that have already started matter; locked months are skipped
     * by store() as usual.
     *
     * @param  iterable<string>  $dates
     */
    public function recalculateDatesForCompany(Company $company, iterable $dates): void
    {
        $today = now($company->timezone ?: config('attendance.default_timezone'))->toDateString();
        $dates = collect($dates)->filter(fn (string $date) => $date <= $today)->unique()->sort()->values();

        if ($dates->isEmpty()) {
            return;
        }

        Employee::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->with('company')
            ->each(function (Employee $employee) use ($dates) {
                foreach ($dates as $date) {
                    $this->recalculate($employee, $date);
                }
            });
    }

    public function isLocked(int $companyId, string $date): bool
    {
        $key = $companyId.'|'.substr($date, 0, 7);

        return $this->lockCache[$key] ??= AttendancePeriod::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('month', substr($date, 0, 7))
            ->exists();
    }

    /** Forget cached lock answers (after a month is locked or reopened). */
    public function forgetLocks(): void
    {
        $this->lockCache = [];
    }

    /** Refuses a change to attendance in a locked month. */
    public function assertUnlocked(int $companyId, string $date, string $field = 'date'): void
    {
        if ($this->isLocked($companyId, $date)) {
            $month = CarbonImmutable::parse($date)->format('F Y');

            throw ValidationException::withMessages([
                $field => ["{$month} is locked for payroll, so its attendance can't be changed. Ask an admin to reopen it."],
            ]);
        }
    }

    private function timezone(Employee $employee): string
    {
        return $employee->company?->timezone ?: config('attendance.default_timezone');
    }
}
