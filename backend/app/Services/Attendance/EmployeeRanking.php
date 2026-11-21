<?php

namespace App\Services\Attendance;

use App\Models\AttendanceDay;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * "Top employees": everyone ranked on one month of attendance.
 *
 *   score = 60 × attendance + 40 × on time        (out of 100)
 *   attendance = days they came ÷ days they were scheduled to work
 *   on time    = days they came on time ÷ days they came
 *
 * Fair by design:
 *  - Only finished days count (before today in the company's timezone).
 *  - Only scheduled work days count: approved leave, holidays and days off
 *    are other kinds of day, so they never lower anyone's score. A late
 *    arrival approved in advance is judged against the approved time.
 *  - At least MIN_DAYS scheduled days to be ranked, so a new starter isn't
 *    compared on one day; people who have left aren't ranked.
 *  - Ties: more days present first (steady attendance), then fewer late
 *    minutes. Exactly equal records share a rank (1, 2, 2, 4).
 *
 * Works across the whole company (or one branch); who may see which rows
 * is the controller's job.
 */
final class EmployeeRanking
{
    public const MIN_DAYS = 5;

    public const ATTENDANCE_WEIGHT = 60;

    public const ON_TIME_WEIGHT = 40;

    /**
     * @return Collection<int, array{rank: int, score: float, employee: Employee, scheduled_days: int, present_days: int, on_time_days: int, late_minutes: int}>
     */
    public function forMonth(Company $company, CarbonImmutable $month, ?int $branchId = null): Collection
    {
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $from = $month->startOfMonth()->toDateString();
        // Finished days only: up to yesterday this month, the whole month before that.
        $to = min($month->endOfMonth()->toDateString(), CarbonImmutable::now($timezone)->subDay()->toDateString());

        if ($to < $from) {
            return collect();
        }

        $totals = AttendanceDay::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('kind', 'work')
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->groupBy('employee_id')
            ->selectRaw('employee_id')
            ->selectRaw('count(*) as scheduled_days')
            ->selectRaw("sum(case when status <> 'absent' then 1 else 0 end) as present_days")
            ->selectRaw("sum(case when status <> 'absent' and coalesce(late_minutes, 0) = 0 then 1 else 0 end) as on_time_days")
            ->selectRaw('sum(coalesce(late_minutes, 0)) as late_minutes')
            ->toBase() // plain rows of totals, not AttendanceDay models
            ->get()
            ->filter(fn ($row) => (int) $row->scheduled_days >= self::MIN_DAYS)
            ->keyBy('employee_id');

        if ($totals->isEmpty()) {
            return collect();
        }

        $employees = Employee::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereIn('id', $totals->keys())
            ->whereNotIn('employment_status', Employee::LEFT_STATUSES)
            ->when($branchId, fn ($q) => $q->whereHas('currentAssignment', fn ($a) => $a->withoutGlobalScopes()->where('branch_id', $branchId)))
            ->with(['currentAssignment' => fn ($a) => $a->withoutGlobalScopes()->with(['branch' => fn ($b) => $b->withoutGlobalScopes()->select('id', 'name')])])
            ->get();

        $rows = $employees->map(function (Employee $employee) use ($totals) {
            $t = $totals->get($employee->id);
            $scheduled = (int) $t->scheduled_days;
            $present = (int) $t->present_days;
            $onTime = (int) $t->on_time_days;

            return [
                'score' => self::score($scheduled, $present, $onTime),
                'employee' => $employee,
                'scheduled_days' => $scheduled,
                'present_days' => $present,
                'on_time_days' => $onTime,
                'late_minutes' => (int) $t->late_minutes,
            ];
        })
            ->sort(fn (array $a, array $b) => [$b['score'], $b['present_days'], $a['late_minutes'], $a['employee']->name]
                <=> [$a['score'], $a['present_days'], $b['late_minutes'], $b['employee']->name])
            ->values();

        // Rank: equal records share a place, the next one skips (1, 2, 2, 4).
        $ranked = [];
        $previous = null;
        $rank = 0;

        foreach ($rows as $i => $row) {
            $key = [$row['score'], $row['present_days'], $row['late_minutes']];
            if ($key !== $previous) {
                $rank = $i + 1;
                $previous = $key;
            }
            $ranked[] = ['rank' => $rank, ...$row];
        }

        return collect($ranked);
    }

    public static function score(int $scheduled, int $present, int $onTime): float
    {
        if ($scheduled === 0) {
            return 0.0;
        }

        $attendance = $present / $scheduled;
        $punctuality = $present === 0 ? 0 : $onTime / $present;

        return round(self::ATTENDANCE_WEIGHT * $attendance + self::ON_TIME_WEIGHT * $punctuality, 1);
    }

    /** The employee's branch name, for display. */
    public static function branchName(Employee $employee): ?string
    {
        $assignment = $employee->currentAssignment;

        return $assignment instanceof EmployeeAssignment ? $assignment->branch?->name : null;
    }
}
