<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether overtime multipliers are held to the Labor Law minimums (150% on a
 * work day, 200% on a day off or holiday). On by default; a company with its
 * own overtime policy can switch it off and set any rate (the law is then a warning only).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_policies', function (Blueprint $table) {
            $table->boolean('enforce_overtime_minimums')->default(true)->after('daily_paid_holidays');
        });
    }

    public function down(): void
    {
        Schema::table('payroll_policies', function (Blueprint $table) {
            $table->dropColumn('enforce_overtime_minimums');
        });
    }
};
