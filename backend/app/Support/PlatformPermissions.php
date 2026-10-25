<?php

namespace App\Support;

/**
 * What a platform admin (the /admin panel) can do — the platform's own
 * counterpart of CompanyPermissions. Each area of the panel has .view (see its
 * list) and .manage (create, edit, delete). The super-admin role can do
 * everything, including areas added later.
 */
class PlatformPermissions
{
    public const SUPER_ADMIN = 'super-admin';

    /** One per Filament resource; see RequiresPlatformPermission. */
    public const AREAS = [
        'companies', 'subscriptions', 'plans', 'modules', 'module_entitlements',
        'feature_flags', 'statutory_rates', 'tax_exchange_rates', 'system_settings', 'audit_logs',
    ];

    /** Opening a support session on a customer company: its own right, apart from editing companies. */
    public const STANDALONE = ['support_access.manage'];

    /**
     * @return array<int, string>
     */
    public static function all(): array
    {
        $permissions = self::STANDALONE;

        foreach (self::AREAS as $area) {
            $permissions[] = "{$area}.view";
            $permissions[] = "{$area}.manage";
        }

        return $permissions;
    }
}
