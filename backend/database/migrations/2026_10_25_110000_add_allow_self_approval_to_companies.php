<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether someone may approve or change their own attendance, overtime,
 * leave balance and pay, and approve a pay run they prepared. Off by default:
 * a second person checks. A company with a single admin can turn it on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->boolean('allow_self_approval')->default(false)->after('default_rest_days');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('allow_self_approval');
        });
    }
};
