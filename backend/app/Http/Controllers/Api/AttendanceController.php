<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSession;
use App\Services\AttendanceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $query = $this->visibleSessions($request)->with([
            'employee.branch',
            'employee.currentAssignment',
            'schedule.shift',
            'checkInEvent.workLocation',
            'checkInEvent.recordedBy:id,name',
            'checkOutEvent.workLocation',
            'checkOutEvent.recordedBy:id,name',
        ]);

        // per_page (max 1000): a month of attendance for a whole company is far more than 50 rows.
        $sessions = $query->orderByDesc('date')->orderByDesc('id')->paginate(min(max($request->integer('per_page', 50), 1), 1000));

        // The dashboard's recent check-ins show each person's avatar.
        $sessions->getCollection()->each(fn ($session) => $session->employee?->append('photo_url'));

        return $sessions;
    }

    /**
     * The attendance report as a CSV file — everyone in the company, or one
     * employee. It reads through the same scope as index(), so a person who
     * can't manage attendance only ever exports their own rows.
     */
    public function export(Request $request): StreamedResponse
    {
        $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'integer'],
        ]);

        // A year is plenty for a report; an unbounded range would hold the connection open for minutes.
        if ($request->date('from')->diffInDays($request->date('to')) > 366) {
            throw ValidationException::withMessages(['to' => ['Pick a range of one year or less.']]);
        }

        $timezone = $request->user()->company?->timezone ?: config('attendance.default_timezone');

        $query = $this->visibleSessions($request)
            ->with(['employee.branch', 'employee.department', 'employee.team', 'schedule.shift', 'checkInEvent.workLocation', 'checkOutEvent.workLocation'])
            // Grouped by person, then by day, so each employee reads top to bottom.
            ->orderBy('employee_id')
            ->orderBy('date')
            ->orderBy('id');

        $filename = 'attendance-'.$request->input('from').'-to-'.$request->input('to').'.csv';

        return response()->streamDownload(function () use ($query, $timezone) {
            $out = fopen('php://output', 'w');

            // The BOM makes Excel read the file as UTF-8, so Khmer names don't turn into gibberish.
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Employee ID', 'Employee', 'Branch', 'Department', 'Team', 'Date', 'Shift',
                'Check in', 'Check out', 'Check-in location', 'Check-out location',
                'Late (min)', 'Worked (hours)', 'Status',
            ]);

            $query->chunk(500, function ($sessions) use ($out, $timezone) {
                foreach ($sessions as $session) {
                    $employee = $session->employee;
                    $in = $session->checkInEvent?->event_time?->copy()->setTimezone($timezone);
                    $outTime = $session->checkOutEvent?->event_time?->copy()->setTimezone($timezone);

                    fputcsv($out, array_map($this->safeCell(...), [
                        $employee?->employee_code,
                        $employee?->name,
                        $employee?->branch?->name,
                        $employee?->department?->name,
                        $employee?->team?->name,
                        $session->date->toDateString(),
                        $session->schedule?->shift?->name,
                        $in?->format('H:i'),
                        $outTime?->format('H:i'),
                        $session->checkInEvent?->workLocation?->name,
                        $session->checkOutEvent?->workLocation?->name,
                        $session->late_minutes,
                        $session->worked_minutes === null ? null : number_format($session->worked_minutes / 60, 2, '.', ''),
                        ucfirst(str_replace('_', ' ', $session->status)),
                    ]));
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Sessions the caller may see, narrowed by the optional employee_id / from / to
     * filters. Shared by the list and the export so the two can never disagree.
     */
    private function visibleSessions(Request $request): Builder
    {
        $query = AttendanceSession::query();

        if (! $request->user()->hasCompanyPermission('attendance.manage')) {
            $query->whereHas('employee', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->date('to'));
        }

        return $query;
    }

    /**
     * Names are typed by people. A cell starting with = + - or @ would run as a
     * formula when the CSV is opened in Excel, so it's prefixed to stay plain text.
     */
    private function safeCell(mixed $value): mixed
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'".$value : $value;
    }

    public function checkIn(Request $request, AttendanceService $attendance)
    {
        $employee = $this->requireEmployee($request);

        $data = $request->validate([
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'qr_token' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ]);

        $event = $attendance->checkIn($employee, $data);

        return response()->json($event, 201);
    }

    public function checkOut(Request $request, AttendanceService $attendance)
    {
        $employee = $this->requireEmployee($request);

        $data = $request->validate([
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'qr_token' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ]);

        $event = $attendance->checkOut($employee, $data);

        return response()->json($event, 201);
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
