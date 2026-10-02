<?php

namespace App\Services\Attendance;

use Carbon\CarbonImmutable;

/**
 * What one employee was expected to do on one date — the "schedule" side of
 * "schedule = expected, attendance = actual". Built by ScheduleResolver,
 * judged against scans by AttendanceCalculator.
 *
 * kind:
 *  - work         slots to scan (from an assignment or a one-day override)
 *  - holiday      a company holiday
 *  - day_off      a one-off day off for this person
 *  - weekly_off   one of this person's weekly days off, or a weekday their
 *                 schedule has no slots on
 *  - unscheduled  no assignment covers the date
 */
final class ExpectedDay
{
    /**
     * @param  array<int, array{sequence: int, type: string, time: string, next_day: bool, at: CarbonImmutable}>  $slots
     * @param  array<string, mixed>|null  $rules  the schedule's tolerance and overtime rules (null when unscheduled)
     */
    public function __construct(
        public readonly string $date,
        public readonly string $timezone,
        public readonly string $kind,
        public readonly ?string $source = null,
        public readonly ?int $workScheduleId = null,
        public readonly ?string $scheduleName = null,
        public readonly ?string $label = null,
        public readonly ?string $holidayName = null,
        public readonly ?array $rules = null,
        public readonly array $slots = [],
        public readonly ?int $workLocationId = null,
    ) {}

    public function isWork(): bool
    {
        return $this->kind === 'work' && $this->slots !== [];
    }

    public function isOff(): bool
    {
        return in_array($this->kind, ['holiday', 'day_off', 'weekly_off'], true);
    }

    public function firstSlotAt(): ?CarbonImmutable
    {
        return $this->slots[0]['at'] ?? null;
    }

    public function lastSlotAt(): ?CarbonImmutable
    {
        return $this->slots === [] ? null : $this->slots[array_key_last($this->slots)]['at'];
    }

    /** True when the last slot is on the next calendar day (a night shift). */
    public function crossesMidnight(): bool
    {
        return $this->slots !== [] && (bool) $this->slots[array_key_last($this->slots)]['next_day'];
    }

    /** Local midnight at the start of this date. */
    public function startOfDay(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->date, $this->timezone)->startOfDay();
    }

    /**
     * When this day's result becomes final: some time after the last slot
     * (to allow a late OUT or overtime), or after the day itself for a day
     * with nothing to scan.
     */
    public function closesAt(): CarbonImmutable
    {
        $after = (int) config('attendance.close_after_minutes', 240);

        return ($this->lastSlotAt() ?? $this->startOfDay()->addDay())->addMinutes($after);
    }

    /**
     * Rebuilds an expectation from a day's stored snapshot — used when a
     * closed day is recalculated, so later edits to the schedule's times or
     * rules never rewrite history.
     */
    public static function fromSnapshot(string $date, string $timezone, array $snapshot, ?string $label = null, ?int $workLocationId = null): self
    {
        return new self(
            date: $date,
            timezone: $timezone,
            kind: $snapshot['kind'],
            source: $snapshot['source'] ?? null,
            workScheduleId: $snapshot['work_schedule_id'] ?? null,
            scheduleName: $snapshot['schedule_name'] ?? null,
            label: $label,
            holidayName: $snapshot['holiday'] ?? null,
            rules: $snapshot['rules'] ?? null,
            slots: array_map(fn (array $slot) => [
                'sequence' => $slot['sequence'],
                'type' => $slot['type'],
                'time' => $slot['time'],
                'next_day' => $slot['next_day'],
                'at' => CarbonImmutable::parse($slot['at'])->setTimezone($timezone),
            ], $snapshot['slots'] ?? []),
            workLocationId: $workLocationId,
        );
    }

    /** Frozen copy stored on the day, so later edits to the schedule don't rewrite history. */
    public function snapshot(): array
    {
        return [
            'kind' => $this->kind,
            'source' => $this->source,
            'work_schedule_id' => $this->workScheduleId,
            'schedule_name' => $this->scheduleName,
            'holiday' => $this->holidayName,
            'rules' => $this->rules,
            'slots' => array_map(fn (array $slot) => [
                'sequence' => $slot['sequence'],
                'type' => $slot['type'],
                'time' => $slot['time'],
                'next_day' => $slot['next_day'],
                'at' => $slot['at']->toIso8601String(),
            ], $this->slots),
        ];
    }
}
