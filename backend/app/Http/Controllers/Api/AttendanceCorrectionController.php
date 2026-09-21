<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\Employee;
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

        return $query->orderByDesc('created_at')->paginate(50);
    }

    public function store(Request $request)
    {
        $canManageOthers = $request->user()->hasCompanyPermission('attendance.manage');

        $data = $request->validate([
            'employee_id' => [$canManageOthers ? 'required' : 'nullable', 'exists:employees,id'],
            'date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:1000'],
            'requested_check_in' => ['nullable', 'date'],
            'requested_check_out' => ['nullable', 'date'],
        ]);

        if (empty($data['requested_check_in']) && empty($data['requested_check_out'])) {
            throw ValidationException::withMessages([
                'requested_check_in' => ['Provide a check-in and/or check-out time to request.'],
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
        $timezone = Employee::query()->findOrFail($employeeId)->company?->timezone ?: config('attendance.default_timezone');
        $toUtc = fn (?string $value) => $value
            ? Carbon::parse($value, $timezone)->setTimezone(config('app.timezone'))
            : null;

        $correction = AttendanceCorrection::query()->create([
            'employee_id' => $employeeId,
            'date' => $data['date'],
            'requested_by' => $request->user()->id,
            'reason' => $data['reason'],
            'requested_check_in' => $toUtc($data['requested_check_in'] ?? null),
            'requested_check_out' => $toUtc($data['requested_check_out'] ?? null),
        ]);

        return response()->json($correction->load('employee'), 201);
    }

    public function approve(Request $request, AttendanceCorrection $correction, AttendanceService $attendance)
    {
        $this->authorizeSameCompany($request, $correction);

        if ($correction->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This request has already been reviewed.']]);
        }

        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:255']]);

        $attendance->approveCorrection($correction, $request->user()->id, $data['review_notes'] ?? null);

        return $correction->fresh(['employee', 'session']);
    }

    public function reject(Request $request, AttendanceCorrection $correction)
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

        return $correction;
    }

    private function authorizeSameCompany(Request $request, AttendanceCorrection $correction): void
    {
        abort_unless($correction->company_id === $request->user()->company_id, 404);
    }
}
