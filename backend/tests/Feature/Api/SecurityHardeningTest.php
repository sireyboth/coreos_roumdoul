<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceDay;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\MembershipBranchAccess;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/** The holes found in the October 2026 security review, each kept shut. */
class SecurityHardeningTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private Company $company;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Safe Co', 'Boss', 'boss@safe.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
    }

    /** A real bearer token, the way the app signs in — actingAs() would skip the token checks. */
    private function token(User $user): string
    {
        return $user->createToken('api')->plainTextToken;
    }

    // ───────────────────────────── Sign-ins ─────────────────────────────

    public function test_a_deactivated_user_is_signed_out_at_once(): void
    {
        $staff = $this->createUserWithRole($this->company, 'employee');
        $token = $this->token($staff);
        $this->withToken($token)->getJson('/api/me')->assertOk();

        $this->actingAs($this->admin)->patchJson("/api/users/{$staff->id}/active", ['is_active' => false])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_an_inactive_users_leftover_token_is_refused(): void
    {
        $staff = $this->createUserWithRole($this->company, 'employee');
        $token = $this->token($staff);
        $staff->update(['is_active' => false]); // e.g. switched off straight in the database

        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_changing_the_password_signs_out_other_devices_but_not_this_one(): void
    {
        $phone = $this->token($this->admin);
        $laptop = $this->token($this->admin);

        $this->withToken($laptop)->putJson('/api/profile/password', [
            'current_password' => 'password123', 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1',
        ])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($laptop)->getJson('/api/me')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($phone)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_replacing_the_sign_in_email_needs_the_password(): void
    {
        $this->actingAs($this->admin)->putJson('/api/profile', ['name' => 'Boss', 'email' => 'thief@evil.test'])
            ->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->actingAs($this->admin)->putJson('/api/profile', ['name' => 'Boss', 'email' => 'new@safe.test', 'current_password' => 'password123'])
            ->assertOk()->assertJsonPath('email', 'new@safe.test');

        // Renaming alone needs nothing.
        $this->actingAs($this->admin->fresh())->putJson('/api/profile', ['name' => 'Big Boss', 'email' => 'new@safe.test'])->assertOk();
    }

    // ───────────────────────────── Bank details ─────────────────────────────

    public function test_bank_details_are_pay_hidden_and_locked_without_salary_rights(): void
    {
        $manager = $this->createUserWithRole($this->company, 'manager'); // employees.manage, no salary.*
        $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Sokha', 'bank_name' => 'ABA Bank', 'bank_account_number' => '000111222']);

        $seen = $this->actingAs($manager)->getJson("/api/employees/{$employee->id}")->assertOk()->json();
        $this->assertArrayNotHasKey('bank_account_number', $seen);

        $this->actingAs($manager)->putJson("/api/employees/{$employee->id}", ['name' => 'Sokha', 'bank_account_number' => '999888777'])
            ->assertUnprocessable()->assertJsonValidationErrors('base_salary');
        $this->assertSame('000111222', $employee->fresh()->bank_account_number);

        // The admin (salary.manage) can.
        $this->actingAs($this->admin)->putJson("/api/employees/{$employee->id}", ['name' => 'Sokha', 'bank_account_number' => '999888777'])->assertOk();
        $this->assertSame('999888777', $employee->fresh()->bank_account_number);
    }

    public function test_the_audit_log_hides_pay_and_id_numbers_from_people_who_cant_see_them(): void
    {
        $role = $this->company->roles()->create(['name' => 'auditor', 'code' => 'auditor']);
        $role->permissions()->attach(\App\Models\CompanyPermission::query()->where('code', 'audit.view')->pluck('id'));
        $auditor = $this->createUserWithRole($this->company, 'auditor');

        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 11.5, 'longitude' => 104.9]);
        $this->actingAs($this->admin)->postJson('/api/employees', [
            'name' => 'Dara', 'branch_id' => $branch->id, 'base_salary' => 650, 'salary_currency' => 'USD', 'national_id_number' => '0102', 'bank_account_number' => '555',
        ])->assertCreated();

        // Everything recorded about the employee (created, then filled in), merged.
        $seenBy = fn (User $viewer) => collect($this->actingAs($viewer)->getJson('/api/audit-logs')->json('data'))
            ->filter(fn (array $row) => str_starts_with($row['event'], 'employee.'))
            ->reduce(fn (array $all, array $row) => [...$all, ...($row['after'] ?? [])], []);

        $auditorSees = $seenBy($auditor);
        $this->assertSame('Dara', $auditorSees['display_name']);
        foreach (['base_salary', 'national_id_number', 'bank_account_number'] as $field) {
            $this->assertArrayNotHasKey($field, $auditorSees);
        }

        $this->assertSame('555', $seenBy($this->admin)['bank_account_number']);
    }

    // ───────────────────────────── Self-approval ─────────────────────────────

    public function test_a_manager_cant_change_their_own_attendance_unless_the_company_allows_it(): void
    {
        $manager = $this->createUserWithRole($this->company, 'manager');
        $mine = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Me', 'user_id' => $manager->id]);
        $this->assignSchedule($mine, $this->makeWorkSchedule($this->company));
        $fix = ['employee_id' => $mine->id, 'date' => now()->subDay()->toDateString(), 'reason' => 'forgot', 'add' => [now()->subDay()->setTime(8, 0)->toDateTimeString()]];

        $this->actingAs($manager)->postJson('/api/attendance/adjustments', $fix)
            ->assertUnprocessable()->assertJsonValidationErrors('employee_id');

        $this->actingAs($this->admin)->putJson('/api/company/settings', ['allow_self_approval' => true])->assertOk();
        $this->actingAs($manager->fresh())->postJson('/api/attendance/adjustments', $fix)->assertOk();
    }

    public function test_only_company_managers_change_the_self_approval_setting(): void
    {
        $manager = $this->createUserWithRole($this->company, 'manager');
        $this->actingAs($manager)->putJson('/api/company/settings', ['allow_self_approval' => true])->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/me')->assertJsonPath('company.allow_self_approval', false);
    }

    public function test_salary_managers_cant_raise_their_own_pay(): void
    {
        $mine = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Boss', 'user_id' => $this->admin->id]);

        $this->actingAs($this->admin)->postJson("/api/employees/{$mine->id}/salaries", [
            'amount' => 9999, 'currency' => 'USD', 'pay_type' => 'monthly', 'effective_from' => '2026-01-01', 'reason' => 'raise',
        ])->assertUnprocessable()->assertJsonValidationErrors('employee_id');
        $this->actingAs($this->admin)->putJson("/api/employees/{$mine->id}", ['name' => 'Boss', 'base_salary' => 9999, 'salary_currency' => 'USD'])
            ->assertUnprocessable()->assertJsonValidationErrors('base_salary');
    }

    // ───────────────────────────── Who can remove whom ─────────────────────────────

    public function test_employees_manage_alone_cant_delete_a_managers_or_admins_login(): void
    {
        $manager = $this->createUserWithRole($this->company, 'manager');
        $adminRecord = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Boss', 'user_id' => $this->admin->id]);

        $this->actingAs($manager)->deleteJson("/api/employees/{$adminRecord->id}")
            ->assertUnprocessable()->assertJsonValidationErrors('employee');
        $this->assertNotNull($this->admin->fresh());

        // A plain employee's record (and login) still goes.
        $staff = $this->createUserWithRole($this->company, 'employee');
        $staffRecord = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Staff', 'user_id' => $staff->id]);
        $this->actingAs($manager)->deleteJson("/api/employees/{$staffRecord->id}")->assertNoContent();
    }

    public function test_a_role_cant_be_given_made_up_permissions(): void
    {
        $role = $this->company->roles()->create(['name' => 'clerk', 'code' => 'clerk']);

        $this->actingAs($this->admin)->putJson("/api/roles/{$role->id}", ['permissions' => ['employees.view', 'everything.forever']])
            ->assertUnprocessable()->assertJsonValidationErrors('permissions.1');
        $this->assertDatabaseMissing('company_permissions', ['code' => 'everything.forever']);
    }

    // ───────────────────────────── Branch limits ─────────────────────────────

    public function test_a_branch_limited_manager_cant_touch_another_branchs_roster_or_branch(): void
    {
        $here = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Here', 'latitude' => 11.5, 'longitude' => 104.9]);
        $there = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'There', 'latitude' => 11.6, 'longitude' => 104.8]);
        $manager = $this->createUserWithRole($this->company, 'manager');
        MembershipBranchAccess::query()->create(['company_membership_id' => $manager->membership->id, 'branch_id' => $here->id, 'created_at' => now()]);

        $otherId = $this->actingAs($this->admin)->postJson('/api/employees', ['name' => 'Far', 'branch_id' => $there->id])->assertCreated()->json('id');
        $row = Schedule::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $otherId, 'date' => now()->addWeek()->toDateString(),
            'work_schedule_id' => $this->makeWorkSchedule($this->company)->id,
        ]);

        $this->actingAs($manager)->deleteJson("/api/schedules/{$row->id}")->assertNotFound();
        $this->assertNotNull($row->fresh());
        $this->assertSame([], $this->actingAs($manager)->getJson('/api/schedules?per_page=100')->json('data'));

        // Branch names are shared, but only their own branch's QR code and settings.
        $branches = collect($this->actingAs($this->admin)->getJson('/api/branches')->json('data'))->keyBy('name');
        $this->assertArrayHasKey('qr_token', $branches['There']);
        $mine = collect($this->actingAs($manager)->getJson('/api/branches')->json('data'))->keyBy('name');
        $this->assertArrayNotHasKey('qr_token', $mine['There']);
    }

    public function test_a_work_location_cant_point_at_another_companys_branch(): void
    {
        $other = app(CompanyProvisioner::class)->provision('Other Co', 'Them', 'them@other.test', 'password123');
        $theirs = Branch::query()->create(['company_id' => $other->id, 'name' => 'Theirs', 'latitude' => 11.5, 'longitude' => 104.9]);

        $this->actingAs($this->admin)->postJson('/api/work_locations', ['name' => 'Sneaky', 'branch_id' => $theirs->id])
            ->assertUnprocessable()->assertJsonValidationErrors('branch_id');
    }

    // ───────────────────────────── Attendance corrections ─────────────────────────────

    public function test_a_corrections_scans_must_be_on_its_day(): void
    {
        $staff = $this->createUserWithRole($this->company, 'employee');
        Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Staff', 'user_id' => $staff->id]);
        $date = now()->subDays(2)->toDateString();

        $this->actingAs($staff)->postJson('/api/attendance/corrections', [
            'date' => $date, 'reason' => 'forgot', 'scans' => [now()->subMonths(2)->setTime(8, 0)->format('Y-m-d\TH:i')],
        ])->assertUnprocessable()->assertJsonValidationErrors('scans');

        $this->actingAs($staff)->postJson('/api/attendance/corrections', [
            'date' => $date, 'reason' => 'forgot', 'scans' => ["{$date}T08:00"],
        ])->assertCreated();
        $this->assertSame(0, AttendanceDay::query()->count()); // nothing applied until approved
    }
}
