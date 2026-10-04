<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\Employee;
use App\Services\Attendance\AttendanceNotifier;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AttendanceCorrectionController extends Controller
{
    public function index(Request $request)
    {
        $query = AttendanceCorrection::query()->with(['employee.currentAssignment', 'requestedBy', 'reviewedBy']);

        if (! $request->user()->hasCompanyPermission('attendance.manage')) {
            $query->whereHas('employee', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        // Each person together, in the company's display order; their days newest first.
        $corrections = $query
            ->tap(fn ($q) => Employee::orderRowsByEmployee($q, 'attendance_corrections.employee_id'))
            ->orderBy('employee_id')->orderByDesc('date')->orderByDesc('created_at')
            ->paginate(min(max($request->integer('per_page', 50), 1), 500));
        $corrections->getCollection()->each(fn (AttendanceCorrection $c) => $c->append('requested_times'));

        return $corrections;
    }

    public function store(Request $request, AttendanceRecorder $recorder, AttendanceNotifier $notifier)
    {
        $canManageOthers = $request->user()->hasCompanyPermission('attendance.manage');

        $data = $request->validate([
            'employee_id' => [$canManageOthers ? 'required' : 'nullable', 'exists:employees,id'],
            'date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:1000'],
            // Any number of scans to add, e.g. just the forgotten 12:00 OUT. Typed on
            // the company's clock ("2026-10-05T12:00"). The older check-in / check-out
            // pair is still accepted and simply becomes one or two scans.
            'scans' => ['nullable', 'array', 'max:12'],
            'scans.*' => ['required', 'date', 'distinct'],
            'requested_check_in' => ['nullable', 'date'],
            'requested_check_out' => ['nullable', 'date'],
        ]);

        $times = array_values(array_filter([...($data['scans'] ?? []), $data['requested_check_in'] ?? null, $data['requested_check_out'] ?? null]));

        if ($times === []) {
            throw ValidationException::withMessages([
                'scans' => ['Add at least one scan time to request.'],
            ]);
        }

        $employeeId = $data['employee_id'] ?? $request->user()->employee?->id;

        if (! $employeeId) {
            throw ValidationException::withMessages([
                'employee' => ['Your account isn\'t linked to an employee record yet.'],
            ]);
        }

        if (! $canManageOthers && $employeeId !== $request->user()->employee?->id) {
            abort(403);
        }

        // The times were typed on the employee's wall clock — read them in the
        // company's timezone, then store them as the same instant in UTC.
        $employee = Employee::query()->findOrFail($employeeId);
        $timezone = $employee->company?->timezone ?: config('attendance.default_timezone');
        $recorder->assertUnlocked($employee->company_id, Carbon::parse($data['date'])->toDateString());

        $scans = collect($times)
            ->map(fn (string $value) => Carbon::parse($value, $timezone)->setTimezone(config('app.timezone')))
            ->sortBy(fn (Carbon $time) => $time->getTimestamp())
            ->map(fn (Carbon $time) => $time->toIso8601String())
            ->values()->all();

        $correction = AttendanceCorrection::query()->create([
            'employee_id' => $employeeId,
            'date' => $data['date'],
            'requested_by' => $request->user()->id,
            'reason' => $data['reason'],
            'requested_scans' => $scans,
        ]);

        $notifier->correctionRequested($correction, $request->user());

        return response()->json($correction->load('employee')->append('requested_times'), 201);
    }

    public function approve(Request $request, AttendanceCorrection $correction, AttendanceService $attendance, AttendanceNotifier $notifier)
    {
        $this->authorizeSameCompany($request, $correction);

        if ($correction->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This request has already been reviewed.']]);
        }

        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:255']]);

        $attendance->approveCorrection($correction, $request->user()->id, $data['review_notes'] ?? null);
        $notifier->correctionDecided($correction, $request->user());

        return $correction->fresh(['employee'])->append('requested_times');
    }

    public function reject(Request $request, AttendanceCorrection $correction, AttendanceNotifier $notifier)
    {
        $this->authorizeSameCompany($request, $correction);

        if ($correction->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This request has already been reviewed.']]);
        }

        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:255']]);

        $correction->update([
            'status' => 'rejected',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'review_notes' => $data['review_notes'] ?? null,
        ]);
        $notifier->correctionDecided($correction, $request->user());

        return $correction;
    }

    private function authorizeSameCompany(Request $request, AttendanceCorrection $correction): void
    {
        abort_unless($correction->company_id === $request->user()->company_id, 404);
    }
}
