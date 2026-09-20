<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            // Weekly recurring rest days, e.g. [0, 6] for Sunday and Saturday
            // (0 = Sunday .. 6 = Saturday). Null means "use the company default".
            $table->json('rest_days')->nullable()->after('employment_status');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('rest_days');
        });
    }
};
