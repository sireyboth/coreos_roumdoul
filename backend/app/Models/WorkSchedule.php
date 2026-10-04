<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use App\Models\Concerns\HasDisplayOrder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * What an employee should do: for each weekday, any number of IN/OUT slots,
 * plus the tolerance and overtime rules that apply to all of them. Which
 * weekdays a person has off lives on their assignment, not here — so many
 * people can share one schedule with different days off.
 */
class WorkSchedule extends Model
{
    use Auditable, BelongsToCompany, HasDisplayOrder, SoftDeletes;

    public const OVERTIME_MODES = ['off', 'after_last_out', 'above_scheduled'];

    protected $hidden = ['company_id', 'created_at', 'updated_at', 'deleted_at', 'laravel_through_key'];

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'is_active',
        'auto_attendance',
        'late_grace_minutes',
        'early_leave_grace_minutes',
        'break_minutes',
        'is_break_paid',
        'default_days_off',
        'overtime_mode',
        'overtime_min_minutes',
        'overtime_count_early',
        'overtime_round_minutes',
        'overtime_requires_approval',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'auto_attendance' => 'boolean',
            'is_break_paid' => 'boolean',
            'overtime_count_early' => 'boolean',
            'overtime_requires_approval' => 'boolean',
            'default_days_off' => 'array',
            'late_grace_minutes' => 'integer',
            'early_leave_grace_minutes' => 'integer',
            'break_minutes' => 'integer',
            'overtime_min_minutes' => 'integer',
            'overtime_round_minutes' => 'integer',
        ];
    }

    public function days(): HasMany
    {
        return $this->hasMany(WorkScheduleDay::class)->orderBy('weekday');
    }

    public function slots(): HasManyThrough
    {
        return $this->hasManyThrough(WorkScheduleSlot::class, WorkScheduleDay::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(EmployeeScheduleAssignment::class);
    }

    /**
     * The slots for one weekday (0 = Sunday), in order. Empty when the
     * schedule has nothing on that day. Reads the loaded relation when there
     * is one, so resolving a whole month doesn't query per day.
     *
     * @return array<int, array{sequence: int, type: string, time: string, next_day: bool}>
     */
    public function slotsFor(int $weekday): array
    {
        $day = $this->days->firstWhere('weekday', $weekday);

        return $day ? $day->slots->sortBy('sequence')->map(fn (WorkScheduleSlot $slot) => [
            'sequence' => (int) $slot->sequence,
            'type' => $slot->type,
            'time' => substr($slot->time, 0, 5),
            'next_day' => (bool) $slot->next_day,
        ])->values()->all() : [];
    }

    /** The rules a day is judged by — copied into each day's snapshot. */
    public function rules(): array
    {
        return [
            'late_grace_minutes' => $this->late_grace_minutes,
            'early_leave_grace_minutes' => $this->early_leave_grace_minutes,
            'break_minutes' => $this->break_minutes,
            'is_break_paid' => $this->is_break_paid,
            'overtime_mode' => $this->overtime_mode,
            'overtime_min_minutes' => $this->overtime_min_minutes,
            'overtime_count_early' => $this->overtime_count_early,
            'overtime_round_minutes' => $this->overtime_round_minutes,
            'overtime_requires_approval' => $this->overtime_requires_approval,
            'auto_attendance' => $this->auto_attendance,
        ];
    }
}
