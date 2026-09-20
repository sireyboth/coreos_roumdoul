<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be appended to the model's array/JSON form.
     *
     * @var list<string>
     */
    protected $appends = [
        'company_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /**
     * A user has exactly one company membership for now — no
     * company-switcher UI exists yet, though the schema allows more.
     */
    public function membership(): HasOne
    {
        return $this->hasOne(CompanyMembership::class);
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    public function company(): HasOneThrough
    {
        return $this->hasOneThrough(
            Company::class,
            CompanyMembership::class,
            'user_id',
            'id',
            'id',
            'company_id',
        );
    }

    /**
     * Computed for compatibility with the many call sites that read
     * $user->company_id as a plain column — the real relationship is the
     * company_memberships row, not a column on this table.
     */
    public function getCompanyIdAttribute(): ?int
    {
        return $this->membership?->company_id;
    }

    public function hasCompanyPermission(string $code): bool
    {
        return $this->membership?->hasCompanyPermission($code) ?? false;
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'recipient_user_id')->latest('created_at');
    }
}
