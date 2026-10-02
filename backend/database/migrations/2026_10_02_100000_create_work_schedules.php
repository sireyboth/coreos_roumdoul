<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Work Schedules: "what an employee should do", with any number of IN/OUT
 * scans per day, assigned to employees for a date range. Replaces the
 * one-block-per-day Shift. Existing shifts are converted here, and roster
 * entries keep working as one-day overrides pointing at the converted schedule.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);

            // Tolerances, applied to every slot of the schedule.
            $table->unsignedInteger('late_grace_minutes')->default(0);
            $table->unsignedInteger('early_leave_grace_minutes')->default(0);
            // Deducted only on a day with a single IN/OUT pair, i.e. when
            // people don't scan out for their break.
            $table->unsignedInteger('break_minutes')->default(0);
            $table->boolean('is_break_paid')->default(false);

            // Suggested weekly days off (0 = Sunday .. 6 = Saturday), copied
            // onto each assignment, where it can be changed per person.
            $table->json('default_days_off')->nullable();

            // Overtime, set by each company: off / after_last_out / above_scheduled.
            $table->string('overtime_mode', 20)->default('off');
            $table->unsignedInteger('overtime_min_minutes')->default(0);
            $table->boolean('overtime_count_early')->default(false);
            $table->unsignedInteger('overtime_round_minutes')->default(0);
            $table->boolean('overtime_requires_approval')->default(false);

            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('work_schedule_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_schedule_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('weekday'); // 0 = Sunday .. 6 = Saturday
            $table->timestamps();

            $table->unique(['work_schedule_id', 'weekday']);
        });

        Schema::create('work_schedule_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_schedule_day_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence');
            $table->string('type', 3); // in / out
            $table->time('time');
            // The slot falls on the following calendar day (a night shift's 06:00 OUT).
            $table->boolean('next_day')->default(false);
            $table->timestamps();

            $table->unique(['work_schedule_day_id', 'sequence']);
        });

        Schema::create('employee_schedule_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_schedule_id')->constrained();
            $table->date('effective_from');
            $table->date('effective_to')->nullable(); // empty = ongoing
            // This person's weekly days off (0 = Sunday .. 6 = Saturday).
            $table->json('days_off')->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'effective_from']);
        });

        // The date-by-date roster becomes a one-day override: "on this date, use this schedule".
        Schema::table('schedules', function (Blueprint $table) {
            $table->foreignId('work_schedule_id')->nullable()->after('shift_id')->constrained()->nullOnDelete();
        });
        Schema::table('schedules', function (Blueprint $table) {
            $table->unsignedBigInteger('shift_id')->nullable()->change();
        });

        // A scan is no longer told whether it's an IN or an OUT — the day's
        // calculation decides. Old rows keep the type they were recorded with.
        Schema::table('attendance_events', function (Blueprint $table) {
            $table->string('event_type', 20)->nullable()->change();
        });

        // The calculated result for one employee on one day: expected vs actual.
        Schema::create('attendance_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('date');

            // What was expected, frozen at calculation time so editing a
            // schedule later never rewrites past attendance.
            $table->string('kind', 20);           // work / day_off / weekly_off / holiday / unscheduled
            $table->string('source', 20)->nullable(); // assignment / override
            $table->foreignId('work_schedule_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label')->nullable();  // schedule, holiday or day-off name
            $table->json('expected')->nullable(); // rules + slots snapshot

            // What happened.
            $table->json('slots')->nullable();    // each expected slot ↔ matched scan
            $table->json('extra_scans')->nullable();
            $table->unsignedSmallInteger('scan_count')->default(0);
            $table->timestamp('first_scan_at')->nullable();
            $table->timestamp('last_scan_at')->nullable();

            $table->string('status', 20);         // upcoming / in_progress / complete / incomplete / absent / off / worked_off / unscheduled
            $table->boolean('is_closed')->default(false);
            $table->unsignedInteger('scheduled_minutes')->default(0);
            $table->unsignedInteger('worked_minutes')->default(0);
            $table->unsignedInteger('late_minutes')->default(0);
            $table->unsignedInteger('early_leave_minutes')->default(0);
            $table->unsignedInteger('night_minutes')->default(0);
            $table->unsignedInteger('overtime_minutes')->default(0);
            $table->string('overtime_type', 20)->nullable();   // workday / day_off / holiday
            $table->string('overtime_status', 20)->nullable(); // pending / approved / rejected
            $table->foreignId('overtime_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('overtime_reviewed_at')->nullable();
            $table->json('exceptions')->nullable();
            $table->timestamp('calculated_at')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'date']);
            $table->index(['company_id', 'date']);
        });

        // A month that has been paid out: its attendance can no longer change.
        Schema::create('attendance_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->char('month', 7); // YYYY-MM
            $table->timestamp('locked_at');
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'month']);
        });

        // A correction now adds any number of scans (e.g. one forgotten 12:00 OUT).
        Schema::table('attendance_corrections', function (Blueprint $table) {
            $table->json('requested_scans')->nullable()->after('requested_check_out');
        });

        $this->convertShifts();
    }

    /**
     * Every shift becomes a schedule with the same hours on all seven days
     * (one IN, one OUT) and the same grace and break. The company's old
     * "weekly days off" become the schedule's suggested days off.
     */
    private function convertShifts(): void
    {
        $now = now();
        $restDays = DB::table('companies')->pluck('default_rest_days', 'id');

        foreach (DB::table('shifts')->orderBy('id')->get() as $shift) {
            $scheduleId = DB::table('work_schedules')->insertGetId([
                'company_id' => $shift->company_id,
                'name' => $shift->name,
                'is_active' => $shift->is_active,
                'late_grace_minutes' => $shift->grace_minutes,
                'early_leave_grace_minutes' => 0,
                'break_minutes' => $shift->break_minutes,
                'is_break_paid' => $shift->is_break_paid,
                'default_days_off' => $restDays[$shift->company_id] ?? json_encode([]),
                'overtime_mode' => 'off',
                'created_at' => $now,
                'updated_at' => $now,
                'deleted_at' => $shift->deleted_at,
            ]);

            $start = substr($shift->start_time, 0, 5);
            $end = substr($shift->end_time, 0, 5);

            foreach (range(0, 6) as $weekday) {
                $dayId = DB::table('work_schedule_days')->insertGetId([
                    'work_schedule_id' => $scheduleId, 'weekday' => $weekday, 'created_at' => $now, 'updated_at' => $now,
                ]);

                DB::table('work_schedule_slots')->insert([
                    ['work_schedule_day_id' => $dayId, 'sequence' => 1, 'type' => 'in', 'time' => $start, 'next_day' => false, 'created_at' => $now, 'updated_at' => $now],
                    // An end at or before the start is the next morning (night shift).
                    ['work_schedule_day_id' => $dayId, 'sequence' => 2, 'type' => 'out', 'time' => $end, 'next_day' => $end <= $start, 'created_at' => $now, 'updated_at' => $now],
                ]);
            }

            DB::table('schedules')->where('shift_id', $shift->id)->update(['work_schedule_id' => $scheduleId]);
        }
    }

    public function down(): void
    {
        Schema::table('attendance_corrections', fn (Blueprint $table) => $table->dropColumn('requested_scans'));
        Schema::dropIfExists('attendance_periods');
        Schema::dropIfExists('attendance_days');
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('work_schedule_id');
        });
        Schema::dropIfExists('employee_schedule_assignments');
        Schema::dropIfExists('work_schedule_slots');
        Schema::dropIfExists('work_schedule_days');
        Schema::dropIfExists('work_schedules');
    }
};
