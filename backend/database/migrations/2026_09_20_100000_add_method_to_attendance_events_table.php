<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // How the check-in/out was verified: qr, gps, correction (approved
        // request) or none (nothing was sent to verify presence). Evidence
        // for whoever reviews the record later.
        Schema::table('attendance_events', function (Blueprint $table) {
            $table->string('method')->nullable()->after('event_type');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_events', function (Blueprint $table) {
            $table->dropColumn('method');
        });
    }
};
