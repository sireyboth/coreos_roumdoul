<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A hand-set amount can be a waiver: the company forgives part or all of a
 * deduction (late, absence, unpaid leave …) and the employee is shown both
 * the original amount and an optional message from the company. `reason`
 * stays HR's internal note; `employee_message` is the only text staff see.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payslip_overrides', function (Blueprint $table) {
            $table->boolean('is_waiver')->default(false)->after('reason');
            $table->string('employee_message', 500)->nullable()->after('is_waiver');
        });
    }

    public function down(): void
    {
        Schema::table('payslip_overrides', function (Blueprint $table) {
            $table->dropColumn(['is_waiver', 'employee_message']);
        });
    }
};
