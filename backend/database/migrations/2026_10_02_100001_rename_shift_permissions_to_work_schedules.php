<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Shifts became Work Schedules. The permission rows are renamed in place
 * (same ids), so every role keeps exactly the access it had.
 */
return new class extends Migration
{
    private const RENAMES = [
        'shifts.view' => 'work_schedules.view',
        'shifts.manage' => 'work_schedules.manage',
    ];

    public function up(): void
    {
        foreach (self::RENAMES as $old => $new) {
            DB::table('company_permissions')->where('code', $old)->update(['code' => $new, 'name' => $new]);
        }
    }

    public function down(): void
    {
        foreach (self::RENAMES as $old => $new) {
            DB::table('company_permissions')->where('code', $new)->update(['code' => $old, 'name' => $old]);
        }
    }
};
