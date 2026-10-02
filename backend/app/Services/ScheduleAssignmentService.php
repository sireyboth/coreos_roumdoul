<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\WorkSchedule;
use App\Services\Attendance\AttendanceRecorder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Who follows which schedule, and when. An employee's assignments form a
 * timeline with no overlaps:
 *  - a new assignment takes over from its start date — the one covering
 *    that date is ended the day before;
 *  - one with an end date dropped into the middle of an ongoing assignment
 *    splits it, so the person returns to their usual schedule afterwards
 *    ("split shift for two weeks, then back to normal");
 *  - an assignment already planned to start later is never silently
 *    removed: that is refused, with a message saying what's in the way.
 * Days already worked are recalculated against the new plan, except in a
 * locked month, which can't be touched at all.
 */
class ScheduleAssignmentService
{
    /** How far back a change will recalculate past days. */
    private const MAX_RECALCULATE_DAYS = 400;

    public function __construct(private readonly AttendanceRecorder $recorder) {}

    public function assign(Employee $employee, WorkSchedule $schedule, string $from, ?string $to, ?array $daysOff = null, ?string $notes = null): EmployeeScheduleAssignment
    {
        $this->assertNoLockedMonth($employee, $from, $to);

        $assignment = DB::transaction(function () use ($employee, $schedule, $from, $to, $daysOff, $notes) {
            $overlapping = EmployeeScheduleAssignment::query()
                ->where('employee_id', $employee->id)
                ->overlapping($from, $to)
                ->orderBy('effective_from')
                ->lockForUpdate()
                ->get();

            foreach ($overlapping as $existing) {
                $existingFrom = $existing->effective_from->toDateString();
                $existingTo = $existing->effective_to?->toDateString();

                if ($existingFrom >= $from) {
                    $name = $existing->workSchedule?->name ?? 'another schedule';
                    $when = CarbonImmutable::parse($existingFrom)->format('M j, Y');

                    throw ValidationException::withMessages([
                        'effective_from' => ["{$employee->name} is already set to follow \"{$name}\" from {$when}. Change or remove that first."],
                    ]);
                }

                // It covers our start date: it ends the day before. If it ran past our
                // end date, the rest of it continues after ours.
                if ($to !== null && ($existingTo === null || $existingTo > $to)) {
                    EmployeeScheduleAssignment::query()->create([
                        'company_id' => $existing->company_id,
                        'employee_id' => $existing->employee_id,
                        'work_schedule_id' => $existing->work_schedule_id,
                        'effective_from' => CarbonImmutable::parse($to)->addDay()->toDateString(),
                        'effective_to' => $existingTo,
                        'days_off' => $existing->days_off,
                        'notes' => $existing->notes,
                    ]);
                }

                $existing->update(['effective_to' => CarbonImmutable::parse($from)->subDay()->toDateString()]);
            }

            return EmployeeScheduleAssignment::query()->create([
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'work_schedule_id' => $schedule->id,
                'effective_from' => $from,
                'effective_to' => $to,
                'days_off' => $this->normaliseDays($daysOff ?? $schedule->default_days_off ?? []),
                'notes' => $notes,
            ]);
        });

        $this->recalculate($employee, $from, $to);

        return $assignment;
    }

    /** Changes an assignment in place. Overlaps are refused here — nothing is split or ended automatically. */
    public function update(EmployeeScheduleAssignment $assignment, array $changes): EmployeeScheduleAssignment
    {
        $employee = $assignment->employee;
        $oldFrom = $assignment->effective_from->toDateString();
        $oldTo = $assignment->effective_to?->toDateString();
        $from = $changes['effective_from'] ?? $oldFrom;
        $to = array_key_exists('effective_to', $changes) ? $changes['effective_to'] : $oldTo;

        if ($to !== null && $to < $from) {
            throw ValidationException::withMessages(['effective_to' => ['The end date can\'t be before the start date.']]);
        }

        // Both the old and the new span must be unlocked: days leave one plan and join another.
        $this->assertNoLockedMonth($employee, min($from, $oldFrom), $to === null || $oldTo === null ? null : max($to, $oldTo));

        $clash = EmployeeScheduleAssignment::query()
            ->where('employee_id', $employee->id)
            ->whereKeyNot($assignment->id)
            ->overlapping($from, $to)
            ->with('workSchedule')
            ->first();

        if ($clash) {
            $range = $clash->effective_from->format('M j, Y').($clash->effective_to ? ' – '.$clash->effective_to->format('M j, Y') : ' onward');

            throw ValidationException::withMessages([
                'effective_from' => ["That overlaps \"{$clash->workSchedule?->name}\" ({$range}). Adjust that one first."],
            ]);
        }

        if (array_key_exists('days_off', $changes)) {
            $changes['days_off'] = $this->normaliseDays($changes['days_off'] ?? []);
        }

        $assignment->update($changes);
        $this->recalculate($employee, min($from, $oldFrom), $to === null || $oldTo === null ? null : max($to, $oldTo));

        return $assignment->fresh('workSchedule');
    }

    public function remove(EmployeeScheduleAssignment $assignment): void
    {
        $employee = $assignment->employee;
        $from = $assignment->effective_from->toDateString();
        $to = $assignment->effective_to?->toDateString();

        $this->assertNoLockedMonth($employee, $from, $to);
        $assignment->delete();
        $this->recalculate($employee, $from, $to);
    }

    /**
     * Ends someone's schedules as of a date (e.g. they've left): the one
     * running then stops that day, later ones are removed.
     */
    public function endAll(Employee $employee, string $lastDay): void
    {
        EmployeeScheduleAssignment::query()->where('employee_id', $employee->id)
            ->whereDate('effective_from', '>', $lastDay)->delete();

        EmployeeScheduleAssignment::query()->where('employee_id', $employee->id)
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>', $lastDay))
            ->update(['effective_to' => $lastDay]);
    }

    /** Recalculates the past part of [from, to] — future days have nothing recorded yet. */
    private function recalculate(Employee $employee, string $from, ?string $to): void
    {
        $today = now($employee->company->timezone ?: config('attendance.default_timezone'))->toDateString();
        $end = $to === null || $to > $today ? $today : $to;
        $start = max($from, CarbonImmutable::parse($end)->subDays(self::MAX_RECALCULATE_DAYS)->toDateString());

        if ($start <= $end) {
            $this->recorder->recalculateRange($employee, $start, $end);
        }
    }

    /** Refuses a change touching a locked month (only past months can be locked). */
    private function assertNoLockedMonth(Employee $employee, string $from, ?string $to): void
    {
        $today = now($employee->company->timezone ?: config('attendance.default_timezone'))->toDateString();
        $end = CarbonImmutable::parse($to === null || $to > $today ? $today : $to)->startOfMonth();

        for ($month = CarbonImmutable::parse($from)->startOfMonth(); $month->lte($end); $month = $month->addMonth()) {
            $this->recorder->assertUnlocked($employee->company_id, $month->toDateString(), 'effective_from');
        }
    }

    private function normaliseDays(array $days): array
    {
        return collect($days)->map(fn ($d) => (int) $d)->unique()->sort()->values()->all();
    }
}
