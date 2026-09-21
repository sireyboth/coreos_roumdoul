<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Team extends Model
{
    use Auditable, BelongsToCompany, HasFactory, SoftDeletes;

    // Internal columns no screen reads; hidden so they aren't repeated in every nested copy.
    protected $hidden = ['company_id', 'created_at', 'updated_at', 'deleted_at', 'laravel_through_key'];

    protected $fillable = [
        'company_id',
        'department_id',
        'name',
        'code',
        'status',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }
}
