<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Probation, set by each company:
 *
 *  - companies.probation_length + probation_unit: how long a new person is on
 *    probation by default (3 months — the most Cambodian law allows for
 *    regular staff, Art. 68). Each employee's end date can still be changed.
 *  - companies.probation_reminder_days: HR is told this many days before it
 *    ends (null = only on the day).
 *  - employees.probation_end_date: the last day of probation; it starts on
 *    the hire date. Kept after they pass, as a record.
 *  - leave_types.allowed_during_probation: off = this leave can't be taken
 *    by someone still on probation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->unsignedSmallInteger('probation_length')->default(3)->after('allow_self_approval');
            $table->string('probation_unit', 10)->default('months')->after('probation_length');
            $table->unsignedSmallInteger('probation_reminder_days')->nullable()->default(7)->after('probation_unit');
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->date('probation_end_date')->nullable()->after('hire_date');
        });

        Schema::table('leave_types', function (Blueprint $table) {
            $table->boolean('allowed_during_probation')->default(true)->after('eligible_after_months');
        });

        // People already on probation get the default end date, counted from their hire date.
        DB::table('employees')
            ->where('employment_status', 'probation')
            ->whereNotNull('hire_date')
            ->whereNull('probation_end_date')
            ->orderBy('id')
            ->each(function (object $employee) {
                DB::table('employees')->where('id', $employee->id)->update([
                    'probation_end_date' => CarbonImmutable::parse($employee->hire_date)->addMonthsNoOverflow(3)->subDay()->toDateString(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn('allowed_during_probation');
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('probation_end_date');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['probation_length', 'probation_unit', 'probation_reminder_days']);
        });
    }
};
