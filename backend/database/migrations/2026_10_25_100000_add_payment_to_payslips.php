<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where each payslip's money goes, copied from the employee when the run is
 * approved. The bank export and report read this copy, so changing someone's
 * account afterwards can't redirect pay that was already signed off.
 *
 * Null until approval (and for runs approved before this): the employee's
 * current details are shown instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->json('payment')->nullable()->after('warnings');
        });
    }

    public function down(): void
    {
        Schema::table('payslips', function (Blueprint $table) {
            $table->dropColumn('payment');
        });
    }
};
