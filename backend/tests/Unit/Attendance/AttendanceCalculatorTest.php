<?php

namespace Tests\Unit\Attendance;

use App\Services\Attendance\AttendanceCalculator;
use App\Services\Attendance\ExpectedDay;
use App\Services\Attendance\ScanMatcher;
use Carbon\CarbonImmutable;
use Tests\TestCase;

/**
 * The rules of the attendance engine, checked directly: no database, a fixed
 * clock. Times are Phnom Penh time.
 */
class AttendanceCalculatorTest extends TestCase
{
    private const TZ = 'Asia/Phnom_Penh';

    private const DATE = '2026-10-05'; // a Monday

    private function at(string $time, string $date = self::DATE): CarbonImmutable
    {
        return CarbonImmutable::parse("{$date} {$time}", self::TZ);
    }

    /** @param array<int, array{0: string, 1: string, 2?: bool}> $slots [type, time, next_day] */
    private function workDay(array $slots, array $rules = [], ?string $holiday = null, string $kind = 'work'): ExpectedDay
    {
        $built = [];
        foreach ($slots as $i => $slot) {
            $nextDay = $slot[2] ?? false;
            $built[] = [
                'sequence' => $i + 1,
                'type' => $slot[0],
                'time' => $slot[1],
                'next_day' => $nextDay,
                'at' => $this->at($slot[1], $nextDay ? '2026-10-06' : self::DATE),
            ];
        }

        return new ExpectedDay(
            date: self::DATE,
            timezone: self::TZ,
            kind: $kind,
            source: 'assignment',
            workScheduleId: 1,
            scheduleName: 'Test',
            label: 'Test',
            holidayName: $holiday,
            rules: array_merge([
                'late_grace_minutes' => 0, 'early_leave_grace_minutes' => 0, 'break_minutes' => 0, 'is_break_paid' => false,
                'overtime_mode' => 'off', 'overtime_min_minutes' => 0, 'overtime_count_early' => false,
                'overtime_round_minutes' => 0, 'overtime_requires_approval' => false,
            ], $rules),
            slots: $built,
        );
    }

    private function offDay(string $kind, array $rules = [], ?string $holiday = null): ExpectedDay
    {
        return new ExpectedDay(self::DATE, self::TZ, $kind, 'assignment', 1, 'Test', 'Off', $holiday, $rules === [] ? null : array_merge([
            'overtime_mode' => 'off', 'overtime_min_minutes' => 0, 'overtime_round_minutes' => 0, 'overtime_requires_approval' => false,
        ], $rules));
    }

    private function scans(string ...$times): array
    {
        return array_map(fn (string $t, int $i) => ['id' => $i + 1, 'at' => str_contains($t, ' ') ? CarbonImmutable::parse($t, self::TZ) : $this->at($t), 'method' => 'qr'], $times, array_keys($times));
    }

    private function calc(ExpectedDay $day, array $scans, string $now = '2026-10-06 12:00'): array
    {
        return AttendanceCalculator::calculate($day, $scans, CarbonImmutable::parse($now, self::TZ));
    }

    private function split(array $rules = []): ExpectedDay
    {
        return $this->workDay([['in', '08:00'], ['out', '12:00'], ['in', '13:00'], ['out', '17:00']], $rules);
    }

    // ───────────── Matching ─────────────

    public function test_a_forgotten_lunch_scan_does_not_shift_the_later_scans(): void
    {
        $expected = [$this->at('08:00'), $this->at('12:00'), $this->at('13:00'), $this->at('17:00')];
        $scans = [$this->at('08:07'), $this->at('13:02'), $this->at('17:15')];

        $this->assertSame([0, null, 1, 2], ScanMatcher::match($expected, $scans));
    }

    public function test_a_forgotten_afternoon_in_is_the_one_reported_missing(): void
    {
        $expected = [$this->at('08:00'), $this->at('12:00'), $this->at('13:00'), $this->at('17:00')];
        $scans = [$this->at('07:58'), $this->at('12:01'), $this->at('17:03')];

        $this->assertSame([0, 1, null, 2], ScanMatcher::match($expected, $scans));
    }

    public function test_a_scan_far_from_every_slot_is_left_unmatched(): void
    {
        $expected = [$this->at('08:00'), $this->at('17:00')];
        $scans = [$this->at('08:00'), $this->at('17:00'), $this->at('23:50')];

        $this->assertSame([0, 1], ScanMatcher::match($expected, $scans));
    }

    // ───────────── Two and four scans ─────────────

    public function test_a_normal_two_scan_day(): void
    {
        $result = $this->calc($this->workDay([['in', '08:00'], ['out', '17:00']]), $this->scans('07:55', '17:02'));

        $this->assertSame('complete', $result['status']);
        $this->assertSame(0, $result['late_minutes']);
        $this->assertSame(547, $result['worked_minutes']);
        $this->assertSame(540, $result['scheduled_minutes']);
        $this->assertSame([], $result['exceptions']);
    }

    public function test_a_split_shift_with_four_scans(): void
    {
        $result = $this->calc($this->split(), $this->scans('08:00', '12:00', '13:00', '17:00'));

        $this->assertSame('complete', $result['status']);
        $this->assertSame(480, $result['worked_minutes']); // 4h + 4h; the lunch hour isn't worked
        $this->assertSame(480, $result['scheduled_minutes']);
    }

    public function test_any_number_of_slots_works(): void
    {
        $sixScans = $this->workDay([['in', '06:00'], ['out', '09:00'], ['in', '11:00'], ['out', '14:00'], ['in', '17:00'], ['out', '20:00']]);

        $result = $this->calc($sixScans, $this->scans('06:00', '09:00', '11:00', '14:00', '17:00', '20:00'));

        $this->assertSame('complete', $result['status']);
        $this->assertCount(6, $result['slots']);
        $this->assertSame(540, $result['worked_minutes']);
    }

    // ───────────── Late, early, missing ─────────────

    public function test_lateness_counts_from_the_end_of_the_grace_period(): void
    {
        $result = $this->calc($this->split(['late_grace_minutes' => 5]), $this->scans('08:12', '12:00', '13:03', '17:00'));

        $this->assertSame(7, $result['late_minutes']); // 08:12 vs 08:05; 13:03 is inside the grace
        $this->assertSame('late', $result['slots'][0]['status']);
        $this->assertSame('ok', $result['slots'][2]['status']);
        $this->assertContains('late', $result['exceptions']);
    }

    public function test_leaving_early_counts_to_the_start_of_the_allowance(): void
    {
        $result = $this->calc($this->split(['early_leave_grace_minutes' => 5]), $this->scans('08:00', '11:40', '13:00', '17:00'));

        $this->assertSame(15, $result['early_leave_minutes']); // 11:40 vs 11:55
        $this->assertSame('early', $result['slots'][1]['status']);
        $this->assertContains('early_leave', $result['exceptions']);
    }

    public function test_a_forgotten_scan_is_missing_and_its_pair_is_not_counted_as_worked(): void
    {
        $result = $this->calc($this->split(), $this->scans('08:00', '13:00', '17:00'));

        $this->assertSame('incomplete', $result['status']);
        $this->assertSame('missing', $result['slots'][1]['status']);
        $this->assertContains('missing_out', $result['exceptions']);
        $this->assertSame(240, $result['worked_minutes']); // only 13:00–17:00 is a complete pair
    }

    public function test_a_slot_not_yet_due_is_pending_not_missing(): void
    {
        $result = $this->calc($this->split(), $this->scans('08:00'), now: '2026-10-05 09:30');

        $this->assertSame('in_progress', $result['status']);
        $this->assertSame('pending', $result['slots'][1]['status']);
        $this->assertSame([], $result['exceptions']);
    }

    public function test_no_scans_is_upcoming_during_the_day_and_absent_once_it_closes(): void
    {
        $this->assertSame('upcoming', $this->calc($this->split(), [], now: '2026-10-05 07:00')['status']);

        $closed = $this->calc($this->split(), [], now: '2026-10-06 09:00');
        $this->assertSame('absent', $closed['status']);
        $this->assertSame(['absent'], $closed['exceptions']);
    }

    public function test_a_double_tap_counts_once(): void
    {
        $result = $this->calc($this->workDay([['in', '08:00'], ['out', '17:00']]), $this->scans('08:00', '08:01', '17:00'));

        $this->assertSame(2, $result['scan_count']);
        $this->assertSame([], $result['extra_scans']);
    }

    public function test_an_unmatched_scan_is_kept_and_flagged(): void
    {
        $result = $this->calc($this->workDay([['in', '08:00'], ['out', '17:00']]), $this->scans('08:00', '17:00', '23:50'));

        $this->assertCount(1, $result['extra_scans']);
        $this->assertContains('extra_scan', $result['exceptions']);
    }

    // ───────────── Breaks ─────────────

    public function test_an_unpaid_break_comes_off_a_single_pair_day_only(): void
    {
        $normal = $this->workDay([['in', '08:00'], ['out', '17:00']], ['break_minutes' => 60]);
        $this->assertSame(480, $this->calc($normal, $this->scans('08:00', '17:00'))['worked_minutes']);

        $paid = $this->workDay([['in', '08:00'], ['out', '17:00']], ['break_minutes' => 60, 'is_break_paid' => true]);
        $this->assertSame(540, $this->calc($paid, $this->scans('08:00', '17:00'))['worked_minutes']);

        // With a lunch OUT/IN the break is already the gap between the pairs.
        $this->assertSame(480, $this->calc($this->split(['break_minutes' => 60]), $this->scans('08:00', '12:00', '13:00', '17:00'))['worked_minutes']);
    }

    // ───────────── Night shift ─────────────

    public function test_a_night_shift_ends_the_next_morning(): void
    {
        $night = $this->workDay([['in', '22:00'], ['out', '06:00', true]]);

        $result = $this->calc($night, $this->scans('2026-10-05 21:58', '2026-10-06 06:05'), now: '2026-10-06 12:00');

        $this->assertSame('complete', $result['status']);
        $this->assertSame(487, $result['worked_minutes']);
        $this->assertSame(420, $result['night_minutes']); // 22:00–05:00
    }

    // ───────────── Overtime ─────────────

    public function test_overtime_off_records_none(): void
    {
        $result = $this->calc($this->workDay([['in', '08:00'], ['out', '17:00']]), $this->scans('08:00', '19:00'));

        $this->assertSame(0, $result['overtime_minutes']);
    }

    public function test_overtime_after_the_last_out(): void
    {
        $day = $this->workDay([['in', '08:00'], ['out', '17:00']], ['overtime_mode' => 'after_last_out']);

        $result = $this->calc($day, $this->scans('07:30', '18:10'));

        $this->assertSame(70, $result['overtime_minutes']); // early arrival not counted
        $this->assertSame('workday', $result['overtime_type']);
        $this->assertSame('approved', $result['overtime_status']);
    }

    public function test_early_arrival_counts_when_the_schedule_says_so(): void
    {
        $day = $this->workDay([['in', '08:00'], ['out', '17:00']], ['overtime_mode' => 'after_last_out', 'overtime_count_early' => true]);

        $this->assertSame(100, $this->calc($day, $this->scans('07:30', '18:10'))['overtime_minutes']);
    }

    public function test_overtime_above_scheduled_hours(): void
    {
        $day = $this->split(['overtime_mode' => 'above_scheduled']);

        // 07:30–12:00 + 13:00–18:00 = 570 worked; 30 min early isn't counted; 480 scheduled.
        $this->assertSame(60, $this->calc($day, $this->scans('07:30', '12:00', '13:00', '18:00'))['overtime_minutes']);
    }

    public function test_short_overtime_is_ignored_and_the_rest_is_rounded_down(): void
    {
        $rules = ['overtime_mode' => 'after_last_out', 'overtime_min_minutes' => 30, 'overtime_round_minutes' => 15];

        $short = $this->workDay([['in', '08:00'], ['out', '17:00']], $rules);
        $this->assertSame(0, $this->calc($short, $this->scans('08:00', '17:20'))['overtime_minutes']);

        $this->assertSame(45, $this->calc($short, $this->scans('08:00', '17:50'))['overtime_minutes']);
    }

    public function test_overtime_waits_for_approval_when_required(): void
    {
        $day = $this->workDay([['in', '08:00'], ['out', '17:00']], ['overtime_mode' => 'after_last_out', 'overtime_requires_approval' => true]);

        $result = $this->calc($day, $this->scans('08:00', '18:00'));

        $this->assertSame('pending', $result['overtime_status']);
        $this->assertContains('overtime_pending', $result['exceptions']);
    }

    public function test_work_on_a_day_off_or_holiday_is_overtime_of_that_kind(): void
    {
        $dayOff = $this->calc($this->offDay('weekly_off', ['overtime_mode' => 'after_last_out']), $this->scans('09:00', '13:00'));
        $this->assertSame('worked_off', $dayOff['status']);
        $this->assertSame(240, $dayOff['overtime_minutes']);
        $this->assertSame('day_off', $dayOff['overtime_type']);
        $this->assertContains('worked_day_off', $dayOff['exceptions']);

        $holiday = $this->calc($this->offDay('holiday', ['overtime_mode' => 'after_last_out'], 'Khmer New Year'), $this->scans('09:00', '13:00'));
        $this->assertSame('holiday', $holiday['overtime_type']);
        $this->assertContains('worked_holiday', $holiday['exceptions']);
    }

    public function test_a_day_off_with_no_scans_is_just_off(): void
    {
        $result = $this->calc($this->offDay('weekly_off'), []);

        $this->assertSame('off', $result['status']);
        $this->assertSame([], $result['exceptions']);
    }

    public function test_scans_without_any_schedule_are_paired_and_flagged(): void
    {
        $unscheduled = new ExpectedDay(self::DATE, self::TZ, 'unscheduled');

        $result = $this->calc($unscheduled, $this->scans('09:00', '12:00'));

        $this->assertSame('unscheduled', $result['status']);
        $this->assertSame(180, $result['worked_minutes']);
        $this->assertSame(0, $result['overtime_minutes']);
        $this->assertContains('unscheduled_work', $result['exceptions']);
    }

    public function test_the_snapshot_keeps_what_was_expected(): void
    {
        $result = $this->calc($this->split(['late_grace_minutes' => 5]), []);

        $this->assertSame('Test', $result['expected']['schedule_name']);
        $this->assertSame(5, $result['expected']['rules']['late_grace_minutes']);
        $this->assertSame(['in', 'out', 'in', 'out'], array_column($result['expected']['slots'], 'type'));
    }
}
