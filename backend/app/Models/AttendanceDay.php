<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One employee's day: what was expected (a frozen snapshot of the schedule)
 * next to what actually happened (their scans), and everything worked out
 * from the two — late, early leave, missing scans, hours, overtime.
 *
 * Always produced by AttendanceCalculator via AttendanceRecorder, never
 * edited by hand: to change a day, change its inputs (a scan, a correction,
 * an override) and it is recalculated. Not Auditable on purpose — it is
 * rewritten after every scan; the actions that cause changes are audited.
 */
class AttendanceDay extends Model
{
    use BelongsToCompany;

    public const STATUSES = ['upcoming', 'in_progress', 'complete', 'incomplete', 'absent', 'off', 'worked_off', 'unscheduled'];

    public const EXCEPTIONS = [
        'late', 'early_leave', 'missing_in', 'missing_out', 'absent',
        'extra_scan', 'worked_day_off', 'worked_holiday', 'unscheduled_work', 'overtime_pending',
    ];

    protected $hidden = ['company_id', 'laravel_through_key'];

    protected $fillable = [
        'company_id', 'employee_id', 'date',
        'kind', 'source', 'work_schedule_id', 'label', 'expected', 'scans',
        'slots', 'extra_scans', 'scan_count', 'first_scan_at', 'last_scan_at',
        'status', 'is_closed',
        'scheduled_minutes', 'worked_minutes', 'late_minutes', 'early_leave_minutes', 'night_minutes',
        'overtime_minutes', 'overtime_type', 'overtime_status', 'overtime_reviewed_by', 'overtime_reviewed_at',
        'exceptions', 'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'expected' => 'array',
            'scans' => 'array',
            'slots' => 'array',
            'extra_scans' => 'array',
            'exceptions' => 'array',
            'is_closed' => 'boolean',
            'first_scan_at' => 'datetime',
            'last_scan_at' => 'datetime',
            'overtime_reviewed_at' => 'datetime',
            'calculated_at' => 'datetime',
            'scan_count' => 'integer',
            'scheduled_minutes' => 'integer',
            'worked_minutes' => 'integer',
            'late_minutes' => 'integer',
            'early_leave_minutes' => 'integer',
            'night_minutes' => 'integer',
            'overtime_minutes' => 'integer',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function workSchedule(): BelongsTo
    {
        return $this->belongsTo(WorkSchedule::class)->withTrashed();
    }

    public function overtimeReviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'overtime_reviewed_by');
    }
}
