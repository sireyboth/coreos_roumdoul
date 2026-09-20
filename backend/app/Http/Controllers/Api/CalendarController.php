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

    private function holidayOn($holidays, CarbonImmutable|Carbon $day): ?Holiday
    {
        return $holidays->first(function (Holiday $holiday) use ($day) {
            return $holiday->is_recurring_yearly
                ? $holiday->date->format('m-d') === $day->format('m-d')
                : $holiday->date->toDateString() === $day->toDateString();
        });
    }
}
