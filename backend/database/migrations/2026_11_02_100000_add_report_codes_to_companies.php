<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The company's own codes and colours for the attendance report's day statuses
 * (P, L, E…), as {"L": {"code": "LT", "color": "amber"}, …}. Null = the
 * defaults in App\Support\ReportCodes. Only how a status is shown; never what it means.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->json('report_codes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('report_codes');
        });
    }
};
