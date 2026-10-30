<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR's own amount for one line of one person's payslip in one run (e.g. the
 * overtime line set to 30.00 instead of what the rule worked out). Payslips
 * are rewritten on every recalculation; these rows are not, so the calculator
 * applies them again each time. Who set it, when and why is in the audit log.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payslip_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            // The rule whose line it replaces: told apart by component, not code, since companies rename codes.
            $table->foreignId('pay_component_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('reason', 500);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['pay_run_id', 'employee_id', 'pay_component_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslip_overrides');
    }
};
