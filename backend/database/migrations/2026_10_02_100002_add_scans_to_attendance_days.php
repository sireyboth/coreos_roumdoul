<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every scan of the day, in order — not only the ones matched to a slot. A
 * day off or an unscheduled day has no slots, but its scans still need to be
 * shown (where, how, when).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->json('scans')->nullable()->after('expected');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_days', fn (Blueprint $table) => $table->dropColumn('scans'));
    }
};
