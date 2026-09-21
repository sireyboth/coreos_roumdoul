<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL does not index foreign keys automatically (MySQL does), and every
 * query in this app is filtered by company. These are the lookups that run on
 * almost every request or on every list screen and had no index to use.
 * Harmless at demo size, a full table scan per request once real data piles up.
 */
return new class extends Migration
{
    /** @return array<string, array<string, array<int, string>>> table => index name => columns */
    private function indexes(): array
    {
        return [
            // Runs on nearly every request: "who is this user, and what is their membership / employee record?"
            'company_memberships' => ['idx_memberships_user' => ['user_id']],
            'employees' => ['idx_employees_user' => ['user_id']],

            // Department / team headcounts, branch filters and "current assignment" lookups.
            'employee_assignments' => [
                'idx_assignments_company' => ['company_id'],
                'idx_assignments_department_current' => ['department_id', 'effective_to'],
                'idx_assignments_team_current' => ['team_id', 'effective_to'],
                'idx_assignments_branch_current' => ['branch_id', 'effective_to'],
            ],

            // Tenant-scoped reference lists.
            'departments' => ['idx_departments_company' => ['company_id']],
            'teams' => ['idx_teams_company' => ['company_id'], 'idx_teams_department' => ['department_id']],
            'work_locations' => ['idx_work_locations_company' => ['company_id'], 'idx_work_locations_branch' => ['branch_id']],
            'shifts' => ['idx_shifts_company' => ['company_id']],

            // Date-ranged screens: the month roster, attendance lists, the stale-session job.
            'schedules' => ['idx_schedules_company_date' => ['company_id', 'date']],
            'attendance_sessions' => [
                'idx_sessions_company_date' => ['company_id', 'date'],
                'idx_sessions_status' => ['status'],
            ],
            'attendance_corrections' => [
                'idx_corrections_company_status' => ['company_id', 'status'],
                'idx_corrections_employee' => ['employee_id'],
            ],

            // The bell: newest 20 for one user.
            'notifications' => ['idx_notifications_user_created' => ['recipient_user_id', 'created_at']],
            'audit_logs' => ['idx_audit_company_created' => ['company_id', 'created_at']],
        ];
    }

    public function up(): void
    {
        foreach ($this->indexes() as $table => $indexes) {
            foreach ($indexes as $name => $columns) {
                // Safe to re-run, and to run against a database someone already tuned by hand.
                if (Schema::hasIndex($table, $name)) {
                    continue;
                }

                Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes() as $table => $indexes) {
            foreach (array_keys($indexes) as $name) {
                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
                }
            }
        }
    }
};
