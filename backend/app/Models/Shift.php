<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Shift extends Model
{
    use Auditable, BelongsToCompany, HasFactory, SoftDeletes;

    // Internal columns no screen reads; hidden so they aren't repeated in every nested copy.
    protected $hidden = ['company_id', 'created_at', 'updated_at', 'deleted_at', 'laravel_through_key'];

    protected $fillable = [
        'company_id',
        'name',
        'start_time',
        'end_time',
        'break_minutes',
        'is_break_paid',
        'grace_minutes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_break_paid' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class);
    }
}
