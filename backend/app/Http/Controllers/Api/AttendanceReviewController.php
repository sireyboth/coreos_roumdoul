<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceDay;
use App\Models\AttendancePeriod;
use App\Models\Employee;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\ScheduleResolver;
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
            ->with(['employee:id,display_name,first_name,last_name,employee_code,photo_path', 'overtimeReviewedBy:id,name'])
            ->whereHas('employee')
            ->where('overtime_minutes', '>', 0)
            ->when($request->filled('status'), fn ($q) => $q->where('overtime_status', $request->input('status')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('date', '<=', $request->date('to')))
            ->orderByRaw("case when overtime_status = 'pending' then 0 else 1 end")
            ->orderByDesc('date')
            ->limit(500)
            ->get()
            ->map(fn (AttendanceDay $day) => [
                'id' => $day->id,
                'date' => $day->date->toDateString(),
                'employee' => ['id' => $day->employee->id, 'name' => $day->employee->name, 'employee_code' => $day->employee->employee_code],
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
            ->where(fn ($q) => $q->where('employment_status', '!=', 'terminated')->orWhereDate('termination_date', '>=', $start->toDateString()))
            ->orderBy('display_name')->orderBy('id')
            ->limit(1000)
            ->get();

        $days = AttendanceDay::query()->whereIn('employee_id', $employees->pluck('id'))
            ->whereDate('date', '>=', $start->toDateString())->whereDate('date', '<=', $end->toDateString())
            ->get()->groupBy('employee_id');

        $resolver = new ScheduleResolver($company, $employees->pluck('id'), $start->toDateString(), $end->toDateString());

        $rows = $employees->map(function (Employee $employee) use ($days, $resolver, $start, $end, $today) {
            $planned = ['work' => 0, 'weekly_off' => 0, 'day_off' => 0, 'holiday' => 0, 'unscheduled' => 0];
            for ($day = $start; $day->lte($end); $day = $day->addDay()) {
                $planned[$resolver->resolve($employee->id, $day->toDateString())->kind]++;
            }

            $mine = $days->get($employee->id, collect());
            $worked = $mine->filter(fn (AttendanceDay $d) => $d->scan_count > 0);
            $approvedOt = fn (string $type) => (int) $mine->where('overtime_status', 'approved')->where('overtime_type', $type)->sum('overtime_minutes');

            return [
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'employee_code' => $employee->employee_code,
                    'branch' => $employee->branch?->name,
                ],
                'scheduled_days' => $planned['work'],
                'weekly_days_off' => $planned['weekly_off'],
                'days_off' => $planned['day_off'],
                'holidays' => $planned['holiday'],
                'present_days' => $worked->where('kind', 'work')->count(),
                'absent_days' => $mine->where('status', 'absent')->count(),
                'incomplete_days' => $mine->where('status', 'incomplete')->count(),
                'late_days' => $mine->where('late_minutes', '>', 0)->count(),
                'late_minutes' => (int) $mine->sum('late_minutes'),
                'early_leave_minutes' => (int) $mine->sum('early_leave_minutes'),
                'scheduled_minutes' => (int) $mine->sum('scheduled_minutes'),
                'worked_minutes' => (int) $mine->sum('worked_minutes'),
                'night_minutes' => (int) $mine->sum('night_minutes'),
                'worked_days_off' => $worked->whereIn('kind', ['day_off', 'weekly_off'])->count(),
                'worked_holidays' => $worked->filter(fn (AttendanceDay $d) => ($d->expected['holiday'] ?? null) !== null)->count(),
                'overtime_workday_minutes' => $approvedOt('workday'),
                'overtime_day_off_minutes' => $approvedOt('day_off'),
                'overtime_holiday_minutes' => $approvedOt('holiday'),
                'overtime_pending_minutes' => (int) $mine->where('overtime_status', 'pending')->sum('overtime_minutes'),
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
