<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Evidence, not just a timestamp: every check-in/out is an immutable
        // event. Corrections never edit or delete a row here — they go
        // through attendance_corrections and, once approved, adjust the
        // derived attendance_sessions record instead.
        Schema::create('attendance_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_location_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('event_type', ['check_in', 'check_out']);
            $table->timestamp('event_time');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('device_id')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'event_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_events');
    }
};
