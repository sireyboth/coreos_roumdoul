<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_locations', function (Blueprint $table) {
            // When on, a QR scan only counts if the phone also reports a
            // position inside the radius. Off keeps the original behaviour
            // (QR alone is enough) for indoor sites with no GPS signal.
            $table->boolean('require_location')->default(false)->after('radius_meters');
        });
    }

    public function down(): void
    {
        Schema::table('work_locations', function (Blueprint $table) {
            $table->dropColumn('require_location');
        });
    }
};
