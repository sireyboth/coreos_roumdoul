<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An admin adjusting a day can take a wrong scan out of the
        // calculation. The row is only voided (soft-deleted), never removed:
        // who voided it and why stay next to the original evidence.
        Schema::table('attendance_events', function (Blueprint $table) {
            $table->foreignId('voided_by')->nullable()->after('notes')->constrained('users')->nullOnDelete();
            $table->string('void_reason')->nullable()->after('voided_by');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('voided_by');
            $table->dropColumn(['void_reason', 'deleted_at']);
        });
    }
};
