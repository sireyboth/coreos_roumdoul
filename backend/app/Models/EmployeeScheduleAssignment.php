<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "From this date (until that date) this person follows that schedule, with
 * these weekly days off." Dated so a change never rewrites history: switching
 * someone to another schedule ends one assignment and starts the next.
 */
class EmployeeScheduleAssignment extends Model
{
    use Auditable, BelongsToCompany;

    protected $hidden = ['company_id', 'laravel_through_key'];

    protected $fillable = [
        'company_id',
        'employee_id',
        'work_schedule_id',
        'effective_from',
        'effective_to',
        'days_off',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'days_off' => 'array',
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

    /** Assignments in force on a date. */
    public function scopeCovering(Builder $query, string $date): Builder
    {
        return $query->whereDate('effective_from', '<=', $date)
            ->where(fn (Builder $q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $date));
    }

    /** Assignments that overlap the range [from, to] (to = null means open-ended). */
    public function scopeOverlapping(Builder $query, string $from, ?string $to): Builder
    {
        return $query
            ->where(fn (Builder $q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $from))
            ->when($to !== null, fn (Builder $q) => $q->whereDate('effective_from', '<=', $to));
    }

    /** @return array<int, int> weekdays (0 = Sunday) */
    public function daysOff(): array
    {
        return array_map('intval', $this->days_off ?? []);
    }
}
