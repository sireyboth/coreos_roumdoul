<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Everything a company sets up and picks from lists. */
    private const TABLES = ['branches', 'departments', 'teams', 'work_locations', 'work_schedules', 'company_roles'];

    public function up(): void
    {
        // Same rule as employees: the lowest number is listed first; empty
        // means after everything numbered; ties and empties go by name.
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->unsignedInteger('sort_order')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('sort_order'));
        }
    }
};
