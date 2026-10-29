<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\Employee;
use App\Services\Attendance\AttendanceNotifier;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\AttendanceService;
use App\Support\SelfApproval;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AttendanceCorrectionController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $query = AttendanceCorrection::query()
            ->with(['employee.currentAssignment', 'requestedBy', 'reviewedBy'])
            ->when($request->filled('from'), fn ($q) => $q->whereDate('date', '>=', $request->input('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('date', '<=', $request->input('to')));

        if (! $request->user()->hasCompanyPermission('attendance.manage')) {
            $query->whereHas('employee', fn ($q) => $q->where('user_id', $request->user()->id));
        } else {
            // Through Employee, so a manager limited to some branches only sees theirs.
            $query->whereHas('employee');
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
                'scans' => [__('Add at least one scan time to request.')],
            ]);
        }

        $employeeId = $data['employee_id'] ?? $request->user()->employee?->id;

        if (! $employeeId) {
            throw ValidationException::withMessages([
                'employee' => [__('Your account isn\'t linked to an employee record yet.')],
            ]);
        }

        if (! $canManageOthers && $employeeId !== $request->user()->employee?->id) {
            abort(403);
        }

        // The times were typed on the employee's wall clock — read them in the
        // company's timezone, then store them as the same instant in UTC.
        $employee = Employee::query()->findOrFail($employeeId);
        $timezone = $employee->company?->timezone ?: config('attendance.default_timezone');
        $recorder->assertUnlocked($employee->company_id, Carbon::parse($data['date'])->toDateString(), employeeId: $employee->id);

        // Each scan belongs to the day being corrected (or its next morning, for a
        // night shift) — never to another, possibly locked or already paid, day.
        $date = Carbon::parse($data['date'])->toDateString();
        $nextDay = Carbon::parse($data['date'])->addDay()->toDateString();
        foreach ($times as $value) {
            $day = Carbon::parse($value, $timezone)->toDateString();
            if ($day !== $date && $day !== $nextDay) {
                throw ValidationException::withMessages([
                    'scans' => [__('Scan times must be on :date (or the next morning for a night shift).', ['date' => $date])],
                ]);
            }
            $recorder->assertUnlocked($employee->company_id, $day, employeeId: $employee->id);
        }

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
        SelfApproval::assertNotSelf($request->user(), $correction->employee_id, 'status', 'approve a correction for');

        if ($correction->status !== 'pending') {
            throw ValidationException::withMessages(['status' => [__('This request has already been reviewed.')]]);
        }

        // A remark to the employee: optional when approving.
        $data = $request->validate(['review_notes' => ['nullable', 'string', 'max:500']]);

        $attendance->approveCorrection($correction, $request->user()->id, $data['review_notes'] ?? null);
        $notifier->correctionDecided($correction, $request->user());

        return $correction->fresh(['employee', 'reviewedBy'])->append('requested_times');
    }

    public function reject(Request $request, AttendanceCorrection $correction, AttendanceNotifier $notifier)
    {
        $this->authorizeSameCompany($request, $correction);

        if ($correction->status !== 'pending') {
            throw ValidationException::withMessages(['status' => [__('This request has already been reviewed.')]]);
        }

        // A "no" always says why — the employee reads it.
        $data = $request->validate(['review_notes' => ['required', 'string', 'max:500']]);

        // Only if still pending: another manager may have decided it a moment ago.
        if (! $correction->decide('rejected', $request->user()->id, $data['review_notes'])) {
            throw ValidationException::withMessages(['status' => [__('This request has already been reviewed.')]]);
        }

        $notifier->correctionDecided($correction, $request->user());

        return $correction->load(['employee', 'reviewedBy'])->append('requested_times');
    }

    /**
     * Withdraws a correction still waiting. The employee can, for any reason;
     * a manager can too, with a remark the employee reads. An approved one
     * can't be cancelled — its scans are in; fix the day with an adjustment.
     */
    public function cancel(Request $request, AttendanceCorrection $correction, AttendanceNotifier $notifier)
    {
        abort_unless($correction->company_id === $request->user()->company_id, 404);
        $user = $request->user();
        $own = $correction->requested_by === $user->id
            || Employee::query()->withoutGlobalScope('branch_access')->whereKey($correction->employee_id)->value('user_id') === $user->id;
        $manages = $user->hasCompanyPermission('attendance.manage') && Employee::query()->whereKey($correction->employee_id)->exists();
        abort_unless($own || $manages, 404);

        $data = $request->validate(['review_notes' => [$own ? 'nullable' : 'required', 'string', 'max:500']]);

        if ($correction->status !== 'pending' || ! $correction->decide('cancelled', $user->id, $data['review_notes'] ?? null)) {
            throw ValidationException::withMessages(['status' => [$correction->status === 'approved'
                ? __('This correction is already approved — ask a manager to adjust the day instead.')
                : __('This request has already been :status.', ['status' => __($correction->status)])]]);
        }

        $notifier->correctionCancelled($correction, $user);

        return $correction->load(['employee', 'reviewedBy'])->append('requested_times');
    }

    /** Same company, and an employee the reviewer can see — a manager limited to some branches decides only theirs. */
    private function authorizeSameCompany(Request $request, AttendanceCorrection $correction): void
    {
        abort_unless($correction->company_id === $request->user()->company_id, 404);
        abort_unless(Employee::query()->whereKey($correction->employee_id)->exists(), 404);
    }
}
