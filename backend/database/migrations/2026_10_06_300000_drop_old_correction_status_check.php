<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * On PostgreSQL, the old status column (an enum) came with a CHECK rule
 * allowing only pending / approved / rejected. Turning the column into a
 * plain string (2026_10_06_100000) kept that rule, so cancelling a
 * correction failed there. SQLite and MySQL rebuild the column and never
 * had the problem.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE attendance_corrections DROP CONSTRAINT IF EXISTS attendance_corrections_status_check');
        }
    }

    public function down(): void
    {
        // Nothing: the rule is not wanted back (it would refuse "cancelled").
    }
};
