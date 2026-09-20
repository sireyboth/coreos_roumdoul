<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CompanyRole extends Model
{
    protected $fillable = ['company_id', 'name', 'code', 'description', 'is_system_role'];

    protected function casts(): array
    {
        return [
            'is_system_role' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(CompanyPermission::class, 'company_role_permission');
    }

    public function memberships(): BelongsToMany
    {
        return $this->belongsToMany(CompanyMembership::class, 'membership_role');
    }
}
