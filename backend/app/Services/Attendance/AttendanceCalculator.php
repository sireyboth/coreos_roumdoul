<?php

namespace App\Services\Attendance;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Judges one day: the expected slots (ExpectedDay) against the actual scans.
 * Pure — no database, no clock of its own — so every rule can be tested
 * directly. AttendanceRecorder feeds it and stores what it returns.
 *
 * Rules, per the day's schedule:
 *  - Late          an IN after its slot time + the late grace, counted from the end of the grace
 *  - Early leave   an OUT before its slot time − the early-leave grace, counted to the start of it
 *  - Missing       a slot with no scan, once it is well past (or the day is closed)
 *  - Worked        the sum of each IN→OUT pair; on a day with a single pair, an
 *                  unpaid break is subtracted (people who don't scan out for lunch)
 *  - Overtime      per the schedule's overtime settings (see overtime())
 *  - Night         worked minutes falling in the night window (for payroll)
 */
final class AttendanceCalculator
{
    /**
     * @param  array<int, array{id: int|null, at: CarbonInterface, method?: string|null}>  $scans
     * @return array<string, mixed> attribute values for AttendanceDay
     */
    public static function calculate(ExpectedDay $day, array $scans, CarbonImmutable $now): array
    {
        $timezone = $day->timezone;
        $rules = $day->rules ?? [];
        $scans = self::dedupe($scans);
        $closed = $now->gte($day->closesAt());

        $slots = [];
        $extra = $scans;
        $pairs = [];
        $late = 0;
        $early = 0;
        $scheduled = 0;
        $earlyArrival = 0; // minutes before the first IN
        $stayedLate = 0;   // minutes after the last OUT

        if ($day->isWork()) {
            $pairing = ScanMatcher::match(array_column($day->slots, 'at'), array_column($scans, 'at'));
            $missingAfter = (int) config('attendance.missing_after_minutes', 120);

            foreach ($day->slots as $k => $slot) {
                $scan = $pairing[$k] === null ? null : $scans[$pairing[$k]];
                $result = [
                    'sequence' => $slot['sequence'],
                    'type' => $slot['type'],
                    'expected_at' => $slot['at']->toIso8601String(),
                    'scan_id' => $scan['id'] ?? null,
                    'actual_at' => $scan ? $scan['at']->setTimezone($timezone)->toIso8601String() : null,
                    'method' => $scan['method'] ?? null,
                    'late_minutes' => 0,
                    'early_minutes' => 0,
                ];

                if ($scan && $slot['type'] === 'in') {
                    $graceEnd = $slot['at']->addMinutes((int) ($rules['late_grace_minutes'] ?? 0));
                    $result['late_minutes'] = $scan['at']->gt($graceEnd) ? self::minutes($graceEnd, $scan['at']) : 0;
                    $result['status'] = $result['late_minutes'] > 0 ? 'late' : 'ok';
                    $late += $result['late_minutes'];
                } elseif ($scan) {
                    $allowedFrom = $slot['at']->subMinutes((int) ($rules['early_leave_grace_minutes'] ?? 0));
                    $result['early_minutes'] = $scan['at']->lt($allowedFrom) ? self::minutes($scan['at'], $allowedFrom) : 0;
                    $result['status'] = $result['early_minutes'] > 0 ? 'early' : 'ok';
                    $early += $result['early_minutes'];
                } else {
                    $result['status'] = $closed || $now->gt($slot['at']->addMinutes($missingAfter)) ? 'missing' : 'pending';
                }

                $slots[] = $result;
            }

            $firstScan = $pairing[0] === null ? null : $scans[$pairing[0]]['at'];
            $firstSlot = $day->slots[0]['at'];
            $earlyArrival = $firstScan && $firstScan->lt($firstSlot) ? self::minutes($firstScan, $firstSlot) : 0;

            $lastIndex = count($day->slots) - 1;
            $lastScan = $pairing[$lastIndex] === null ? null : $scans[$pairing[$lastIndex]]['at'];
            $lastSlot = $day->slots[$lastIndex];
            $stayedLate = $lastSlot['type'] === 'out' && $lastScan && $lastScan->gt($lastSlot['at']) ? self::minutes($lastSlot['at'], $lastScan) : 0;

            $used = array_filter($pairing, fn ($index) => $index !== null);
            $extra = array_values(array_diff_key($scans, array_flip($used)));

            // Slots run IN, OUT, IN, OUT …: each IN with the OUT after it is one stretch of work.
            for ($p = 0; $p + 1 < count($day->slots); $p += 2) {
                $scheduled += self::minutes($day->slots[$p]['at'], $day->slots[$p + 1]['at']);
                $in = $pairing[$p] === null ? null : $scans[$pairing[$p]]['at'];
                $out = $pairing[$p + 1] === null ? null : $scans[$pairing[$p + 1]]['at'];
                if ($in && $out && $out->gt($in)) {
                    $pairs[] = [$in, $out];
                }
            }
        } else {
            // Nothing expected (day off, holiday, unscheduled): scans pair up in order.
            for ($i = 0; $i + 1 < count($scans); $i += 2) {
                $pairs[] = [$scans[$i]['at'], $scans[$i + 1]['at']];
            }
            $extra = [];
        }

        $worked = array_sum(array_map(fn (array $pair) => self::minutes($pair[0], $pair[1]), $pairs));

        // A single IN/OUT pair spans the break, so an unpaid one comes off. With more
        // pairs the break is the gap between them and was never counted.
        if ($day->isWork() && count($day->slots) === 2 && ! ($rules['is_break_paid'] ?? false)) {
            $break = (int) ($rules['break_minutes'] ?? 0);
            $scheduled = max(0, $scheduled - $break);
            if ($pairs !== []) {
                $worked = max(0, $worked - $break);
            }
        }

        $night = array_sum(array_map(fn (array $pair) => self::nightMinutes($pair[0], $pair[1], $timezone), $pairs));
        [$overtime, $overtimeType] = self::overtime($day, $rules, $worked, $scheduled, $earlyArrival, $stayedLate);
        $overtimeStatus = $overtime > 0 ? (($rules['overtime_requires_approval'] ?? false) ? 'pending' : 'approved') : null;

        $status = self::status($day, $slots, $scans, $closed);
        $exceptions = self::exceptions($day, $slots, $scans, $extra, $closed, $late, $early, $overtimeStatus);

        // Every scan with the part it played: the IN/OUT it answered, "extra" if
        // it answered nothing, or — on a day with no slots — IN/OUT by pairing order.
        $roles = [];
        foreach ($slots as $slot) {
            if ($slot['scan_id'] !== null) {
                $roles[$slot['scan_id']] = $slot['type'];
            }
        }
        $allScans = array_map(fn (array $scan, int $i) => [
            'scan_id' => $scan['id'],
            'at' => $scan['at']->setTimezone($timezone)->toIso8601String(),
            'method' => $scan['method'] ?? null,
            'role' => $day->isWork() ? ($roles[$scan['id']] ?? 'extra') : ($i % 2 === 0 ? 'in' : 'out'),
        ], $scans, array_keys($scans));

        return [
            'kind' => $day->kind,
            'source' => $day->source,
            'work_schedule_id' => $day->workScheduleId,
            'label' => $day->label,
            'expected' => $day->snapshot(),
            'scans' => $allScans,
            'slots' => $slots,
            'extra_scans' => array_map(fn (array $scan) => [
                'scan_id' => $scan['id'],
                'at' => $scan['at']->setTimezone($timezone)->toIso8601String(),
                'method' => $scan['method'] ?? null,
            ], $extra),
            'scan_count' => count($scans),
            'first_scan_at' => $scans === [] ? null : $scans[0]['at'],
            'last_scan_at' => $scans === [] ? null : end($scans)['at'],
            'status' => $status,
            'is_closed' => $closed,
            'scheduled_minutes' => $scheduled,
            'worked_minutes' => $worked,
            'late_minutes' => $late,
            'early_leave_minutes' => $early,
            'night_minutes' => $night,
            'overtime_minutes' => $overtime,
            'overtime_type' => $overtime > 0 ? $overtimeType : null,
            'overtime_status' => $overtimeStatus,
            'exceptions' => $exceptions,
            'calculated_at' => $now,
        ];
    }

    /**
     * Overtime, as the company set it up on the schedule:
     *  - off              never
     *  - after_last_out   minutes stayed past the last OUT (+ early arrival, if counted)
     *  - above_scheduled  worked minutes beyond the scheduled minutes (early arrival only if counted)
     * Work on a day off or holiday is overtime in full (unless overtime is off).
     * Below the minimum it is ignored; above it, rounded down to the rounding step.
     *
     * @return array{0: int, 1: string} [minutes, type]
     */
    private static function overtime(ExpectedDay $day, array $rules, int $worked, int $scheduled, int $earlyArrival, int $stayedLate): array
    {
        $mode = $rules['overtime_mode'] ?? 'off';
        $type = $day->holidayName !== null ? 'holiday' : ($day->isOff() ? 'day_off' : 'workday');

        if ($mode === 'off' || $rules === []) {
            return [0, $type];
        }

        if ($day->isWork()) {
            $countEarly = (bool) ($rules['overtime_count_early'] ?? false);

            $raw = $mode === 'after_last_out'
                ? $stayedLate + ($countEarly ? $earlyArrival : 0)
                : max(0, $worked - ($countEarly ? 0 : $earlyArrival) - $scheduled);
        } else {
            $raw = $day->isOff() ? $worked : 0;
        }

        if ($raw < (int) ($rules['overtime_min_minutes'] ?? 0)) {
            return [0, $type];
        }

        $round = (int) ($rules['overtime_round_minutes'] ?? 0);

        return [$round > 0 ? intdiv($raw, $round) * $round : $raw, $type];
    }

    private static function status(ExpectedDay $day, array $slots, array $scans, bool $closed): string
    {
        if ($day->isWork()) {
            if ($scans === []) {
                return $closed ? 'absent' : 'upcoming';
            }
            if (collect($slots)->every(fn (array $slot) => $slot['scan_id'] !== null || $slot['actual_at'] !== null)) {
                return 'complete';
            }

            return $closed ? 'incomplete' : 'in_progress';
        }

        if ($day->kind === 'unscheduled') {
            return 'unscheduled';
        }

        return $scans === [] ? 'off' : 'worked_off';
    }

    /** @return array<int, string> */
    private static function exceptions(ExpectedDay $day, array $slots, array $scans, array $extra, bool $closed, int $late, int $early, ?string $overtimeStatus): array
    {
        $found = [];

        if ($day->isWork() && $scans === [] && $closed) {
            $found[] = 'absent';
        } else {
            if ($late > 0) {
                $found[] = 'late';
            }
            if ($early > 0) {
                $found[] = 'early_leave';
            }
            foreach ($slots as $slot) {
                if ($slot['status'] === 'missing' && $scans !== []) {
                    $found[] = $slot['type'] === 'in' ? 'missing_in' : 'missing_out';
                }
            }
            // A day off / unscheduled day left with an odd number of scans never got its OUT.
            if (! $day->isWork() && $closed && count($scans) % 2 === 1) {
                $found[] = 'missing_out';
            }
        }

        if ($extra !== []) {
            $found[] = 'extra_scan';
        }
        if ($scans !== []) {
            if ($day->holidayName !== null) {
                $found[] = 'worked_holiday';
            } elseif (in_array($day->kind, ['day_off', 'weekly_off', 'leave'], true)) {
                $found[] = 'worked_day_off';
            } elseif ($day->kind === 'unscheduled') {
                $found[] = 'unscheduled_work';
            }
        }
        if ($overtimeStatus === 'pending') {
            $found[] = 'overtime_pending';
        }

        return array_values(array_unique($found));
    }

    /**
     * Sorted, with double taps removed: a scan within duplicate_scan_minutes
     * of the previous kept scan is the same scan.
     */
    private static function dedupe(array $scans): array
    {
        usort($scans, fn (array $a, array $b) => $a['at']->getTimestamp() <=> $b['at']->getTimestamp());
        $window = (int) config('attendance.duplicate_scan_minutes', 2) * 60;
        $kept = [];

        foreach ($scans as $scan) {
            $previous = end($kept);
            if ($previous && $scan['at']->getTimestamp() - $previous['at']->getTimestamp() < $window) {
                continue;
            }
            $kept[] = $scan;
        }

        return $kept;
    }

    /** Minutes of [from, to] that fall inside the night window (e.g. 22:00–05:00), on the company's clock. */
    private static function nightMinutes(CarbonInterface $from, CarbonInterface $to, string $timezone): int
    {
        [$startHour, $startMinute] = array_map('intval', explode(':', config('attendance.night_start', '22:00')));
        [$endHour, $endMinute] = array_map('intval', explode(':', config('attendance.night_end', '05:00')));
        $from = CarbonImmutable::instance($from)->setTimezone($timezone);
        $to = CarbonImmutable::instance($to)->setTimezone($timezone);
        $total = 0;

        // Each night starts on a calendar day; check the nights touching this stretch.
        for ($day = $from->startOfDay()->subDay(); $day->lte($to); $day = $day->addDay()) {
            $nightStart = $day->setTime($startHour, $startMinute);
            $nightEnd = $day->addDay()->setTime($endHour, $endMinute);
            $overlapStart = $from->max($nightStart);
            $overlapEnd = $to->min($nightEnd);
            if ($overlapEnd->gt($overlapStart)) {
                $total += self::minutes($overlapStart, $overlapEnd);
            }
        }

        return $total;
    }

    private static function minutes(CarbonInterface $from, CarbonInterface $to): int
    {
        return (int) round(($to->getTimestamp() - $from->getTimestamp()) / 60);
    }
}
