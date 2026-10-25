<?php

use App\Support\PlatformPermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The /admin panel now checks each admin's platform roles. Every admin that
 * exists today becomes a super-admin, so nobody loses access; narrower roles
 * can be handed out from here on.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (PlatformPermissions::all() as $code) {
            DB::table('platform_permissions')->insertOrIgnore(['code' => $code, 'name' => $code, 'created_at' => now(), 'updated_at' => now()]);
        }

        DB::table('platform_roles')->insertOrIgnore([
            'code' => PlatformPermissions::SUPER_ADMIN,
            'name' => 'Super admin',
            'description' => 'Everything in the platform panel.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $roleId = DB::table('platform_roles')->where('code', PlatformPermissions::SUPER_ADMIN)->value('id');

        foreach (DB::table('platform_admins')->pluck('id') as $adminId) {
            DB::table('platform_admin_role')->insertOrIgnore(['platform_admin_id' => $adminId, 'platform_role_id' => $roleId]);
        }
    }

    public function down(): void
    {
        $roleId = DB::table('platform_roles')->where('code', PlatformPermissions::SUPER_ADMIN)->value('id');
        DB::table('platform_admin_role')->where('platform_role_id', $roleId)->delete();
        DB::table('platform_roles')->where('id', $roleId)->delete();
        DB::table('platform_permissions')->whereIn('code', PlatformPermissions::all())->delete();
    }
};
