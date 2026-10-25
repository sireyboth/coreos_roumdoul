<?php

namespace App\Filament\Concerns;

use App\Models\PlatformAdmin;
use Illuminate\Database\Eloquent\Model;

/**
 * Gates a Filament resource by the signed-in admin's platform permissions
 * (see PlatformPermissions): "<area>.view" to open it, "<area>.manage" for
 * everything else. Every can*() check of a resource goes through can().
 *
 * The resource names its area: protected static string $permissionArea = 'companies';
 */
trait RequiresPlatformPermission
{
    public static function can(string $action, ?Model $record = null): bool
    {
        $level = in_array($action, ['viewAny', 'view'], true) ? 'view' : 'manage';

        return static::admin()?->hasPermission(static::$permissionArea.'.'.$level) ?? false;
    }

    protected static function admin(): ?PlatformAdmin
    {
        $user = auth('platform')->user();

        return $user instanceof PlatformAdmin ? $user : null;
    }
}
