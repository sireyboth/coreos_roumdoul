<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // For people who don't scan (e.g. top management): each IN/OUT is
        // filled in at its scheduled time once that time has passed.
        Schema::table('work_schedules', function (Blueprint $table) {
            $table->boolean('auto_attendance')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('work_schedules', fn (Blueprint $table) => $table->dropColumn('auto_attendance'));
    }
};
