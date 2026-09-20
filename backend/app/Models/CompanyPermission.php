<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CompanyPermission extends Model
{
    protected $fillable = ['code', 'name', 'description', 'module_code'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(CompanyRole::class, 'company_role_permission');
    }
}
