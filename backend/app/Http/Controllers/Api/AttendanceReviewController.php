<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceDay;
use App\Models\AttendancePeriod;
use App\Models\Employee;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\MonthlyAttendance;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * What payroll will read: overtime that needs a manager's approval, the
 * monthly summary per employee, and locking a month once it has been paid
 * so its numbers can't move any more.
 */
class AttendanceReviewController extends Controller
{
    public function __construct(private readonly AttendanceRecorder $recorder) {}

    // ───────────────────────────── Overtime ─────────────────────────────

    /** Days with overtime, pending first. Filter by status (pending/approved/rejected), from, to. */
    public function overtime(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])]]);

        return AttendanceDay::query()
            ->with(['employee:id,display_name,first_name,last_name,employee_code,photo_path,sort_order', 'overtimeReviewedBy:id,name'])
            ->whereHas('employee')
            ->where('overtime_minutes', '>', 0)
            ->when($request->filled('status'), fn ($q) => $q->where('overtime_status', $request->input('status')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('date', '<=', $request->date('to')))
            // Waiting for review first; then each person in display order, their days newest first.
            ->orderByRaw("case when overtime_status = 'pending' then 0 else 1 end")
            ->tap(fn ($q) => Employee::orderRowsByEmployee($q, 'attendance_days.employee_id'))
            ->orderBy('employee_id')
            ->orderByDesc('date')
            ->limit(500)
            ->get()
            ->map(fn (AttendanceDay $day) => [
                'id' => $day->id,
                'date' => $day->date->toDateString(),
                'employee' => ['id' => $day->employee->id, 'name' => $day->employee->name, 'employee_code' => $day->employee->employee_code, 'sort_order' => $day->employee->sort_order],
                'schedule' => $day->expected['schedule_name'] ?? null,
                'worked_minutes' => $day->worked_minutes,
                'scheduled_minutes' => $day->scheduled_minutes,
                'overtime_minutes' => $day->overtime_minutes,
                'overtime_type' => $day->overtime_type,
                'overtime_status' => $day->overtime_status,
                'reviewed_by' => $day->overtimeReviewedBy ? ['id' => $day->overtimeReviewedBy->id, 'name' => $day->overtimeReviewedBy->name] : null,
                'reviewed_at' => $day->overtime_reviewed_at?->toIso8601String(),
                'last_scan_at' => $day->last_scan_at?->toIso8601String(),
            ]);
    }

    public function approveOvertime(Request $request, AttendanceDay $day)
    {
        return $this->reviewOvertime($request, $day, 'approved');
    }

    public function rejectOvertime(Request $request, AttendanceDay $day)
    {
        return $this->reviewOvertime($request, $day, 'rejected');
    }

    private function reviewOvertime(Request $request, AttendanceDay $day, string $decision)
    {
        // Through the employee, so a branch-limited manager can only review their own people.
        if (! Employee::query()->whereKey($day->employee_id)->exists()) {
            abort(404);
        }
        if ($day->overtime_minutes <= 0) {
            throw ValidationException::withMessages(['overtime' => ['This day has no overtime to review.']]);
        }
        $this->recorder->assertUnlocked($day->company_id, $day->date->toDateString(), 'overtime');

        $day->update([
            'overtime_status' => $decision,
            'overtime_reviewed_by' => $request->user()->id,
            'overtime_reviewed_at' => now(),
            'exceptions' => array_values(array_diff($day->exceptions ?? [], ['overtime_pending'])),
        ]);

        AuditLogger::record("attendance.overtime_{$decision}", $day, [
            'employee_id' => $day->employee_id, 'date' => $day->date->toDateString(), 'minutes' => $day->overtime_minutes,
        ]);

        return ['id' => $day->id, 'overtime_status' => $day->overtime_status];
    }

    // ───────────────────────────── Monthly summary ─────────────────────────────

    /**
     * One row per employee for a month: what payroll needs. Overtime only
     * counts once approved (pending is shown separately). Days off and
     * holidays are worked out from the schedule, since a day nobody worked
     * on doesn't keep a record.
     */
    public function summary(Request $request)
    {
        $request->validate([
            'month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'employee_id' => ['nullable', 'integer'],
        ]);

        $company = $request->user()->company;
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $start = CarbonImmutable::parse($request->input('month').'-01', $timezone);
        $end = $start->endOfMonth()->startOfDay();
        $today = now($timezone)->toDateString();
        $manages = $request->user()->hasCompanyPermission('attendance.manage');

        $employees = Employee::query()->with('branch')
            ->when(! $manages, fn ($q) => $q->where('user_id', $request->user()->id))
            ->when($request->filled('employee_id'), fn ($q) => $q->whereKey($request->integer('employee_id')))
            // People who left before this month have nothing to show.
            ->where(fn ($q) => $q->whereNotIn('employment_status', Employee::LEFT_STATUSES)->orWhereDate('termination_date', '>=', $start->toDateString()))
            ->inDisplayOrder()
            ->limit(1000)
            ->get();

        $totals = MonthlyAttendance::for($company, $employees, $start);

        $rows = $employees->map(function (Employee $employee) use ($totals, $end, $today) {
            $t = $totals->get($employee->id);

            return [
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'employee_code' => $employee->employee_code,
                    'sort_order' => $employee->sort_order,
                    'branch' => $employee->branch?->name,
                ],
                'scheduled_days' => $t['planned']['work'],
                'weekly_days_off' => $t['planned']['weekly_off'],
                'days_off' => $t['planned']['day_off'],
                'holidays' => $t['planned']['holiday'],
                'leave_days' => $t['leave']['paid'] + $t['leave']['unpaid'],
                'paid_leave_days' => $t['leave']['paid'],
                'unpaid_leave_days' => $t['leave']['unpaid'],
                'excused_minutes' => $t['excused']['all'],
                'unpaid_excused_minutes' => $t['excused']['unpaid'],
                'leave_by_type' => collect($t['leave']['by_type'])->map(fn (float $days, string $type) => ['type' => $type, 'days' => $days])->values(),
                'present_days' => $t['present_days'],
                'absent_days' => $t['absent_days'],
                'incomplete_days' => $t['incomplete_days'],
                'late_days' => $t['late_days'],
                'late_minutes' => $t['late_minutes'],
                'early_leave_minutes' => $t['early_leave_minutes'],
                'scheduled_minutes' => $t['scheduled_minutes'],
                'worked_minutes' => $t['worked_minutes'],
                'night_minutes' => $t['night_minutes'],
                'worked_days_off' => $t['worked_days_off'],
                'worked_holidays' => $t['worked_holidays'],
                'overtime_workday_minutes' => $t['overtime_workday_minutes'],
                'overtime_day_off_minutes' => $t['overtime_day_off_minutes'],
                'overtime_holiday_minutes' => $t['overtime_holiday_minutes'],
                'overtime_pending_minutes' => $t['overtime_pending_minutes'],
                // The month isn't over yet: absences for days still to come can't be counted.
                'is_partial' => $end->toDateString() >= $today,
            ];
        })->values();

        return [
            'month' => $start->format('Y-m'),
            'locked' => $this->recorder->isLocked($company->id, $start->toDateString()),
            'rows' => $rows,
        ];
    }

    // ───────────────────────────── Locked months ─────────────────────────────

    public function periods(Request $request)
    {
        return AttendancePeriod::query()->with('lockedBy:id,name')->orderByDesc('month')->get()
            ->map(fn (AttendancePeriod $p) => [
                'month' => $p->month,
                'locked_at' => $p->locked_at->toIso8601String(),
                'locked_by' => $p->lockedBy ? ['id' => $p->lockedBy->id, 'name' => $p->lockedBy->name] : null,
            ]);
    }

    /**
     * Closes a month for payroll. Its days are recalculated one last time
     * first, so the locked numbers are final, then nothing in it can change
     * until it's reopened.
     */
    public function lock(Request $request)
    {
        $data = $request->validate(['month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/']]);
        $company = $request->user()->company;
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $start = CarbonImmutable::parse($data['month'].'-01', $timezone);
        $end = $start->endOfMonth();

        if ($end->toDateString() >= now($timezone)->toDateString()) {
            throw ValidationException::withMessages(['month' => ['A month can only be locked once it has ended.']]);
        }
        if ($this->recorder->isLocked($company->id, $start->toDateString())) {
            throw ValidationException::withMessages(['month' => [$start->format('F Y').' is already locked.']]);
        }

        $pending = AttendanceDay::query()->where('overtime_status', 'pending')
            ->whereDate('date', '>=', $start->toDateString())->whereDate('date', '<=', $end->toDateString())->count();
        if ($pending > 0 && ! $request->boolean('ignore_pending_overtime')) {
            return response()->json([
                'message' => "{$pending} ".($pending === 1 ? 'day still has' : 'days still have').' overtime waiting for approval. Review it first, or lock anyway (it won\'t be paid).',
                'code' => 'pending_overtime',
                'pending' => $pending,
            ], 422);
        }

        // Every employee, regardless of the caller's branch restriction: a lock is company-wide.
        Employee::query()->withoutGlobalScope('branch_access')->each(
            fn (Employee $employee) => $this->recorder->recalculateRange($employee, $start->toDateString(), $end->toDateString())
        );

        $period = AttendancePeriod::query()->create([
            'company_id' => $company->id,
            'month' => $start->format('Y-m'),
            'locked_at' => now(),
            'locked_by' => $request->user()->id,
        ]);
        $this->recorder->forgetLocks();

        return response()->json(['month' => $period->month, 'locked_at' => $period->locked_at->toIso8601String()], 201);
    }

    public function unlock(Request $request, string $month)
    {
        $period = AttendancePeriod::query()->where('month', $month)->firstOrFail();
        $period->delete();
        $this->recorder->forgetLocks();

        return response()->noContent();
    }
}
