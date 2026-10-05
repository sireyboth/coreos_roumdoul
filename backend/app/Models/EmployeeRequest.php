<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

/**
 * Anything an employee asks for that someone has to approve. Every type
 * shares this base — who, what, when, why, a file, the approval chain and
 * the status — and keeps its few extra fields in `details`.
 *
 * Status: pending → approved | rejected; pending or approved → cancelled.
 */
class EmployeeRequest extends Model
{
    use Auditable, BelongsToCompany;

    /**
     * leave       time off (leave_type_id says which kind)
     * late_early  permission to arrive late or leave early on one day;
     *             details: {kind: late|early, time: "HH:MM", minutes}
     */
    public const TYPES = ['leave', 'late_early'];

    public const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

    /** Still counts: holds the days (overlaps) and the balance. */
    public const ACTIVE_STATUSES = ['pending', 'approved'];

    public const DAY_PARTS = ['full', 'am', 'pm'];

    protected $fillable = [
        'company_id', 'employee_id', 'requested_by', 'type', 'leave_type_id', 'start_date', 'end_date',
        'day_part', 'days', 'reason', 'details', 'status', 'decided_by', 'decided_at', 'decision_notes',
        'cancelled_by', 'cancelled_at', 'cancel_reason',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'days' => 'float',
            'details' => 'array',
            'decided_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /** What it is, in words: "Annual leave", "Late arrival", "Early leave". */
    public function label(): string
    {
        return match ($this->type) {
            'late_early' => ($this->details['kind'] ?? null) === 'early' ? 'Early leave' : 'Late arrival',
            default => $this->leaveType?->name ?? 'Leave',
        };
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function dates(): HasMany
    {
        return $this->hasMany(EmployeeRequestDay::class)->orderBy('date');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function approval(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }
}
