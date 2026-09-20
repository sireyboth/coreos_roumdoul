<?php

namespace App\Models;

use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Not using the Auditable trait here: a company's own audit log always
     * belongs to itself (company_id = its own id), even for "created", which
     * happens during registration before anyone is logged in to attribute it
     * to. Every other Auditable model can rely on the current user's company.
     */
    protected static function booted(): void
    {
        static::created(fn (self $company) => AuditLogger::record('company.created', $company, $company->getAttributes(), $company->id));
        static::updated(function (self $company) {
            $changes = $company->getChanges();
            unset($changes['updated_at']);

            if (! empty($changes)) {
                AuditLogger::record('company.updated', $company, $changes, $company->id);
            }
        });
        static::deleted(fn (self $company) => AuditLogger::record('company.deleted', $company, [], $company->id));
    }

    protected $fillable = [
        'name',
        'slug',
        'company_code',
        'display_name',
        'email',
        'phone',
        'industry',
        'timezone',
        'country_code',
        'default_currency',
        'status',
        'trial_ends_at',
        'default_rest_days',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'default_rest_days' => 'array',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CompanyMembership::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(CompanyRole::class);
    }

    public function users(): HasManyThrough
    {
        return $this->hasManyThrough(
            User::class,
            CompanyMembership::class,
            'company_id',
            'id',
            'id',
            'user_id',
        );
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function moduleEntitlements(): HasMany
    {
        return $this->hasMany(CompanyModuleEntitlement::class);
    }

    public function usageRecords(): HasMany
    {
        return $this->hasMany(UsageRecord::class);
    }

    public function supportAccessSessions(): HasMany
    {
        return $this->hasMany(SupportAccessSession::class);
    }

    public function workLocations(): HasMany
    {
        return $this->hasMany(WorkLocation::class);
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }

    public function holidays(): HasMany
    {
        return $this->hasMany(Holiday::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class);
    }

    /**
     * Modules this company can currently use: an explicit entitlement row
     * always wins, otherwise it falls back to whatever the active plan grants.
     * A time-boxed override (starts_at/ends_at) only wins while "now" is
     * inside that window — outside it, the override is ignored entirely and
     * access falls back to the plan, rather than staying stuck on forever.
     */
    public function hasModule(string $moduleKey): bool
    {
        $module = Module::query()->where('code', $moduleKey)->first();

        if (! $module) {
            return false;
        }

        $override = $this->moduleEntitlements()->where('module_id', $module->id)->first();

        if ($override && $this->entitlementIsActive($override)) {
            return $override->is_enabled;
        }

        return $this->subscription
            ?->plan
            ?->modules()
            ->where('modules.id', $module->id)
            ->exists() ?? false;
    }

    private function entitlementIsActive(CompanyModuleEntitlement $entitlement): bool
    {
        $now = now();

        if ($entitlement->starts_at && $now->lt($entitlement->starts_at)) {
            return false;
        }

        if ($entitlement->ends_at && $now->gt($entitlement->ends_at)) {
            return false;
        }

        return true;
    }

    /**
     * A trial that has run past its own end date but was never explicitly
     * moved to active/suspended/cancelled by a platform admin — access is
     * cut the same way a suspended company's is.
     */
    public function isTrialExpired(): bool
    {
        return $this->status === 'trial'
            && $this->trial_ends_at !== null
            && $this->trial_ends_at->isPast();
    }

    /**
     * Plan limits are null = unlimited. Used to stop a company adding more
     * branches/employees than their plan allows before it becomes a billing
     * dispute instead of a validation error.
     */
    public function hasReachedBranchLimit(): bool
    {
        $limit = $this->subscription?->plan?->max_branches;

        return $limit !== null && $this->branches()->count() >= $limit;
    }

    public function hasReachedEmployeeLimit(): bool
    {
        $limit = $this->subscription?->plan?->max_employees;

        return $limit !== null && $this->employees()->count() >= $limit;
    }
}
