<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The code printed at a branch's entrance so employees can check in
        // by scanning it — works even where GPS is unreliable (indoors,
        // malls, weak signal), which is common for small businesses.
        Schema::table('work_locations', function (Blueprint $table) {
            $table->string('qr_token')->nullable()->unique()->after('radius_meters');
        });
    }

    public function down(): void
    {
        Schema::table('work_locations', function (Blueprint $table) {
            $table->dropColumn('qr_token');
        });
    }
};
