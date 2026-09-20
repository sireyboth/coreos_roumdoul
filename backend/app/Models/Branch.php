<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use Auditable, BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'branch_code',
        'code',
        'address',
        'latitude',
        'longitude',
        'timezone',
        'is_active',
    ];

    protected $appends = [
        'code',
        'qr_token',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'is_active' => 'boolean',
        ];
    }

    /**
     * The database column is branch_code (matching the spec); "code" is kept
     * as a compatible alias so the existing frontend contract needs no
     * changes. Same pattern as Employee::name / display_name.
     */
    public function getCodeAttribute(): ?string
    {
        return $this->branch_code;
    }

    public function setCodeAttribute(?string $value): void
    {
        $this->attributes['branch_code'] = $value;
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function workLocation(): HasOne
    {
        return $this->hasOne(WorkLocation::class);
    }

    /**
     * The code employees scan at this branch to check in — exposed here so
     * the frontend doesn't need to know a WorkLocation exists underneath.
     */
    public function getQrTokenAttribute(): ?string
    {
        return $this->workLocation?->qr_token;
    }
}
