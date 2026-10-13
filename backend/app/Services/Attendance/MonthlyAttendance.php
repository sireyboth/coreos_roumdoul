<?php

namespace App\Services\Attendance;

use App\Models\AttendanceDay;
use App\Models\Company;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * A month of attendance per employee, as one set of totals: the shared source
 * for the monthly summary screen and for payroll, so the two can never
 * disagree. Days off and holidays come from the schedule, since a day nobody
 * worked on keeps no record.
 */
class MonthlyAttendance
{
    /**
     * @param  Collection<int, Employee>  $employees
     * @return Collection<int, array<string, mixed>> keyed by employee id
     */
    public static function for(Company $company, Collection $employees, CarbonImmutable $start): Collection
    {
        $start = $start->startOfMonth()->startOfDay();
        $end = $start->endOfMonth()->startOfDay();

        $days = AttendanceDay::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereIn('employee_id', $employees->pluck('id'))
            ->whereDate('date', '>=', $start->toDateString())->whereDate('date', '<=', $end->toDateString())
            ->orderBy('date')
            ->get()->groupBy('employee_id');

        $resolver = new ScheduleResolver($company, $employees->pluck('id'), $start->toDateString(), $end->toDateString());

        return $employees->mapWithKeys(function (Employee $employee) use ($days, $resolver, $start, $end) {
            $planned = ['work' => 0, 'weekly_off' => 0, 'day_off' => 0, 'holiday' => 0, 'leave' => 0, 'unscheduled' => 0];
            // Leave in days (a half day is 0.5). paid/unpaid split by whether the type pays at all;
            // paid_share/unpaid_share weigh each day by its pay_percent (a 50% day is half of each).
            $leave = ['paid' => 0.0, 'unpaid' => 0.0, 'paid_share' => 0.0, 'unpaid_share' => 0.0, 'by_type' => []];
            $excused = ['all' => 0, 'unpaid' => 0];

            for ($day = $start; $day->lte($end); $day = $day->addDay()) {
                $expected = $resolver->resolve($employee->id, $day->toDateString());
                $planned[$expected->kind]++;

                if ($expected->leave) {
                    $portion = (float) $expected->leave['portion'];
                    $percent = (int) $expected->leave['pay_percent'];
                    $leave[$percent > 0 ? 'paid' : 'unpaid'] += $portion;
                    $leave['paid_share'] += $portion * $percent / 100;
                    $leave['unpaid_share'] += $portion * (100 - $percent) / 100;
                    $leave['by_type'][$expected->leave['type']] = ($leave['by_type'][$expected->leave['type']] ?? 0) + $portion;
                }
                // Approved late arrival / early leave: minutes excused, paid or not.
                foreach ($expected->permission ?? [] as $permit) {
                    $excused['all'] += $permit['minutes'];
                    $excused['unpaid'] += $permit['pay_percent'] > 0 ? 0 : $permit['minutes'];
                }
            }

            $mine = $days->get($employee->id, collect());
            $worked = $mine->filter(fn (AttendanceDay $d) => $d->scan_count > 0);
            $approvedOt = fn (string $type) => (int) $mine->where('overtime_status', 'approved')->where('overtime_type', $type)->sum('overtime_minutes');

            return [$employee->id => [
                'planned' => $planned,
                'leave' => $leave,
                'excused' => $excused,
                'present_days' => $worked->where('kind', 'work')->count(),
                'absent_days' => $mine->where('status', 'absent')->count(),
                'incomplete_days' => $mine->where('status', 'incomplete')->count(),
                'late_days' => $mine->where('late_minutes', '>', 0)->count(),
                'late_minutes' => (int) $mine->sum('late_minutes'),
                // Per day, so a grace period can be applied to each day on its own.
                'late_by_day' => $mine->where('late_minutes', '>', 0)->pluck('late_minutes')->map(fn ($m) => (int) $m)->values()->all(),
                'early_leave_days' => $mine->where('early_leave_minutes', '>', 0)->count(),
                'early_leave_minutes' => (int) $mine->sum('early_leave_minutes'),
                'early_leave_by_day' => $mine->where('early_leave_minutes', '>', 0)->pluck('early_leave_minutes')->map(fn ($m) => (int) $m)->values()->all(),
                'scheduled_minutes' => (int) $mine->sum('scheduled_minutes'),
                'worked_minutes' => (int) $mine->sum('worked_minutes'),
                'night_minutes' => (int) $mine->sum('night_minutes'),
                'worked_days_off' => $worked->whereIn('kind', ['day_off', 'weekly_off'])->count(),
                'worked_holidays' => $worked->filter(fn (AttendanceDay $d) => ($d->expected['holiday'] ?? null) !== null)->count(),
                'overtime_workday_minutes' => $approvedOt('workday'),
                'overtime_day_off_minutes' => $approvedOt('day_off'),
                'overtime_holiday_minutes' => $approvedOt('holiday'),
                'overtime_pending_minutes' => (int) $mine->where('overtime_status', 'pending')->sum('overtime_minutes'),
            ]];
        });
    }
}
