<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One expected scan: the n-th IN or OUT of the day, at a time. */
class WorkScheduleSlot extends Model
{
    protected $hidden = ['created_at', 'updated_at', 'laravel_through_key'];

    protected $fillable = ['work_schedule_day_id', 'sequence', 'type', 'time', 'next_day'];

    protected function casts(): array
    {
        return ['sequence' => 'integer', 'next_day' => 'boolean'];
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(WorkScheduleDay::class, 'work_schedule_day_id');
    }
}
