<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per admin adjustment of a day: who, when, why, and which
        // scan times were taken out and put in. Read by the day view and
        // the export, so a changed day always says how it got that way.
        Schema::create('attendance_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->foreignId('adjusted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason');
            // UTC instants.
            $table->json('removed')->nullable();
            $table->json('added')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'date']);
        });

        $this->backfill();
    }

    /**
     * Adjustments made before this table existed are rebuilt from the scans
     * they left behind: added ones (method 'adjustment') and voided ones,
     * grouped by employee, admin, reason and the second they were made.
     */
    private function backfill(): void
    {
        $prefix = 'Adjusted by admin: ';
        $timezones = DB::table('companies')->pluck('timezone', 'id');
        $groups = [];

        $put = function (object $event, ?int $by, string $reason, string $at, string $side) use (&$groups, $timezones) {
            $timezone = $timezones[$event->company_id] ?? null ?: config('attendance.default_timezone');
            $key = "{$event->employee_id}|{$by}|{$reason}|".Carbon::parse($at)->format('Y-m-d H:i:s');
            $groups[$key] ??= [
                'company_id' => $event->company_id,
                'employee_id' => $event->employee_id,
                'date' => Carbon::parse($event->event_time, 'UTC')->setTimezone($timezone)->toDateString(),
                'adjusted_by' => $by,
                'reason' => $reason,
                'removed' => [],
                'added' => [],
                'created_at' => $at,
                'updated_at' => $at,
            ];
            $groups[$key][$side][] = Carbon::parse($event->event_time, 'UTC')->toIso8601String();
        };

        foreach (DB::table('attendance_events')->where('method', 'adjustment')->get() as $event) {
            $reason = str_starts_with((string) $event->notes, $prefix) ? substr($event->notes, strlen($prefix)) : (string) $event->notes;
            $put($event, $event->recorded_by, $reason, $event->created_at, 'added');
        }

        foreach (DB::table('attendance_events')->whereNotNull('deleted_at')->whereNotNull('void_reason')->get() as $event) {
            $put($event, $event->voided_by, $event->void_reason, $event->deleted_at, 'removed');
        }

        foreach ($groups as $row) {
            DB::table('attendance_adjustments')->insert([
                ...$row,
                'removed' => json_encode($row['removed']),
                'added' => json_encode($row['added']),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_adjustments');
    }
};
