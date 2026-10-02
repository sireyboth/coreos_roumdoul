<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * On PostgreSQL an enum column is a varchar plus a CHECK constraint, and
     * widen_employee_statuses only changed the type — the old four-value
     * check survived and still rejects 'resigned' and the other new statuses.
     * (SQLite rebuilds the table on change and MySQL replaces the enum, so
     * only PostgreSQL needs this.)
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table employees drop constraint if exists employees_employment_status_check');
        }
    }

    public function down(): void
    {
        // Not restored: the old check would reject the statuses added since.
    }
};
