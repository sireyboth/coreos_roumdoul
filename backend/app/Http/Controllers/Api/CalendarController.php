<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSession;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\Schedule;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class CalendarController extends Controller
{
    /**
     * One employee's month: for every day, what was planned (work, holiday,
     * day off, weekly rest day) and — for days already gone — what happened.
     */
    public function index(Request $request)
    {
        $request->validate([
            'month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'employee_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $canManage = $user->hasCompanyPermission('schedules.manage');

        // Managers may look at anyone they can see; everyone else only ever
        // sees their own month, whatever employee_id they send.
        $employee = $canManage && $request->filled('employee_id')
            ? Employee::query()->findOrFail($request->integer('employee_id'))
            : $user->employee;

        if (! $employee) {
            return response()->json(['message' => 'No employee record is linked to your account.', 'code' => 'no_employee'], 422);
        }

        $timezone = $employee->company->timezone ?: config('attendance.default_timezone');
        $today = now($timezone)->toDateString();
        $start = CarbonImmutable::createFromFormat('Y-m-d', $request->string('month').'-01', $timezone)->startOfDay();
        $end = $start->endOfMonth();

        $holidays = Holiday::query()
            ->where(fn ($q) => $q->whereBetween('date', [$start->toDateString(), $end->toDateString()])->orWhere('is_recurring_yearly', true))
            ->get();

        $schedules = Schedule::query()->with(['shift', 'workLocation'])
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get()->keyBy(fn ($s) => $s->date->toDateString());

        $daysOff = DayOff::query()
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get()->keyBy(fn ($d) => $d->date->toDateString());

        $sessions = AttendanceSession::query()->with(['checkInEvent', 'checkOutEvent'])
            ->where('employee_id', $employee->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get()->keyBy(fn ($s) => $s->date->toDateString());

        [$days, $summary, $weeklyOff] = $this->buildMonth($employee, $start, $end, $today, $timezone, $holidays, $schedules, $daysOff, $sessions);

        return [
            'employee' => ['id' => $employee->id, 'name' => $employee->name],
            'month' => $start->format('Y-m'),
            'today' => $today,
            'timezone' => $timezone,
            'weekly_off_days' => $weeklyOff,
            'summary' => $summary,
            'days' => $days,
        ];
    }

    /**
     * The whole company's month at a glance — one row per employee, using the
     * same day classification as the personal calendar. Managers only (see
     * routes); the branch-access scope on Employee still applies, so a
     * manager restricted to some branches only sees those people.
     */
    public function team(Request $request)
    {
        $request->validate([
            'month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $limit = 200;
        $company = $request->user()->company;
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $today = now($timezone)->toDateString();
        $start = CarbonImmutable::createFromFormat('Y-m-d', $request->string('month').'-01', $timezone)->startOfDay();
        $end = $start->endOfMonth();
        $from = $start->toDateString();
        $to = $end->toDateString();

        $query = Employee::query()->with(['company', 'branch'])
            // People who left before this month have nothing to show.
            ->where(fn ($q) => $q->where('employment_status', '!=', 'terminated')->orWhere('termination_date', '>=', $from))
            ->when($request->filled('branch_id'), fn ($q) => $q->whereHas(
                'currentAssignment',
                fn ($a) => $a->where('branch_id', $request->integer('branch_id')),
            ))
            ->orderBy('display_name')->orderBy('id');

        $total = (clone $query)->count();
        $employees = $query->limit($limit)->get();
        $ids = $employees->pluck('id');

        $holidays = Holiday::query()
            ->where(fn ($q) => $q->whereBetween('date', [$from, $to])->orWhere('is_recurring_yearly', true))
            ->get();

        // One query per table for the whole roster, grouped per employee —
        // not one set of queries per person.
        $byEmployee = fn ($rows) => $rows->groupBy('employee_id')
            ->map(fn ($group) => $group->keyBy(fn ($row) => $row->date->toDateString()));

        $schedules = $byEmployee(Schedule::query()->with(['shift', 'workLocation'])
            ->whereIn('employee_id', $ids)->whereBetween('date', [$from, $to])->get());
        $daysOff = $byEmployee(DayOff::query()->whereIn('employee_id', $ids)->whereBetween('date', [$from, $to])->get());
        $sessions = $byEmployee(AttendanceSession::query()->with(['checkInEvent', 'checkOutEvent'])
            ->whereIn('employee_id', $ids)->whereBetween('date', [$from, $to])->get());

        $rows = $employees->map(function (Employee $employee) use ($start, $end, $today, $timezone, $holidays, $schedules, $daysOff, $sessions) {
            [$days, $summary] = $this->buildMonth(
                $employee, $start, $end, $today, $timezone, $holidays,
                $schedules->get($employee->id, collect()),
                $daysOff->get($employee->id, collect()),
                $sessions->get($employee->id, collect()),
            );

            return [
                'id' => $employee->id,
                'name' => $employee->name,
                'employee_code' => $employee->employee_code,
                'branch' => $employee->branch?->name,
                'summary' => $summary,
                'days' => $days,
            ];
        })->values();

        return [
            'month' => $start->format('Y-m'),
            'today' => $today,
            'timezone' => $timezone,
            'total' => $total,
            'truncated' => $total > $limit,
            'employees' => $rows,
        ];
    }

    /** The company's current weekly days off (0 = Sunday .. 6 = Saturday). */
    public function weeklyOffDays(Request $request)
    {
        return ['weekly_off_days' => array_map('intval', $request->user()->company->default_rest_days ?? [])];
    }

    /** Sets which weekdays (0 = Sunday .. 6 = Saturday) are the company's regular days off. */
    public function setWeeklyOffDays(Request $request)
    {
        $data = $request->validate([
            'days' => ['present', 'array'],
            'days.*' => ['integer', 'between:0,6', 'distinct'],
        ]);

        $days = collect($data['days'])->map(fn ($d) => (int) $d)->sort()->values()->all();

        $request->user()->company->update(['default_rest_days' => $days]);

        return ['weekly_off_days' => $days];
    }

    /**
     * Classifies every day of the month for one employee. Shared by the
     * personal calendar and the team roster so the two can never disagree.
     *
     * $schedules, $daysOff and $sessions are this employee's rows keyed by date.
     *
     * @return array{0: array, 1: array, 2: array} [days, summary, weeklyOff]
     */
    private function buildMonth(
        Employee $employee,
        CarbonImmutable $start,
        CarbonImmutable $end,
        string $today,
        string $timezone,
        Collection $holidays,
        Collection $schedules,
        Collection $daysOff,
        Collection $sessions,
    ): array {
        $weeklyOff = array_map('intval', $employee->effectiveRestDays());

        $days = [];
        $summary = ['work_days' => 0, 'holidays' => 0, 'days_off' => 0, 'present' => 0, 'late' => 0, 'absent' => 0];

        for ($day = $start; $day <= $end; $day = $day->addDay()) {
            $date = $day->toDateString();
            $holiday = $this->holidayOn($holidays, $day);
            $schedule = $schedules->get($date);
            $dayOff = $daysOff->get($date);
            $session = $sessions->get($date);

            // An explicit day off beats a public holiday, which beats a shift;
            // a weekly rest day only applies when nothing else is planned.
            $type = match (true) {
                $dayOff !== null => 'day_off',
                $holiday !== null => 'holiday',
                $schedule !== null => 'work',
                in_array($day->dayOfWeek, $weeklyOff, true) => 'weekly_off',
                default => 'none',
            };

            $attendance = null;
            if ($session?->check_in_event_id) {
                $attendance = match (true) {
                    $session->status === 'missing_checkout' => 'missing_checkout',
                    $session->late_minutes > 0 => 'late',
                    default => 'present',
                };
            } elseif ($type === 'work' && $date < $today) {
                $attendance = 'absent';
            }

            match ($type) {
                'work' => $summary['work_days']++,
                'holiday' => $summary['holidays']++,
                'day_off', 'weekly_off' => $summary['days_off']++,
                default => null,
            };
            if (in_array($attendance, ['present', 'missing_checkout'], true)) {
                $summary['present']++;
            } elseif ($attendance === 'late') {
                $summary['present']++;
                $summary['late']++;
            } elseif ($attendance === 'absent') {
                $summary['absent']++;
            }

            $days[] = [
                'date' => $date,
                'type' => $type,
                'label' => match ($type) {
                    'day_off' => $dayOff->reason ?: 'Day off',
                    'holiday' => $holiday->name,
                    'work' => $schedule->shift->name,
                    'weekly_off' => 'Weekly day off',
                    default => null,
                },
                'day_off_id' => $dayOff?->id,
                'shift' => $schedule ? [
                    'name' => $schedule->shift->name,
                    'start_time' => substr($schedule->shift->start_time, 0, 5),
                    'end_time' => substr($schedule->shift->end_time, 0, 5),
                ] : null,
                'schedule_id' => $schedule?->id,
                'work_location' => $schedule?->workLocation?->name,
                'attendance' => $attendance,
                'late_minutes' => $session?->late_minutes,
                'check_in' => $session?->checkInEvent?->event_time?->setTimezone($timezone)->format('H:i'),
                'check_out' => $session?->checkOutEvent?->event_time?->setTimezone($timezone)->format('H:i'),
            ];
        }

        return [$days, $summary, $weeklyOff];
    }

    private function holidayOn($holidays, CarbonImmutable|Carbon $day): ?Holiday
    {
        return $holidays->first(function (Holiday $holiday) use ($day) {
            return $holiday->is_recurring_yearly
                ? $holiday->date->format('m-d') === $day->format('m-d')
                : $holiday->date->toDateString() === $day->toDateString();
        });
    }
}
