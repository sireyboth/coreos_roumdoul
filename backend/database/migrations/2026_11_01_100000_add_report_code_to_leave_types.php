<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * How a leave type shows in the attendance report: a short code ("AL") and a
 * colour from LeaveType::COLORS. The existing `code` stays the stable key that
 * reports and integrations rely on; these two are for people and can change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->string('report_code', 3)->nullable()->after('code');
            $table->string('color', 16)->nullable()->after('report_code');
        });

        // The built-in types every company starts with get the usual codes.
        foreach ([
            'annual' => ['AL', 'violet'],
            'sick' => ['SL', 'pink'],
            'special' => ['SP', 'indigo'],
            'maternity' => ['ML', 'fuchsia'],
            'paternity' => ['PL', 'cyan'],
            'unpaid' => ['UL', 'slate'],
        ] as $code => [$reportCode, $color]) {
            DB::table('leave_types')->where('code', $code)->update(['report_code' => $reportCode, 'color' => $color]);
        }
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn(['report_code', 'color']);
        });
    }
};
