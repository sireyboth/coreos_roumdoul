<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Who comes first in every list: the lowest number on top (e.g. the
        // director 1, managers 2). Empty means after everyone numbered; ties
        // and empties go by name.
        Schema::table('employees', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->nullable()->after('employment_status');
            $table->index(['company_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
