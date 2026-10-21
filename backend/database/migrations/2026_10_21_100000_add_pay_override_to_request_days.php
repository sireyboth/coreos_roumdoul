<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The approver can decide, day by day, whether leave is paid: 3 days of
 * unpaid leave stay unpaid leave in attendance, but 2 of them are paid.
 *
 *  - employee_request_days.pay_percent: null = the leave type's pay_percent
 *    (every request made before this); 0 or 100 = what the approver chose.
 *  - requests.set_pay: who may choose. Company admins only to start with;
 *    managers still approve, without changing the pay.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_request_days', function (Blueprint $table) {
            $table->unsignedTinyInteger('pay_percent')->nullable()->after('part');
        });

        DB::table('company_permissions')->insertOrIgnore(['code' => 'requests.set_pay', 'name' => 'requests.set_pay', 'created_at' => now(), 'updated_at' => now()]);
        $setPay = DB::table('company_permissions')->where('code', 'requests.set_pay')->value('id');

        foreach (DB::table('company_roles')->where('code', 'company-admin')->pluck('id') as $roleId) {
            DB::table('company_role_permission')->insertOrIgnore([
                'company_role_id' => $roleId, 'company_permission_id' => $setPay, 'created_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $id = DB::table('company_permissions')->where('code', 'requests.set_pay')->value('id');
        DB::table('company_role_permission')->where('company_permission_id', $id)->delete();
        DB::table('company_permissions')->where('id', $id)->delete();

        Schema::table('employee_request_days', function (Blueprint $table) {
            $table->dropColumn('pay_percent');
        });
    }
};
