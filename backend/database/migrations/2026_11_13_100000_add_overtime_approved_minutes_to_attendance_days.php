<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Overtime approved in part: a manager can approve fewer minutes than were
 * worked (e.g. 2 h of 3.5 h). Null = all of the day's overtime, which is what
 * every approval meant before this column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->unsignedInteger('overtime_approved_minutes')->nullable()->after('overtime_status');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('overtime_approved_minutes');
        });
    }
};
