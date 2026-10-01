<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SALARY_PERMISSIONS = ['salary.view', 'salary.manage'];

    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            // Identity. first_name / last_name already exist; display_name stays the main name.
            $table->string('name_km')->nullable()->after('display_name');
            $table->string('nationality', 100)->nullable()->after('date_of_birth');
            $table->string('national_id_number', 50)->nullable()->after('nationality');
            $table->string('passport_number', 50)->nullable()->after('national_id_number');

            // Payroll and compliance.
            $table->string('nssf_number', 50)->nullable()->after('notes');
            $table->string('tax_id', 50)->nullable()->after('nssf_number');
            $table->string('bank_name', 100)->nullable()->after('tax_id');
            $table->string('bank_account_number', 50)->nullable()->after('bank_name');
            // Monthly base pay. Riel amounts run into the millions, so 12 digits leaves room.
            $table->decimal('base_salary', 14, 2)->nullable()->after('bank_account_number');
            $table->string('salary_currency', 3)->nullable()->after('base_salary');
        });

        // Pay is more sensitive than the rest of a profile, so it gets its own
        // permission. Only each company's built-in admin role gets it; any
        // other role has to be given it on the Roles page. New companies get
        // the same default from CompanyPermissions::forRole().
        foreach (self::SALARY_PERMISSIONS as $code) {
            DB::table('company_permissions')->insertOrIgnore([
                'code' => $code, 'name' => $code, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $permissionIds = DB::table('company_permissions')->whereIn('code', self::SALARY_PERMISSIONS)->pluck('id');
        $adminRoleIds = DB::table('company_roles')->where('code', 'company-admin')->pluck('id');

        foreach ($adminRoleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('company_role_permission')->insertOrIgnore([
                    'company_role_id' => $roleId,
                    'company_permission_id' => $permissionId,
                    'created_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissionIds = DB::table('company_permissions')->whereIn('code', self::SALARY_PERMISSIONS)->pluck('id');
        DB::table('company_role_permission')->whereIn('company_permission_id', $permissionIds)->delete();
        DB::table('company_permissions')->whereIn('id', $permissionIds)->delete();

        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn([
                'name_km', 'nationality', 'national_id_number', 'passport_number',
                'nssf_number', 'tax_id', 'bank_name', 'bank_account_number', 'base_salary', 'salary_currency',
            ]);
        });
    }
};
