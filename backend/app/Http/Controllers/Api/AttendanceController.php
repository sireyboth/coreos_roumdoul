<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceAdjustment;
use App\Models\AttendanceCorrection;
use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\Employee;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\ScheduleResolver;
use App\Services\AttendanceService;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Attendance as days: for each employee and date, what was expected next to
 * what happened. The employee only ever "scans"; the schedule decides
 * whether that was an IN or an OUT.
 */
class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', Rule::in(AttendanceDay::STATUSES)],
            'exception' => ['nullable', Rule::in(AttendanceDay::EXCEPTIONS)],
        ]);

        $days = $this->visibleDays($request)
            ->with(['employee.branch', 'employee.currentAssignment'])
            // Each person together, in the company's display order; their days newest first.
            ->tap(fn ($q) => Employee::orderRowsByEmployee($q, 'attendance_days.employee_id'))
            ->orderBy('employee_id')
            ->orderByDesc('date')
            ->orderByDesc('id')
            // per_page (max 1000): a month of attendance for a whole company is far more than 50 rows.
            ->paginate(min(max($request->integer('per_page', 50), 1), 1000));

        $events = $this->eventsFor($days->getCollection());
        $adjustments = $this->adjustmentsFor($days->getCollection());
        $timezone = $this->timezone($request);

        $days->setCollection($days->getCollection()->map(fn (AttendanceDay $day) => $this->present($day, $events, $timezone, $adjustments)));

        return $days;
    }

    /** One scan: IN or OUT is decided by the person's schedule. */
    public function scan(Request $request, AttendanceService $attendance)
    {
        $result = $attendance->scan($this->requireEmployee($request), $this->scanData($request));
        $timezone = $this->timezone($request);

        return response()->json([
            'event' => $result['event'],
            'slot' => $result['slot'],
            'day' => $result['day'] ? $this->present($result['day']->load('employee'), $this->eventsFor(collect([$result['day']])), $timezone) : null,
            'message' => $this->scanMessage($result['slot'], $result['event'], $timezone),
        ], 201);
    }

    /**
     * Kept so older app versions still work: both now simply scan, and answer
     * in the shape those versions read — the scan record itself — with the
     * matched slot and the message added alongside.
     */
    public function checkIn(Request $request, AttendanceService $attendance)
    {
        return $this->legacyScan($request, $attendance);
    }

    public function checkOut(Request $request, AttendanceService $attendance)
    {
        return $this->legacyScan($request, $attendance);
    }

    private function legacyScan(Request $request, AttendanceService $attendance)
    {
        $result = $attendance->scan($this->requireEmployee($request), $this->scanData($request));

        return response()->json([
            ...$result['event']->toArray(),
            'slot' => $result['slot'],
            'message' => $this->scanMessage($result['slot'], $result['event'], $this->timezone($request)),
        ], 201);
    }

    /**
     * An admin fixing one employee's day directly: void wrong scans, add
     * missing ones (typed on the company's clock, e.g. "2026-10-05T17:00").
     * Answers with the recalculated day, or day: null when nothing is left
     * to keep (e.g. every scan on a day off voided).
     */
    public function adjust(Request $request, AttendanceService $attendance)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'reason' => ['required', 'string', 'max:255'],
            'add' => ['nullable', 'array', 'max:12'],
            'add.*' => ['required', 'date', 'distinct'],
            'void' => ['nullable', 'array', 'max:24'],
            'void.*' => ['required', 'integer', 'distinct'],
        ]);

        if (empty($data['add']) && empty($data['void'])) {
            throw ValidationException::withMessages(['add' => ['Add or remove at least one scan.']]);
        }

        // Scoped like every employee lookup, so a branch-limited manager only reaches their branch.
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $timezone = $this->timezone($request);
        $add = array_map(fn (string $value) => CarbonImmutable::parse($value, $timezone)->utc(), $data['add'] ?? []);

        $day = $attendance->adjustDay($employee, $data['date'], $add, $data['void'] ?? [], $data['reason'], $request->user()->id);

        return response()->json([
            'day' => $day ? $this->present($day->load(['employee.branch', 'employee.currentAssignment']), $this->eventsFor(collect([$day])), $timezone, $this->adjustmentsFor(collect([$day]))) : null,
        ]);
    }

    /** Fills every missed scan of the chosen days from their schedule. Days with nothing missing are skipped. */
    public function fillMissed(Request $request, AttendanceService $attendance)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:500'],
            'ids.*' => ['required', 'integer', 'distinct'],
            'reason' => ['required', 'string', 'max:255'],
            // Optional: your own time per slot (by sequence) instead of the scheduled one.
            'times' => ['nullable', 'array', 'max:12'],
            'times.*' => ['required', 'date_format:H:i'],
        ]);

        // Through the employee, so a branch-limited manager only reaches their branch.
        $days = AttendanceDay::query()->whereHas('employee')->with('employee.company')->whereKey($data['ids'])->get();
        if ($days->count() !== count($data['ids'])) {
            throw ValidationException::withMessages(['ids' => ['Some of those days no longer exist or are outside your branches. Reload and try again.']]);
        }

        $recorder = app(AttendanceRecorder::class);
        foreach ($days as $day) {
            $recorder->assertUnlocked($day->company_id, $day->date->toDateString(), 'ids', $day->employee_id);
        }

        $filled = 0;
        foreach ($days as $day) {
            if ($attendance->fillMissedScans($day, $data['reason'], $request->user()->id, $data['times'] ?? [])) {
                $filled++;
            }
        }

        return response()->json(['filled' => $filled, 'skipped' => $days->count() - $filled]);
    }

    /** Permanently clears the chosen days (e.g. test scans). Each day is checked first, so nothing is deleted if any is locked. */
    public function destroyDays(Request $request, AttendanceService $attendance)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['required', 'integer', 'distinct'],
        ]);

        // Through the employee, so a branch-limited manager only reaches their branch.
        $days = AttendanceDay::query()->whereHas('employee')->with('employee.company')->whereKey($data['ids'])->get();
        if ($days->count() !== count($data['ids'])) {
            throw ValidationException::withMessages(['ids' => ['Some of those days no longer exist or are outside your branches. Reload and try again.']]);
        }

        $recorder = app(AttendanceRecorder::class);
        foreach ($days as $day) {
            $recorder->assertUnlocked($day->company_id, $day->date->toDateString(), 'ids', $day->employee_id);
        }

        foreach ($days as $day) {
            AuditLogger::record('attendance.day_deleted', $day, [], $day->company_id, [
                'employee_id' => $day->employee_id,
                'employee' => $day->employee->name,
                'date' => $day->date->toDateString(),
                'scans' => $day->scans,
            ]);
            $attendance->deleteDay($day);
        }

        return response()->json(['deleted' => $days->count()]);
    }

    /** The signed-in person's day: expected slots, what's done, what's next. */
    public function today(Request $request, AttendanceService $attendance)
    {
        $today = $attendance->today($this->requireEmployee($request));

        if ($today['day']) {
            $today['day'] = $this->present($today['day']->load('employee'), $this->eventsFor(collect([$today['day']])), $this->timezone($request));
        }

        return $today;
    }

    /**
     * The attendance report as a CSV file — everyone in the company, or one
     * employee. Every person gets a row for every date in the range: a stored
     * day as it was worked out, and a day nothing is stored for (leave, a
     * holiday, a day off, a day still to come) as the schedule describes it.
     * A person who can't manage attendance only ever exports their own rows.
     */
    public function export(Request $request): StreamedResponse
    {
        $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'integer'],
            // Adds the employee's internal id as a last column, so the app's report can open a day.
            'with_ids' => ['nullable', 'boolean'],
        ]);

        // A year is plenty for a report; an unbounded range would hold the connection open for minutes.
        if ($request->date('from')->diffInDays($request->date('to')) > 366) {
            throw ValidationException::withMessages(['to' => ['Pick a range of one year or less.']]);
        }

        $withIds = $request->boolean('with_ids');
        $timezone = $this->timezone($request);
        $company = $request->user()->company;
        $from = $request->input('from');
        $to = $request->input('to');
        $today = CarbonImmutable::now($timezone)->toDateString();

        // The same people index() would show, in the company's display order.
        $employees = Employee::query()
            ->with(['branch', 'department', 'team'])
            ->when(! $request->user()->hasCompanyPermission('attendance.manage'), fn ($q) => $q->where('user_id', $request->user()->id))
            ->when($request->filled('employee_id'), fn ($q) => $q->whereKey($request->integer('employee_id')))
            // People who left before the range have nothing in it (as on the team calendar).
            ->where(fn ($q) => $q->whereNotIn('employment_status', Employee::LEFT_STATUSES)->orWhere('termination_date', '>=', $from))
            ->inDisplayOrder();

        $filename = 'attendance-'.$from.'-to-'.$to.'.csv';

        return response()->streamDownload(function () use ($employees, $company, $from, $to, $today, $timezone, $withIds) {
            $out = fopen('php://output', 'w');

            // The BOM makes Excel read the file as UTF-8, so Khmer names don't turn into gibberish.
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Employee ID', 'Employee', 'Branch', 'Department', 'Team', 'Date', 'Day type', 'Leave / holiday', 'Schedule',
                'Expected', 'Scans', 'Late (min)', 'Early leave (min)', 'Worked (hours)', 'Overtime (hours)',
                'Overtime type', 'Overtime status', 'Night (hours)', 'Status', 'Exceptions', 'Note',
                'Adjusted by', 'Adjusted at', 'Adjustment reason', 'Adjustment changes',
                ...($withIds ? ['Employee key'] : []),
            ]);

            // Approved permission to come late / leave early, as the day expected it.
            $permits = fn (?array $permission) => collect($permission ?? [])
                ->map(fn (array $p) => ($p['kind'] === 'late' ? 'Approved late arrival ' : 'Approved early leave ').$p['time']);

            $hours = fn (int $minutes) => number_format($minutes / 60, 2, '.', '');
            $time = fn (?string $iso) => $iso ? CarbonImmutable::parse($iso)->setTimezone($timezone)->format('H:i') : null;

            // How each scan was made, when it wasn't a plain QR / GPS scan.
            $how = fn (?string $method) => match ($method) {
                'adjustment' => ' (adjusted)',
                'correction' => ' (correction)',
                'auto' => ' (auto)',
                default => '',
            };

            // Leave on the day ("Annual leave", "Sick leave (morning)"), else the holiday's name.
            $leaveOrHoliday = fn (?array $leave, ?string $holiday) => $leave
                ? $leave['type'].(($leave['part'] ?? 'full') === 'full' ? '' : ' ('.$leave['part'].')')
                : $holiday;

            $employees->chunk(100, function ($people) use ($out, $hours, $time, $how, $timezone, $company, $from, $to, $today, $leaveOrHoliday, $permits, $withIds) {
                $ids = $people->modelKeys();
                // Schedules, holidays, days off and approved leave for everyone in the chunk, loaded once.
                $resolver = new ScheduleResolver($company, $ids, $from, $to);
                $stored = AttendanceDay::query()->whereIn('employee_id', $ids)
                    ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
                    ->get()->keyBy(fn (AttendanceDay $day) => $day->employee_id.'|'.$day->date->toDateString());
                $adjustments = $this->adjustmentsFor($stored);
                // Why a day's scans were corrected, in the employee's words.
                $corrections = AttendanceCorrection::query()->whereIn('employee_id', $ids)->where('status', 'approved')
                    ->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
                    ->orderBy('id')->get()
                    ->groupBy(fn (AttendanceCorrection $c) => $c->employee_id.'|'.$c->date->toDateString());
                // Notes typed on a scan, by scan id.
                $scanNotes = AttendanceEvent::query()
                    ->whereIn('id', $stored->flatMap(fn (AttendanceDay $day) => collect($day->scans ?? [])->pluck('scan_id'))->filter()->values())
                    ->whereNotNull('notes')->where('notes', '!=', '')
                    ->pluck('notes', 'id');

                $note = fn (string $key, ?array $permission, array $scans = []) => $permits($permission)
                    ->merge(($corrections->get($key) ?? collect())->map(fn (AttendanceCorrection $c) => 'Correction: '.$c->reason))
                    ->merge(collect($scans)->map(fn ($scan) => $scanNotes->get($scan['scan_id'] ?? null))->filter())
                    ->join(' | ');

                foreach ($people as $employee) {
                    $person = [
                        $employee->employee_code,
                        $employee->name,
                        $employee->branch?->name,
                        $employee->department?->name,
                        $employee->team?->name,
                    ];
                    // Before they started or after they left, there's no day to report.
                    $first = max($from, $employee->hire_date?->toDateString() ?? $from);
                    $last = min($to, $employee->termination_date?->toDateString() ?? $to);

                    for ($date = CarbonImmutable::parse($first); $date->toDateString() <= $last; $date = $date->addDay()) {
                        $key = $employee->id.'|'.$date->toDateString();
                        $day = $stored->get($key);

                        if (! $day) {
                            $expected = $resolver->resolve($employee->id, $date->toDateString());
                            $status = match (true) {
                                $expected->isOff() => 'off',
                                $expected->kind === 'unscheduled' => 'unscheduled',
                                $expected->date > $today => 'upcoming',
                                // A past work day nothing was worked out for (e.g. before attendance was switched on).
                                default => 'not_recorded',
                            };

                            fputcsv($out, array_map($this->safeCell(...), [
                                ...$person,
                                $expected->date,
                                $this->label($expected->kind),
                                $leaveOrHoliday($expected->leave, $expected->holidayName),
                                $expected->isWork() ? $expected->scheduleName : null,
                                collect($expected->slots)->map(fn ($s) => strtoupper($s['type']).' '.$s['at']->setTimezone($timezone)->format('H:i'))->join(', '),
                                null, null, null, null, null, null, null, null,
                                $this->label($status),
                                null,
                                $note($key, $expected->permission),
                                null, null, null, null,
                                ...($withIds ? [$employee->id] : []),
                            ]));

                            continue;
                        }

                        $slots = collect($day->slots ?? []);
                        // A day adjusted more than once lists each, oldest first, split by " | ".
                        $adjusted = $adjustments->get($key, collect());

                        fputcsv($out, array_map($this->safeCell(...), [
                            ...$person,
                            $day->date->toDateString(),
                            $this->label($day->kind),
                            $leaveOrHoliday($day->expected['leave'] ?? null, $day->expected['holiday'] ?? null),
                            $day->expected['schedule_name'] ?? null,
                            $slots->map(fn ($s) => strtoupper($s['type']).' '.$time($s['expected_at']))->join(', '),
                            collect($day->scans ?? [])->map(fn ($scan) => strtoupper($scan['role']).' '.$time($scan['at']).$how($scan['method'] ?? null))->join(', '),
                            $day->late_minutes,
                            $day->early_leave_minutes,
                            $hours($day->worked_minutes),
                            $hours($day->overtime_minutes),
                            $day->overtime_type ? $this->label($day->overtime_type) : null,
                            $day->overtime_status ? ucfirst($day->overtime_status) : null,
                            $hours($day->night_minutes),
                            $this->label($day->status),
                            collect($day->exceptions ?? [])->map(fn ($e) => $this->label($e))->join(', '),
                            $note($key, $day->expected['permission'] ?? null, $day->scans ?? []),
                            $adjusted->map(fn (AttendanceAdjustment $a) => $a->adjustedBy?->name ?? 'Deleted user')->join(' | '),
                            $adjusted->map(fn (AttendanceAdjustment $a) => $a->created_at->setTimezone($timezone)->format('Y-m-d H:i'))->join(' | '),
                            $adjusted->map(fn (AttendanceAdjustment $a) => $a->reason)->join(' | '),
                            $adjusted->map(fn (AttendanceAdjustment $a) => $this->describeAdjustment($a, $timezone))->join(' | '),
                            ...($withIds ? [$employee->id] : []),
                        ]));
                    }
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Days the caller may see, narrowed by the optional employee_id / from /
     * to / status / exception filters. Shared by the list and the export so
     * the two can never disagree.
     */
    private function visibleDays(Request $request): Builder
    {
        $query = AttendanceDay::query()->whereHas('employee', function ($q) use ($request) {
            // Also applies a branch-limited manager's branch restriction.
            if (! $request->user()->hasCompanyPermission('attendance.manage')) {
                $q->where('user_id', $request->user()->id);
            }
        });

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }
        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->date('to'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('exception')) {
            // A JSON list of codes; matching the quoted code works on every database.
            $query->where('exceptions', 'like', '%"'.$request->input('exception').'"%');
        }
        if ($request->boolean('missed')) {
            // Any scan the schedule expected and never got: a missing IN or OUT, or none at all.
            $query->where(fn (Builder $q) => $q->where('exceptions', 'like', '%"missing_in"%')
                ->orWhere('exceptions', 'like', '%"missing_out"%')
                ->orWhere('exceptions', 'like', '%"absent"%'));
        }

        return $query;
    }

    /**
     * Admin adjustments to these days, with who made them, keyed
     * "employeeId|Y-m-d" — one query for the whole batch.
     */
    private function adjustmentsFor(Collection $days): Collection
    {
        if ($days->isEmpty()) {
            return collect();
        }

        return AttendanceAdjustment::query()
            ->with('adjustedBy:id,name')
            ->whereIn('employee_id', $days->pluck('employee_id')->unique())
            ->whereDate('date', '>=', $days->min('date'))
            ->whereDate('date', '<=', $days->max('date'))
            ->orderBy('created_at')->orderBy('id')
            ->get()
            ->groupBy(fn (AttendanceAdjustment $a) => $a->employee_id.'|'.$a->date->toDateString());
    }

    /** "Removed 09:30; added 08:00", on the company's clock. */
    private function describeAdjustment(AttendanceAdjustment $adjustment, string $timezone): string
    {
        $times = fn (?array $list) => collect($list ?? [])->map(fn (string $iso) => CarbonImmutable::parse($iso)->setTimezone($timezone)->format('H:i'))->join(', ');

        return collect([
            $adjustment->removed ? 'Removed '.$times($adjustment->removed) : null,
            $adjustment->added ? 'Added '.$times($adjustment->added) : null,
        ])->filter()->join('; ');
    }

    /** Every scan referenced by these days, with its location, in one query. */
    private function eventsFor(Collection $days): Collection
    {
        $ids = $days->flatMap(fn (AttendanceDay $day) => collect($day->scans ?? [])->pluck('scan_id'))->filter()->unique();

        return $ids->isEmpty() ? collect() : AttendanceEvent::query()
            ->with(['workLocation', 'recordedBy:id,name'])
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');
    }

    /** @param  Collection|null  $adjustments  from adjustmentsFor(); left out where the history isn't shown */
    private function present(AttendanceDay $day, Collection $events, string $timezone, ?Collection $adjustments = null): array
    {
        $scan = fn (?int $id) => $id && ($event = $events->get($id)) ? [
            'id' => $event->id,
            'at' => $event->event_time->setTimezone($timezone)->toIso8601String(),
            'method' => $event->method,
            'work_location' => $event->workLocation ? [
                'id' => $event->workLocation->id,
                'name' => $event->workLocation->name,
                'address' => $event->workLocation->address,
                'latitude' => $event->workLocation->latitude,
                'longitude' => $event->workLocation->longitude,
            ] : null,
            'distance_meters' => $event->distance_meters,
            // Where the phone said it was, for the map.
            'latitude' => $event->latitude,
            'longitude' => $event->longitude,
            'device_id' => $event->device_id,
            'recorded_by' => $event->recordedBy ? ['id' => $event->recordedBy->id, 'name' => $event->recordedBy->name] : null,
            'notes' => $event->notes,
        ] : null;

        $employee = $day->employee;

        return [
            'id' => $day->id,
            'date' => $day->date->toDateString(),
            'kind' => $day->kind,
            'label' => $day->label,
            'holiday' => $day->expected['holiday'] ?? null,
            'schedule' => $day->expected['schedule_name'] ?? null,
            'status' => $day->status,
            'is_closed' => $day->is_closed,
            'slots' => collect($day->slots ?? [])->map(fn (array $slot) => [...$slot, 'scan' => $scan($slot['scan_id'])])->values(),
            'extra_scans' => collect($day->extra_scans ?? [])->map(fn (array $extra) => [...$extra, 'scan' => $scan($extra['scan_id'])])->values(),
            // Every scan in order with the part it played (in / out / extra) — also on days without slots.
            'scans' => collect($day->scans ?? [])->map(fn (array $entry) => [...$entry, 'scan' => $scan($entry['scan_id'])])->values(),
            'scan_count' => $day->scan_count,
            'scheduled_minutes' => $day->scheduled_minutes,
            'worked_minutes' => $day->worked_minutes,
            'late_minutes' => $day->late_minutes,
            'early_leave_minutes' => $day->early_leave_minutes,
            'night_minutes' => $day->night_minutes,
            'overtime_minutes' => $day->overtime_minutes,
            'overtime_type' => $day->overtime_type,
            'overtime_status' => $day->overtime_status,
            'exceptions' => $day->exceptions ?? [],
            // Who changed this day by hand, when, and why — oldest first.
            'adjustments' => ($adjustments?->get($day->employee_id.'|'.$day->date->toDateString()) ?? collect())
                ->map(fn (AttendanceAdjustment $a) => [
                    'id' => $a->id,
                    'at' => $a->created_at->setTimezone($timezone)->toIso8601String(),
                    'by' => $a->adjustedBy?->name,
                    'reason' => $a->reason,
                    'changes' => $this->describeAdjustment($a, $timezone),
                ])->values(),
            'employee' => $employee ? [
                'id' => $employee->id,
                'name' => $employee->name,
                'employee_code' => $employee->employee_code,
                'sort_order' => $employee->sort_order,
                'branch' => $employee->relationLoaded('branch') && $employee->branch ? ['id' => $employee->branch->id, 'name' => $employee->branch->name] : null,
                'job_title' => $employee->relationLoaded('currentAssignment') ? $employee->job_title : null,
                // The list and the dashboard show each person's avatar.
                'photo_url' => $employee->photo_url,
            ] : null,
        ];
    }

    /** What to tell the person right after a scan, e.g. "IN at 08:07 — 7 min late". */
    private function scanMessage(?array $slot, AttendanceEvent $event, string $timezone): string
    {
        $at = $event->event_time->setTimezone($timezone)->format('H:i');

        if (! $slot) {
            return "Scan recorded at {$at}.";
        }

        $type = strtoupper($slot['type']);
        $expected = CarbonImmutable::parse($slot['expected_at'])->setTimezone($timezone)->format('H:i');
        $note = match (true) {
            $slot['late_minutes'] > 0 => " — {$slot['late_minutes']} min late",
            $slot['early_minutes'] > 0 => " — {$slot['early_minutes']} min early",
            default => '',
        };

        return "{$type} recorded at {$at} (expected {$expected}){$note}.";
    }

    private function scanData(Request $request): array
    {
        return $request->validate([
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'qr_token' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ]);
    }

    private function label(string $code): string
    {
        return ucfirst(str_replace('_', ' ', $code));
    }

    /**
     * Names are typed by people. A cell starting with = + - or @ would run as a
     * formula when the CSV is opened in Excel, so it's prefixed to stay plain text.
     */
    private function safeCell(mixed $value): mixed
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'".$value : $value;
    }

    private function timezone(Request $request): string
    {
        return $request->user()->company?->timezone ?: config('attendance.default_timezone');
    }

    private function requireEmployee(Request $request)
    {
        $employee = $request->user()->employee;

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee' => ['Your account isn\'t linked to an employee record yet.'],
            ]);
        }

        return $employee;
    }
}
