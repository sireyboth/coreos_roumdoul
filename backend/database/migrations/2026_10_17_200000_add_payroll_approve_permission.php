<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * payroll.approve: approving a pay run becomes its own permission, so HR can
 * prepare runs while only a manager approves them. Every role that could
 * approve until now (payroll.manage) keeps that right; take it away per role.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('company_permissions')->insertOrIgnore(['code' => 'payroll.approve', 'name' => 'payroll.approve', 'created_at' => now(), 'updated_at' => now()]);
        $approve = DB::table('company_permissions')->where('code', 'payroll.approve')->value('id');
        $manage = DB::table('company_permissions')->where('code', 'payroll.manage')->value('id');

        if ($manage) {
            foreach (DB::table('company_role_permission')->where('company_permission_id', $manage)->pluck('company_role_id') as $roleId) {
                DB::table('company_role_permission')->insertOrIgnore([
                    'company_role_id' => $roleId, 'company_permission_id' => $approve, 'created_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        $id = DB::table('company_permissions')->where('code', 'payroll.approve')->value('id');
        DB::table('company_role_permission')->where('company_permission_id', $id)->delete();
        DB::table('company_permissions')->where('id', $id)->delete();
    }
};
