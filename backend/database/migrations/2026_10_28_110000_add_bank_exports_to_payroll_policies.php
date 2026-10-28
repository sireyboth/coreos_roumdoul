<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The company's own details a bank's payroll file asks for (e.g. Chipmong's
 * company code and debit account), remembered between exports.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_policies', function (Blueprint $table) {
            $table->json('bank_exports')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payroll_policies', function (Blueprint $table) {
            $table->dropColumn('bank_exports');
        });
    }
};
