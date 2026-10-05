<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A correction can now be cancelled while it waits (by the employee, or by a
 * manager with a remark). The status was a fixed list without "cancelled",
 * so it becomes a plain string like the other request statuses; the remark
 * gets the same 500 characters as a leave decision. Who cancelled and why
 * use the existing reviewed_by / review_notes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_corrections', function (Blueprint $table) {
            $table->string('status', 20)->default('pending')->change();
            $table->string('review_notes', 500)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_corrections', function (Blueprint $table) {
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->change();
            $table->string('review_notes')->nullable()->change();
        });
    }
};
