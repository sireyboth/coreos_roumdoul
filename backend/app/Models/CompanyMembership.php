<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyMembership extends Model
{
    protected $fillable = ['company_id', 'user_id', 'login_id', 'status', 'joined_at'];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(CompanyRole::class, 'membership_role');
    }

    public function branchAccess(): HasMany
    {
        return $this->hasMany(MembershipBranchAccess::class);
    }

    public function hasCompanyPermission(string $code): bool
    {
        return $this->roles()
            ->whereHas('permissions', fn ($query) => $query->where('code', $code))
            ->exists();
    }

    /**
     * @return array<int, string>
     */
    public function permissionCodes(): array
    {
        return $this->roles()
            ->with('permissions:id,code')
            ->get()
            ->pluck('permissions')
            ->flatten()
            ->pluck('code')
            ->unique()
            ->values()
            ->all();
    }

    public function hasBranchRestriction(): bool
    {
        return $this->branchAccess()->exists();
    }

    /**
     * Null means unrestricted (access to every branch in the company).
     *
     * @return array<int>|null
     */
    public function accessibleBranchIds(): ?array
    {
        if (! $this->hasBranchRestriction()) {
            return null;
        }

        return $this->branchAccess()->pluck('branch_id')->all();
    }
}
