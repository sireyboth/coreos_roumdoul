<?php

use App\Support\PayrollDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Payroll, Standard mode (see the "Payroll Module Design" doc).
 *
 *  - employee_salaries      salary history: one row per change, by date
 *  - employee_pay_profiles  tax / NSSF / payment details per employee
 *  - pay_components         each company's pay lines and how each is worked out
 *  - employee_pay_items     recurring allowances and deductions per person
 *  - payroll_policies       each company's payroll settings (one row)
 *  - statutory_rates        tax brackets and NSSF rates, platform-owned, by date
 *  - tax_exchange_rates     the official monthly KHR rate for tax, platform-owned
 *  - pay_runs               one per company per month
 *  - payslips               one per employee per run, with its inputs frozen
 *  - payslip_lines          every line, with how it was worked out
 *  - payroll_adjustments    one-off amounts for a month (bonus, penalty, back pay)
 *
 * Rules and settings are not versioned: an approved payslip keeps a snapshot
 * of everything it used, and changes are in the audit log.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'payroll.view' => ['company-admin'],
        'payroll.manage' => ['company-admin'],
    ];

    public function up(): void
    {
        Schema::create('employee_salaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->string('currency', 3);
            // monthly: amount is per month · daily: amount is per day worked.
            $table->string('pay_type', 16)->default('monthly');
            $table->date('effective_from');
            // Null while it is the current salary; set when the next one starts.
            $table->date('effective_to')->nullable();
            $table->string('reason', 32)->default('change');
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['employee_id', 'effective_from']);
        });

        Schema::create('employee_pay_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->unique()->constrained()->cascadeOnDelete();
            // Non-residents pay a flat rate with no dependent allowances.
            $table->boolean('tax_resident')->default(true);
            $table->boolean('spouse_dependent')->default(false);
            $table->unsignedTinyInteger('child_dependents')->default(0);
            $table->boolean('nssf_enrolled')->default(true);
            $table->string('payment_method', 16)->default('bank');
            $table->string('bank_account_name')->nullable();
            $table->timestamps();
        });

        Schema::create('pay_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            // earning · deduction (reduces gross, before tax) · net_deduction (after tax: advance, loan).
            $table->string('kind', 16);
            // base · employee_item (amount set per person) · template (worked out from attendance).
            $table->string('method', 16);
            $table->string('template', 32)->nullable();
            $table->json('params')->nullable();
            $table->boolean('taxable')->default(true);
            $table->boolean('nssf_insurable')->default(true);
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(100);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
        });

        Schema::create('employee_pay_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_component_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'effective_from']);
        });

        Schema::create('payroll_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();
            // fixed (rate_basis_days, e.g. 26) · calendar (days in the month) · scheduled (the person's work days).
            $table->string('rate_basis', 16)->default('fixed');
            $table->unsignedTinyInteger('rate_basis_days')->default(26);
            $table->decimal('hours_per_day', 4, 2)->default(8);
            // Days with a missing scan: review (block approval) · present · absent.
            $table->string('missing_scan_policy', 16)->default('review');
            // Daily-paid staff are paid for holidays (Labor Law); a company can be more generous, not less.
            $table->boolean('daily_paid_holidays')->default(true);
            // Riel net pay is rounded to this many riel (100 = nearest 100).
            $table->unsignedInteger('khr_rounding')->default(100);
            // Used when the platform has no official rate for the month yet.
            $table->decimal('fallback_exchange_rate', 10, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('statutory_rates', function (Blueprint $table) {
            $table->id();
            $table->string('country', 2)->default('KH');
            // tax_on_salary · nssf
            $table->string('kind', 32);
            $table->json('params');
            $table->date('effective_from');
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['country', 'kind', 'effective_from']);
        });

        Schema::create('tax_exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('month', 7)->unique();
            $table->decimal('rate', 10, 2);
            $table->timestamps();
        });

        Schema::create('pay_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('month', 7);
            // draft → calculated → approved → paid. Approved and paid can never change.
            $table->string('status', 16)->default('draft');
            $table->json('policy_snapshot')->nullable();
            $table->json('warnings')->nullable();
            $table->json('totals')->nullable();
            $table->timestamp('calculated_at')->nullable();
            $table->foreignId('calculated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'month']);
        });

        Schema::create('payslips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('currency', 3);
            $table->string('pay_type', 16);
            $table->decimal('base_salary', 14, 2);
            $table->decimal('daily_rate', 14, 4);
            $table->decimal('hourly_rate', 14, 4);
            $table->decimal('exchange_rate', 10, 2)->nullable();
            $table->decimal('gross', 14, 2);
            $table->decimal('nssf_employee', 14, 2)->default(0);
            $table->decimal('tax', 14, 2)->default(0);
            $table->decimal('net', 14, 2);
            $table->decimal('employer_cost', 14, 2)->default(0);
            // The attendance summary and every variable the rules used, frozen.
            $table->json('inputs');
            $table->json('warnings')->nullable();
            $table->timestamps();

            $table->unique(['pay_run_id', 'employee_id']);
        });

        Schema::create('payslip_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payslip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pay_component_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code', 32);
            $table->string('name');
            // earning · deduction · net_deduction · statutory · employer (paid by the company, not from net)
            $table->string('kind', 16);
            $table->decimal('amount', 14, 2);
            // How it was worked out, in words: "45 min × 0.0417 = 1.88".
            $table->string('explanation')->nullable();
            // The rule as it was used: template, params, formula, inputs.
            $table->json('details')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('payroll_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('month', 7);
            $table->string('kind', 16);
            $table->string('name');
            $table->decimal('amount', 14, 2);
            $table->boolean('taxable')->default(true);
            $table->string('reason')->nullable();
            // manual · import · correction (a fix to an already paid month)
            $table->string('source', 16)->default('manual');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'month']);
        });

        $this->grantPermissions();
        $this->backfillSalaries();
        $this->seedStatutoryRates();
    }

    /** The platform's starting Cambodian rates, so payroll works on day one (verify before paying anyone). */
    private function seedStatutoryRates(): void
    {
        foreach (PayrollDefaults::statutoryRates() as $rate) {
            DB::table('statutory_rates')->insert([...$rate, 'params' => json_encode($rate['params']), 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    private function grantPermissions(): void
    {
        foreach (self::PERMISSIONS as $code => $roles) {
            DB::table('company_permissions')->insertOrIgnore(['code' => $code, 'name' => $code, 'created_at' => now(), 'updated_at' => now()]);
            $permissionId = DB::table('company_permissions')->where('code', $code)->value('id');

            foreach (DB::table('company_roles')->whereIn('code', $roles)->pluck('id') as $roleId) {
                DB::table('company_role_permission')->insertOrIgnore([
                    'company_role_id' => $roleId, 'company_permission_id' => $permissionId, 'created_at' => now(),
                ]);
            }
        }
    }

    /** Today's salary becomes the first history row, from the hire date (or when the person was added). */
    private function backfillSalaries(): void
    {
        DB::table('employees')->whereNotNull('base_salary')->whereNotNull('salary_currency')->orderBy('id')
            ->each(function (object $employee) {
                DB::table('employee_salaries')->insert([
                    'company_id' => $employee->company_id,
                    'employee_id' => $employee->id,
                    'amount' => $employee->base_salary,
                    'currency' => $employee->salary_currency,
                    'pay_type' => 'monthly',
                    'effective_from' => $employee->hire_date ?? substr((string) $employee->created_at, 0, 10),
                    'reason' => 'hired',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_adjustments');
        Schema::dropIfExists('payslip_lines');
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('pay_runs');
        Schema::dropIfExists('tax_exchange_rates');
        Schema::dropIfExists('statutory_rates');
        Schema::dropIfExists('payroll_policies');
        Schema::dropIfExists('employee_pay_items');
        Schema::dropIfExists('pay_components');
        Schema::dropIfExists('employee_pay_profiles');
        Schema::dropIfExists('employee_salaries');

        $ids = DB::table('company_permissions')->whereIn('code', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('company_role_permission')->whereIn('company_permission_id', $ids)->delete();
        DB::table('company_permissions')->whereIn('id', $ids)->delete();
    }
};
