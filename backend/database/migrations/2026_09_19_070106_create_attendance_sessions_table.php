<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The derived, one-row-per-employee-per-day record that History,
        // Reports, and (later) Payroll actually read from. Built and updated
        // as check-in/check-out events arrive, and by approved corrections.
        Schema::create('attendance_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('schedule_id')->nullable()->constrained()->nullOnDelete();
            $table->date('date');
            $table->foreignId('check_in_event_id')->nullable()->constrained('attendance_events')->nullOnDelete();
            $table->foreignId('check_out_event_id')->nullable()->constrained('attendance_events')->nullOnDelete();
            $table->unsignedInteger('worked_minutes')->nullable();
            $table->unsignedInteger('late_minutes')->default(0);
            $table->enum('status', ['open', 'completed', 'missing_checkout'])->default('open');
            $table->timestamps();

            $table->unique(['employee_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_sessions');
    }
};
