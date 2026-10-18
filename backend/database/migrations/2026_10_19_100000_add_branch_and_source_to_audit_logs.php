<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The audit log becomes readable inside the app, not only by platform admins:
 * - branch_id: which branch the change touched, so a manager limited to some
 *   branches only sees what happened there.
 * - subject_label: a readable "what" (e.g. the employee's name) that survives
 *   the record being deleted later.
 * - method / path: where in the app the change came from.
 * - audit.view: who may read it. Given to every role that can already manage
 *   the company; other roles get it from the Roles page.
 */
return new class extends Migration
{
    /** Audited records that point at one employee: their branch is that employee's. */
    private const EMPLOYEE_TABLES = [
        'App\\Models\\AttendanceCorrection' => 'attendance_corrections',
        'App\\Models\\AttendanceEvent' => 'attendance_events',
        'App\\Models\\AttendanceDay' => 'attendance_days',
        'App\\Models\\DayOff' => 'day_offs',
        'App\\Models\\EmployeeRequest' => 'employee_requests',
        'App\\Models\\EmployeeScheduleAssignment' => 'employee_schedule_assignments',
        'App\\Models\\LeaveAdjustment' => 'leave_adjustments',
        'App\\Models\\Schedule' => 'schedules',
        'App\\Models\\EmployeeSalary' => 'employee_salaries',
        'App\\Models\\EmployeePayItem' => 'employee_pay_items',
        'App\\Models\\EmployeePayProfile' => 'employee_pay_profiles',
        'App\\Models\\EmployeePayGroup' => 'employee_pay_groups',
        'App\\Models\\PayrollAdjustment' => 'payroll_adjustments',
    ];

    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('company_id')->constrained()->nullOnDelete();
            $table->string('subject_label')->nullable()->after('subject_id');
            $table->string('method', 10)->nullable()->after('request_id');
            $table->string('path')->nullable()->after('method');

            $table->index(['company_id', 'created_at']);
            $table->index(['company_id', 'branch_id', 'created_at']);
        });

        $this->backfillBranches();
        $this->grantPermission();
    }

    public function down(): void
    {
        $id = DB::table('company_permissions')->where('code', 'audit.view')->value('id');
        DB::table('company_role_permission')->where('company_permission_id', $id)->delete();
        DB::table('company_permissions')->where('id', $id)->delete();

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'created_at']);
            $table->dropIndex(['company_id', 'branch_id', 'created_at']);
            $table->dropConstrainedForeignId('branch_id');
            $table->dropColumn(['subject_label', 'method', 'path']);
        });
    }

    /**
     * Best effort for rows written before branch_id existed: the branch the
     * employee is in now (or was last in). Rows it can't place stay
     * company-wide, which only people with access to every branch see.
     */
    private function backfillBranches(): void
    {
        $latestBranch = fn (string $employeeId) => "(SELECT ea.branch_id FROM employee_assignments ea WHERE ea.employee_id = {$employeeId} ORDER BY ea.id DESC LIMIT 1)";

        DB::table('audit_logs')->where('subject_type', 'App\\Models\\Branch')
            ->update(['branch_id' => DB::raw('(SELECT b.id FROM branches b WHERE b.id = audit_logs.subject_id)')]);

        foreach (['App\\Models\\Department' => 'departments', 'App\\Models\\WorkLocation' => 'work_locations'] as $type => $table) {
            if (Schema::hasColumn($table, 'branch_id')) {
                DB::table('audit_logs')->where('subject_type', $type)
                    ->update(['branch_id' => DB::raw("(SELECT t.branch_id FROM {$table} t WHERE t.id = audit_logs.subject_id)")]);
            }
        }

        DB::table('audit_logs')->where('subject_type', 'App\\Models\\Employee')
            ->update(['branch_id' => DB::raw($latestBranch('audit_logs.subject_id'))]);

        foreach (self::EMPLOYEE_TABLES as $type => $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'employee_id')) {
                DB::table('audit_logs')->where('subject_type', $type)
                    ->update(['branch_id' => DB::raw($latestBranch("(SELECT t.employee_id FROM {$table} t WHERE t.id = audit_logs.subject_id)"))]);
            }
        }
    }

    private function grantPermission(): void
    {
        DB::table('company_permissions')->insertOrIgnore(['code' => 'audit.view', 'name' => 'audit.view', 'created_at' => now(), 'updated_at' => now()]);
        $audit = DB::table('company_permissions')->where('code', 'audit.view')->value('id');
        $manage = DB::table('company_permissions')->where('code', 'company.manage')->value('id');

        if ($manage) {
            foreach (DB::table('company_role_permission')->where('company_permission_id', $manage)->pluck('company_role_id') as $roleId) {
                DB::table('company_role_permission')->insertOrIgnore([
                    'company_role_id' => $roleId, 'company_permission_id' => $audit, 'created_at' => now(),
                ]);
            }
        }
    }
};
