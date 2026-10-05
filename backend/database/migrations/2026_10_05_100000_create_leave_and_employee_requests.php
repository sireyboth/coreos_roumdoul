<?php

use App\Support\LeaveDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Employee requests — leave first; overtime pre-approval, remote work,
 * business trips, schedule changes and shift swaps reuse the same base.
 *
 *  - employee_requests        one row per request: who, what, when, status
 *  - employee_request_days    the days it covers, one row each (overlaps,
 *                             balances and attendance all read these)
 *  - leave_types              each company's leave policy (see LeaveDefaults)
 *  - leave_adjustments        manual balance changes, each with who and why
 *  - attachments              files on any record (a medical certificate…)
 *  - approval_steps           gets the step kind and who actually acted
 *
 * A balance is never stored: it is what the policy grants, plus the
 * adjustments, minus the approved request days — so it can't drift.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'requests.view' => ['company-admin', 'manager', 'employee'],
        'requests.manage' => ['company-admin', 'manager'],
        'leave_policies.view' => ['company-admin'],
        'leave_policies.manage' => ['company-admin'],
    ];

    public function up(): void
    {
        Schema::create('leave_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30);
            $table->string('name', 100);
            $table->string('name_km', 100)->nullable();
            // 0 = unpaid, 50 = half pay (maternity), 100 = full pay.
            $table->unsignedTinyInteger('pay_percent')->default(100);
            // work_days: only scheduled work days count (holidays and days off inside are free).
            // calendar_days: every day counts (maternity).
            $table->string('counts', 20)->default('work_days');
            // none | monthly (yearly_days / 12 per month of service) | yearly (yearly_days every January)
            $table->string('accrual', 20)->default('none');
            $table->decimal('yearly_days', 5, 2)->nullable();
            $table->unsignedTinyInteger('seniority_every_years')->nullable();
            $table->decimal('seniority_extra_days', 4, 2)->nullable();
            // Can be requested only for dates this long after the hire date.
            $table->unsignedSmallInteger('eligible_after_months')->nullable();
            // false: no balance kept (sick, unpaid, maternity).
            $table->boolean('requires_balance')->default(false);
            $table->boolean('allow_half_day')->default(true);
            // A file is required for requests of at least this many days (1 = always); null = never.
            $table->decimal('attachment_from_days', 5, 2)->nullable();
            $table->unsignedSmallInteger('min_notice_days')->nullable();
            $table->decimal('max_days_per_request', 6, 2)->nullable();
            // male | female; null = anyone.
            $table->string('gender', 10)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code']);
        });

        Schema::create('employee_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            // leave (now); overtime, remote, business_trip, schedule_change, shift_swap (later)
            $table->string('type', 30);
            $table->foreignId('leave_type_id')->nullable()->constrained()->restrictOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            // full | am | pm — a half day is always a single date.
            $table->string('day_part', 5)->default('full');
            // Worked out by the server from the schedule, never taken from the form.
            $table->decimal('days', 6, 2)->default(0);
            $table->text('reason')->nullable();
            // The few extra fields a type needs.
            $table->json('details')->nullable();
            // pending | approved | rejected | cancelled
            $table->string('status', 20)->default('pending');
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_notes', 500)->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'type', 'status']);
            $table->index(['employee_id', 'start_date']);
        });

        Schema::create('employee_request_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            // 1.00 a full day, 0.50 half.
            $table->decimal('portion', 3, 2);
            // full | am | pm
            $table->string('part', 5)->default('full');

            $table->index(['employee_id', 'date']);
        });

        Schema::create('leave_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_type_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            // + adds to the balance, − takes away.
            $table->decimal('days', 6, 2);
            $table->string('reason', 255);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['employee_id', 'leave_type_id', 'year']);
        });

        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->morphs('attachable');
            $table->string('disk', 20);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 100);
            $table->unsignedInteger('size');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('approval_steps', function (Blueprint $table) {
            // manager: the employee's line manager (approver_user_id);
            // permission: anyone with requests.manage who covers the employee's branch.
            $table->string('kind', 20)->default('manager')->after('step_number');
            // Who actually decided — on a permission step anyone eligible can.
            $table->foreignId('acted_by_user_id')->nullable()->after('acted_at')->constrained('users')->nullOnDelete();
        });

        $this->grantPermissions();
        $this->seedLeaveTypes();
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

    private function seedLeaveTypes(): void
    {
        foreach (DB::table('companies')->pluck('id') as $companyId) {
            foreach (LeaveDefaults::types() as $type) {
                DB::table('leave_types')->insertOrIgnore([...$type, 'company_id' => $companyId, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('approval_steps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('acted_by_user_id');
            $table->dropColumn('kind');
        });
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('leave_adjustments');
        Schema::dropIfExists('employee_request_days');
        Schema::dropIfExists('employee_requests');
        Schema::dropIfExists('leave_types');

        $ids = DB::table('company_permissions')->whereIn('code', array_keys(self::PERMISSIONS))->pluck('id');
        DB::table('company_role_permission')->whereIn('company_permission_id', $ids)->delete();
        DB::table('company_permissions')->whereIn('id', $ids)->delete();
    }
};
