<?php

namespace App\Models;

use App\Support\PlatformPermissions;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * The platform/SaaS team's own login — entirely separate from any tenant
 * company's users. Never shares a table, a guard, or a role system with
 * customer accounts.
 */
class PlatformAdmin extends Authenticatable implements FilamentUser
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(PlatformRole::class, 'platform_admin_role');
    }

    /** @var array<int, string>|null  this admin's codes, read once per request */
    private ?array $permissionCodes = null;

    public function hasPermission(string $code): bool
    {
        if ($this->permissionCodes === null) {
            $roles = $this->roles()->with('permissions:id,code')->get();

            // A super-admin can do everything, including areas added later.
            $this->permissionCodes = $roles->contains('code', PlatformPermissions::SUPER_ADMIN)
                ? ['*']
                : $roles->pluck('permissions')->flatten()->pluck('code')->unique()->values()->all();
        }

        return $this->permissionCodes === ['*'] || in_array($code, $this->permissionCodes, true);
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->status === 'active';
    }
}
