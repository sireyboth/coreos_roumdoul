<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One weekday of a work schedule. A weekday with no row has no slots. */
class WorkScheduleDay extends Model
{
    protected $hidden = ['created_at', 'updated_at', 'laravel_through_key'];

    protected $fillable = ['work_schedule_id', 'weekday'];

    protected function casts(): array
    {
        return ['weekday' => 'integer'];
    }

    public function workSchedule(): BelongsTo
    {
        return $this->belongsTo(WorkSchedule::class)->withTrashed();
    }

    public function slots(): HasMany
    {
        return $this->hasMany(WorkScheduleSlot::class)->orderBy('sequence');
    }
}
