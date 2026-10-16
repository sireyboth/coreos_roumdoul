<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pay groups and pay periods: a pay run is no longer "the company's month"
 * but one pay group's period, which can cross months (26 Mar → 25 Apr) and
 * come round more than once a month (twice a month, weekly).
 *
 *  - pay_groups            a schedule (when periods start and end) plus rules that differ from the company's
 *  - employee_pay_groups   which group each person is in, by date (before the first row: the default group)
 *  - pay_runs              + pay_group_id, period_start, period_end; month = the month the period ends in
 *  - payroll_adjustments   month → date: an adjustment lands in the run whose period holds that date
 *  - attendance_locks      one person's days frozen by an approved pay run
 *
 * Existing runs move into a "Monthly" default group with 1st → end-of-month periods, unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pay_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            // monthly · semi_monthly · weekly · biweekly · custom (HR picks each run's dates)
            $table->string('schedule', 16)->default('monthly');
            // monthly / semi_monthly: the day(s) of the month a period ends on; 31 = the last day.
            $table->json('cutoff_days')->nullable();
            // weekly / biweekly: the first day of any one period; the rest follow every 7 / 14 days.
            $table->date('anchor_date')->nullable();
            // Null = the company's payroll policy.
            $table->string('rate_basis', 16)->nullable();
            $table->unsignedTinyInteger('rate_basis_days')->nullable();
            $table->decimal('hours_per_day', 4, 2)->nullable();
            $table->string('missing_scan_policy', 16)->nullable();
            $table->boolean('daily_paid_holidays')->nullable();
            // {component id: {is_active?, params?}} — the group's own version of a company rule.
            $table->json('component_rules')->nullable();
            // Prepare (calculate, never approve) each period's run by itself once the period is over.
            $table->boolean('auto_calculate')->default(false);
            $table->boolean('is_default')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(100);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });

        Schema::create('employee_pay_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_group_id')->constrained()->restrictOnDelete();
            $table->date('effective_from');
            // Null while it is the current group; set when the next one starts.
            $table->date('effective_to')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['employee_id', 'effective_from']);
        });

        Schema::table('pay_runs', function (Blueprint $table) {
            $table->foreignId('pay_group_id')->nullable()->after('company_id')->constrained()->restrictOnDelete();
            $table->date('period_start')->nullable()->after('month');
            $table->date('period_end')->nullable()->after('period_start');
        });

        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->date('date')->nullable()->after('employee_id');
        });

        Schema::create('attendance_locks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->foreignId('pay_run_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->index(['employee_id', 'start_date']);
        });

        $this->backfill();

        Schema::table('pay_runs', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'month']);
            $table->unique(['pay_group_id', 'period_start']);
            $table->index(['company_id', 'month']);
        });

        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'month']);
        });
        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->dropColumn('month');
            $table->index(['company_id', 'date']);
        });
    }

    /** Every company already using payroll gets its default group; old runs and adjustments keep their month. */
    private function backfill(): void
    {
        $companies = DB::table('payroll_policies')->pluck('company_id')
            ->merge(DB::table('pay_runs')->pluck('company_id'))
            ->unique();

        foreach ($companies as $companyId) {
            $groupId = DB::table('pay_groups')->insertGetId([
                'company_id' => $companyId, 'name' => 'Monthly', 'schedule' => 'monthly', 'cutoff_days' => json_encode([31]),
                'is_default' => true, 'sort_order' => 10, 'created_at' => now(), 'updated_at' => now(),
            ]);

            DB::table('pay_runs')->where('company_id', $companyId)->orderBy('id')->each(function (object $run) use ($groupId) {
                $start = CarbonImmutable::parse("{$run->month}-01");
                DB::table('pay_runs')->where('id', $run->id)->update([
                    'pay_group_id' => $groupId,
                    'period_start' => $start->toDateString(),
                    'period_end' => $start->endOfMonth()->toDateString(),
                ]);
            });
        }

        DB::table('payroll_adjustments')->orderBy('id')->each(fn (object $a) => DB::table('payroll_adjustments')
            ->where('id', $a->id)->update(['date' => "{$a->month}-01"]));
    }

    public function down(): void
    {
        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->string('month', 7)->nullable()->after('employee_id');
        });
        DB::table('payroll_adjustments')->orderBy('id')->each(fn (object $a) => DB::table('payroll_adjustments')
            ->where('id', $a->id)->update(['month' => substr((string) $a->date, 0, 7)]));
        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'date']);
            $table->dropColumn('date');
            $table->index(['company_id', 'month']);
        });

        Schema::dropIfExists('attendance_locks');

        Schema::table('pay_runs', function (Blueprint $table) {
            $table->dropUnique(['pay_group_id', 'period_start']);
            $table->dropIndex(['company_id', 'month']);
            $table->dropConstrainedForeignId('pay_group_id');
            $table->dropColumn(['period_start', 'period_end']);
            $table->unique(['company_id', 'month']);
        });

        Schema::dropIfExists('employee_pay_groups');
        Schema::dropIfExists('pay_groups');
    }
};
