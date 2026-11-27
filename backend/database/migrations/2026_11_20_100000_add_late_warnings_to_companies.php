<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Automatic late warnings, set by each company (see LateWarningNotifier):
 *
 *  - companies.late_warning_limit: warn the employee and HR when someone is
 *    late this many times in a calendar month, and again at each further
 *    multiple (3, 6, 9…). Null = off — the default, so turning this on is
 *    the company's choice and nobody is surprised by alerts.
 *  - companies.late_warning_counts_early: leaving early counts toward the
 *    limit too (a day that is both late and early counts once).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->unsignedSmallInteger('late_warning_limit')->nullable()->after('probation_reminder_days');
            $table->boolean('late_warning_counts_early')->default(true)->after('late_warning_limit');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['late_warning_limit', 'late_warning_counts_early']);
        });
    }
};
