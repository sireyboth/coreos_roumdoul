<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('company_permissions')->insertOrIgnore([
            'code' => 'dashboard.view',
            'name' => 'dashboard.view',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $permissionId = DB::table('company_permissions')->where('code', 'dashboard.view')->value('id');

        // Everyone could open the dashboard before this permission existed, so
        // existing roles keep it — except the built-in "employee" role, which
        // is the one this change is for. New companies get the same defaults
        // from CompanyPermissions::forRole().
        $roleIds = DB::table('company_roles')
            ->where(fn ($q) => $q->where('code', '!=', 'employee')->orWhere('is_system_role', false))
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            DB::table('company_role_permission')->insertOrIgnore([
                'company_role_id' => $roleId,
                'company_permission_id' => $permissionId,
                'created_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('company_permissions')->where('code', 'dashboard.view')->value('id');

        if ($permissionId) {
            DB::table('company_role_permission')->where('company_permission_id', $permissionId)->delete();
            DB::table('company_permissions')->where('id', $permissionId)->delete();
        }
    }
};
