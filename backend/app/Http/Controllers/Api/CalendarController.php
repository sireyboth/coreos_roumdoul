<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceDay;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Models\Holiday;
use App\Models\Schedule;
use App\Services\Attendance\ScheduleResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Month views: for every day, what was planned (from the person's schedule
 * assignment, a roster override, a holiday or a day off) and — for days
 * already started — what happened. Built with the same ScheduleResolver
 * the attendance engine uses, so the calendar and attendance always agree.
 */
class CalendarController extends Controller
{
    /** One employee's month. */
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
            return response()->json(['message' => __('No employee record is linked to your account.'), 'code' => 'no_employee'], 422);
        }

        [$start, $end, $today, $timezone] = $this->month($request);
        $context = $this->context($request, collect([$employee]), $start, $end);
        [$days, $summary] = $this->buildMonth($employee, $start, $end, $today, $context);

        return [
            'employee' => ['id' => $employee->id, 'name' => $employee->name],
            'month' => $start->format('Y-m'),
            'today' => $today,
            'timezone' => $timezone,
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
        [$start, $end, $today, $timezone] = $this->month($request);
        $from = $start->toDateString();

        $query = Employee::query()->with(['company', 'branch'])
            // People who left before this month have nothing to show.
            ->where(fn ($q) => $q->whereNotIn('employment_status', Employee::LEFT_STATUSES)->orWhere('termination_date', '>=', $from))
            ->when($request->filled('branch_id'), fn ($q) => $q->whereHas(
                'currentAssignment',
                fn ($a) => $a->where('branch_id', $request->integer('branch_id')),
            ))
            ->inDisplayOrder();

        $total = (clone $query)->count();
        $employees = $query->limit($limit)->get();
        $context = $this->context($request, $employees, $start, $end);

        $rows = $employees->map(function (Employee $employee) use ($start, $end, $today, $context) {
            [$days, $summary] = $this->buildMonth($employee, $start, $end, $today, $context);

            return [
                'id' => $employee->id,
                'name' => $employee->name,
                'employee_code' => $employee->employee_code,
                'branch' => $employee->branch?->name,
                'summary' => $summary,
                // A month has ~30 days per person and most are plain: leaving out the
                // empty fields (the app reads a missing one as "none") cuts the size ~3x.
                'days' => array_map(fn (array $day) => array_filter($day, fn ($value) => $value !== null && $value !== []), $days),
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

    /**
     * Only the days something happens — holidays, days off, leave and
     * absences — over a range of up to a year, for the agenda list. Read
     * straight from their tables (no day-by-day resolving), with runs of
     * consecutive days folded into one event. Weekly days off are left out:
     * they are the routine, not news.
     */
    public function events(Request $request)
    {
        $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'integer'],
            'types' => ['nullable', 'array'],
            'types.*' => ['in:holiday,day_off,leave,absent'],
        ]);

        $user = $request->user();
        $timezone = $user->company->timezone ?: config('attendance.default_timezone');
        $from = CarbonImmutable::createFromFormat('Y-m-d', $request->string('from'), $timezone)->startOfDay();
        $to = CarbonImmutable::createFromFormat('Y-m-d', $request->string('to'), $timezone)->startOfDay();

        if ($from->diffInDays($to) > 366) {
            return response()->json(['message' => __('Pick a range of a year or less.'), 'errors' => ['to' => ['Pick a range of a year or less.']]], 422);
        }

        // Same rule as the month view: managers see anyone they can see
        // (branch access still applies), everyone else only themselves.
        if ($user->hasCompanyPermission('schedules.manage')) {
            $employees = $request->filled('employee_id')
                ? collect([Employee::query()->findOrFail($request->integer('employee_id'))])
                : Employee::query()->get(['id', 'display_name', 'first_name', 'last_name']);
        } elseif ($user->employee) {
            $employees = collect([$user->employee]);
        } else {
            return response()->json(['message' => __('No employee record is linked to your account.'), 'code' => 'no_employee'], 422);
        }

        $types = $request->input('types') ?: ['holiday', 'day_off', 'leave', 'absent'];
        $ids = $employees->pluck('id');
        $names = $employees->pluck('name', 'id');
        $person = fn (int $id) => ['id' => $id, 'name' => $names[$id] ?? null];
        $fromDate = $from->toDateString();
        $toDate = $to->toDateString();
        $events = collect();

        if (in_array('holiday', $types, true)) {
            $holidays = Holiday::query()
                ->where(fn ($q) => $q->where(fn ($r) => $r->whereDate('date', '>=', $fromDate)->whereDate('date', '<=', $toDate))->orWhere('is_recurring_yearly', true))
                ->get();

            foreach ($holidays as $holiday) {
                // A yearly holiday lands once in every year the range touches.
                $dates = $holiday->is_recurring_yearly
                    ? collect(range($from->year, $to->year))
                        ->map(fn (int $year) => sprintf('%d-%s', $year, $holiday->date->format('m-d')))
                        ->filter(fn (string $date) => checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4)))
                    : collect([$holiday->date->toDateString()]);

                foreach ($dates->filter(fn (string $date) => $date >= $fromDate && $date <= $toDate) as $date) {
                    $events->push($this->event('holiday', $date, $date, 1, $holiday->name, null));
                }
            }
        }

        if (in_array('day_off', $types, true)) {
            $dates = DayOff::query()->whereIn('employee_id', $ids)
                ->whereDate('date', '>=', $fromDate)->whereDate('date', '<=', $toDate)
                ->orderBy('employee_id')->orderBy('date')->get()
                ->map(fn (DayOff $row) => ['employee_id' => $row->employee_id, 'date' => $row->date->toDateString(), 'label' => $row->reason ?: 'Day off']);

            foreach ($this->runs($dates) as $run) {
                $events->push($this->event('day_off', $run['start'], $run['end'], $run['days'], $run['label'], $person($run['employee_id'])));
            }
        }

        if (in_array('leave', $types, true)) {
            $requests = EmployeeRequest::query()->with('leaveType')
                ->where('type', 'leave')->active()->whereIn('employee_id', $ids)
                ->whereDate('start_date', '<=', $toDate)->whereDate('end_date', '>=', $fromDate)
                ->get();

            foreach ($requests as $leave) {
                $events->push($this->event('leave', $leave->start_date->toDateString(), $leave->end_date->toDateString(), $leave->days, $leave->label(), $person($leave->employee_id)) + [
                    'part' => $leave->day_part,
                    'status' => $leave->status,
                    'request_id' => $leave->id,
                ]);
            }
        }

        if (in_array('absent', $types, true)) {
            $dates = AttendanceDay::query()->whereIn('employee_id', $ids)->where('status', 'absent')
                ->whereDate('date', '>=', $fromDate)->whereDate('date', '<=', $toDate)
                ->orderBy('employee_id')->orderBy('date')->get(['employee_id', 'date'])
                ->map(fn (AttendanceDay $row) => ['employee_id' => $row->employee_id, 'date' => $row->date->toDateString(), 'label' => 'Absent']);

            foreach ($this->runs($dates) as $run) {
                $events->push($this->event('absent', $run['start'], $run['end'], $run['days'], 'Absent', $person($run['employee_id'])));
            }
        }

        $order = ['holiday' => 0, 'leave' => 1, 'day_off' => 2, 'absent' => 3];

        return [
            'from' => $fromDate,
            'to' => $toDate,
            'today' => now($timezone)->toDateString(),
            'events' => $events
                ->sortBy([['start', 'asc'], fn ($a, $b) => $order[$a['type']] <=> $order[$b['type']], fn ($a, $b) => strcmp($a['employee']['name'] ?? '', $b['employee']['name'] ?? '')])
                ->values(),
        ];
    }

    private function event(string $type, string $start, string $end, float $days, string $label, ?array $employee): array
    {
        return ['type' => $type, 'start' => $start, 'end' => $end, 'days' => $days, 'label' => $label, 'employee' => $employee];
    }

    /**
     * Folds one person's dates into runs of consecutive days with the same
     * label: days off on the 3rd, 4th and 5th become one "3–5, 3 days".
     *
     * @param  Collection<int, array{employee_id: int, date: string, label: string}>  $dates  sorted by employee, then date
     */
    private function runs(Collection $dates): array
    {
        $runs = [];
        $current = null;

        foreach ($dates as $row) {
            $continues = $current
                && $current['employee_id'] === $row['employee_id']
                && $current['label'] === $row['label']
                && CarbonImmutable::parse($current['end'])->addDay()->toDateString() === $row['date'];

            if ($continues) {
                $current['end'] = $row['date'];
                $current['days']++;

                continue;
            }

            if ($current) {
                $runs[] = $current;
            }
            $current = ['employee_id' => $row['employee_id'], 'start' => $row['date'], 'end' => $row['date'], 'days' => 1, 'label' => $row['label']];
        }

        if ($current) {
            $runs[] = $current;
        }

        return $runs;
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: string, 3: string} */
    private function month(Request $request): array
    {
        $timezone = $request->user()->company->timezone ?: config('attendance.default_timezone');
        $start = CarbonImmutable::createFromFormat('Y-m-d', $request->string('month').'-01', $timezone)->startOfDay();

        return [$start, $start->endOfMonth()->startOfDay(), now($timezone)->toDateString(), $timezone];
    }

    /**
     * Everything the month needs, loaded once for all the employees shown:
     * the resolver (schedules, overrides, holidays, days off), the stored
     * days, and the override / day-off rows (so the app can edit them).
     */
    private function context(Request $request, Collection $employees, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $ids = $employees->pluck('id');
        $from = $start->toDateString();
        $to = $end->toDateString();
        $key = fn ($row) => $row->employee_id.'|'.$row->date->toDateString();

        return [
            'resolver' => new ScheduleResolver($request->user()->company, $ids, $from, $to),
            'days' => AttendanceDay::query()->whereIn('employee_id', $ids)
                ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)->get()->keyBy($key),
            'overrides' => Schedule::query()->with('workLocation')->whereIn('employee_id', $ids)
                ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)->get()->keyBy($key),
            'daysOff' => DayOff::query()->whereIn('employee_id', $ids)
                ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)->get()->keyBy($key),
        ];
    }

    /**
     * Classifies every day of the month for one employee. Shared by the
     * personal calendar and the team roster so the two can never disagree.
     *
     * @return array{0: array, 1: array} [days, summary]
     */
    private function buildMonth(Employee $employee, CarbonImmutable $start, CarbonImmutable $end, string $today, array $context): array
    {
        $days = [];
        $summary = [
            'work_days' => 0, 'holidays' => 0, 'days_off' => 0, 'leave_days' => 0,
            'present' => 0, 'late' => 0, 'absent' => 0, 'incomplete' => 0,
            'worked_minutes' => 0, 'overtime_minutes' => 0,
        ];

        for ($day = $start; $day <= $end; $day = $day->addDay()) {
            $date = $day->toDateString();
            $key = $employee->id.'|'.$date;
            $expected = $context['resolver']->resolve($employee->id, $date);
            /** @var AttendanceDay|null $record */
            $record = $context['days']->get($key);
            $override = $context['overrides']->get($key);
            $dayOff = $context['daysOff']->get($key);

            $type = match ($expected->kind) {
                'unscheduled' => 'none',
                default => $expected->kind,
            };
            $attendance = $this->attendance($record);

            match ($type) {
                'work' => $summary['work_days']++,
                'holiday' => $summary['holidays']++,
                'day_off', 'weekly_off' => $summary['days_off']++,
                default => null,
            };
            $summary['leave_days'] += $expected->leave['portion'] ?? 0;
            if (in_array($attendance, ['present', 'late', 'incomplete', 'worked'], true)) {
                $summary['present']++;
            }
            if ($attendance === 'late') {
                $summary['late']++;
            }
            if ($attendance === 'absent') {
                $summary['absent']++;
            }
            if ($attendance === 'incomplete') {
                $summary['incomplete']++;
            }
            $summary['worked_minutes'] += $record?->worked_minutes ?? 0;
            $summary['overtime_minutes'] += $record?->overtime_minutes ?? 0;

            $days[] = [
                'date' => $date,
                'type' => $type,
                'label' => $expected->kind === 'unscheduled' ? null : $expected->label,
                'holiday' => $expected->holidayName,
                // Approved leave on the date: the whole day, or a morning / afternoon.
                'leave' => $expected->leave ? ['type' => $expected->leave['type'], 'part' => $expected->leave['part']] : null,
                'day_off_id' => $dayOff?->id,
                'schedule' => $expected->isWork() ? [
                    'id' => $expected->workScheduleId,
                    'name' => $expected->scheduleName,
                    'source' => $expected->source,
                    'slots' => array_map(fn (array $slot) => [
                        'type' => $slot['type'],
                        'time' => $slot['time'],
                        'next_day' => $slot['next_day'],
                    ], $expected->slots),
                ] : null,
                // The roster entry behind an override, so it can be edited or removed.
                'schedule_id' => $override?->id,
                'work_location' => $override?->workLocation?->name,
                'attendance' => $attendance,
                'late_minutes' => $record?->late_minutes ?: null,
                'early_leave_minutes' => $record?->early_leave_minutes ?: null,
                'worked_minutes' => $record?->worked_minutes ?: null,
                'overtime_minutes' => $record?->overtime_minutes ?: null,
                'scans' => $record ? $this->scanTimes($record) : [],
                'exceptions' => $record?->exceptions ?? [],
            ];
        }

        return [$days, $summary];
    }

    /** How the day went, in one word for the calendar cell. */
    private function attendance(?AttendanceDay $record): ?string
    {
        if (! $record) {
            return null;
        }

        return match ($record->status) {
            'complete', 'in_progress' => $record->late_minutes > 0 ? 'late' : 'present',
            'incomplete' => 'incomplete',
            'absent' => 'absent',
            'worked_off', 'unscheduled' => $record->scan_count > 0 ? 'worked' : null,
            default => null,
        };
    }

    /** @return array<int, string> the day's scans as HH:MM, in order */
    private function scanTimes(AttendanceDay $record): array
    {
        // Stored with the company's UTC offset, so formatting them gives local time.
        return collect($record->scans ?? [])->pluck('at')
            ->map(fn (string $at) => CarbonImmutable::parse($at)->format('H:i'))
            ->values()
            ->all();
    }
}
