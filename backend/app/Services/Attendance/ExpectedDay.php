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
 *  - leave        approved leave for the whole day
 *  - unscheduled  no assignment covers the date
 *
 * `leave` describes approved leave on the date — the whole day (kind leave)
 * or half of it (kind work, with only the other half's slots).
 */
final class ExpectedDay
{
    /**
     * @param  array<int, array{sequence: int, type: string, time: string, next_day: bool, at: CarbonImmutable}>  $slots
     * @param  array<string, mixed>|null  $rules  the schedule's tolerance and overtime rules (null when unscheduled)
     * @param  array{request_ids: array<int>, type: string, code: ?string, portion: float, part: string, pay_percent: int}|null  $leave
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
        public readonly ?array $leave = null,
        public readonly ?array $permission = null,
    ) {}

    public function isWork(): bool
    {
        return $this->kind === 'work' && $this->slots !== [];
    }

    public function isOff(): bool
    {
        return in_array($this->kind, ['holiday', 'day_off', 'weekly_off', 'leave'], true);
    }

    /**
     * The same work day with approved permission to arrive late (the first IN
     * moves to the approved time) and / or leave early (the last OUT moves).
     * Lateness or early leave beyond the approved time still counts.
     *
     * @param  array<int, array{request_id: int, kind: string, time: string, minutes: int, pay_percent: int}>  $permits
     */
    public function withPermission(array $permits): self
    {
        $slots = $this->slots;
        $labels = [];

        foreach ($permits as $permit) {
            $index = $permit['kind'] === 'late' ? 0 : array_key_last($slots);
            [$hour, $minute] = array_map('intval', explode(':', $permit['time']));
            $at = $this->startOfDay()->setTime($hour, $minute);
            // A night shift's end is the next morning.
            if ($at->lt($slots[0]['at'])) {
                $at = $at->addDay();
            }
            $slots[$index] = [...$slots[$index], 'time' => $at->format('H:i'), 'next_day' => $at->toDateString() !== $this->date, 'at' => $at];
            $labels[] = ($permit['kind'] === 'late' ? 'Late arrival ' : 'Early leave ').$permit['time'].' (approved)';
        }

        return new self(
            date: $this->date,
            timezone: $this->timezone,
            kind: $this->kind,
            source: $this->source,
            workScheduleId: $this->workScheduleId,
            scheduleName: $this->scheduleName,
            label: trim($this->label.' · '.implode(' · ', $labels), ' ·'),
            holidayName: $this->holidayName,
            rules: $this->rules,
            slots: $slots,
            workLocationId: $this->workLocationId,
            leave: $this->leave,
            permission: $permits,
        );
    }

    /** The same day, noting leave on it without changing what is expected. */
    public function withLeave(array $leave): self
    {
        return new self(
            date: $this->date,
            timezone: $this->timezone,
            kind: $this->kind,
            source: $this->source,
            workScheduleId: $this->workScheduleId,
            scheduleName: $this->scheduleName,
            label: $this->label,
            holidayName: $this->holidayName,
            rules: $this->rules,
            slots: $this->slots,
            workLocationId: $this->workLocationId,
            leave: $leave,
        );
    }

    /**
     * The same work day with half of it on leave: only the other half's
     * slots are expected. With several IN/OUT pairs the morning is the first
     * half of them (08:00–12:00 of 08:00–12:00 + 13:00–17:00); with a single
     * pair it is split at its midpoint. The break is then outside what is
     * expected, so none comes off.
     */
    public function withHalfDayOff(string $part, array $leave): self
    {
        $pairs = array_chunk($this->slots, 2);
        $keepFrom = (int) ceil(count($pairs) / 2);

        if (count($pairs) > 1) {
            $kept = $part === 'am' ? array_slice($pairs, $keepFrom) : array_slice($pairs, 0, $keepFrom);
            $slots = array_merge(...$kept);
        } else {
            [$in, $out] = $pairs[0];
            $middle = $in['at']->addMinutes(intdiv((int) $in['at']->diffInMinutes($out['at']), 2));
            $moved = [
                'time' => $middle->format('H:i'),
                'next_day' => $middle->toDateString() !== $this->date,
                'at' => $middle,
            ];
            $slots = $part === 'am' ? [[...$in, ...$moved], $out] : [$in, [...$out, ...$moved]];
        }

        $halfLabel = $part === 'am' ? 'morning' : 'afternoon';

        return new self(
            date: $this->date,
            timezone: $this->timezone,
            kind: $this->kind,
            source: $this->source,
            workScheduleId: $this->workScheduleId,
            scheduleName: $this->scheduleName,
            label: "{$this->label} · {$leave['type']} ({$halfLabel})",
            holidayName: $this->holidayName,
            rules: [...($this->rules ?? []), 'break_minutes' => 0],
            slots: array_values($slots),
            workLocationId: $this->workLocationId,
            leave: $leave,
        );
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
            leave: $snapshot['leave'] ?? null,
            permission: $snapshot['permission'] ?? null,
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
            'leave' => $this->leave,
            'permission' => $this->permission,
        ];
    }
}
