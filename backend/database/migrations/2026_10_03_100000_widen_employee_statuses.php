<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SQLite changes a column by rebuilding the table, and only does that
     * safely with foreign keys off — which it ignores inside a transaction.
     * Inside one, dropping the old employees table would cascade-delete
     * their attendance, schedules and assignments.
     */
    public $withinTransaction = false;

    /**
     * The status was a fixed four-value enum. It's now plain text, checked
     * against Employee::STATUSES, so adding a status needs no migration.
     */
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('employment_status', 30)->default('active')->change();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->enum('employment_status', ['active', 'on_leave', 'suspended', 'terminated'])->default('active')->change();
        });
    }
};
