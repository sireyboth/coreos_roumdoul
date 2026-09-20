<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyModuleEntitlement extends Model
{
    use Auditable, BelongsToCompany, HasFactory;

    protected static function booted(): void
    {
        $notify = function (self $entitlement) {
            $title = $entitlement->is_enabled
                ? "{$entitlement->module->name} has been enabled for your company"
                : "{$entitlement->module->name} has been disabled for your company";

            $entitlement->company
                ->users()
                ->whereHas('membership.roles', fn ($query) => $query->where('code', 'company-admin'))
                ->get()
                ->each(fn (User $admin) => NotificationService::send(
                    $admin,
                    'module_access_changed',
                    $title,
                    data: ['module_key' => $entitlement->module->code, 'enabled' => $entitlement->is_enabled],
                ));
        };

        static::created($notify);
        static::updated($notify);
    }

    protected $fillable = [
        'company_id',
        'module_id',
        'subscription_id',
        'is_enabled',
        'source',
        'note',
        'override_reason',
        'starts_at',
        'ends_at',
        'changed_by_platform_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function changedByPlatformAdmin(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'changed_by_platform_admin_id');
    }
}
