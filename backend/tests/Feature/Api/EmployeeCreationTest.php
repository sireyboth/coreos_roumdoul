<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeCreationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    public function test_employee_cannot_be_created_without_a_branch(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'No Branch'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('branch_id');
    }

    public function test_employee_can_be_created_with_a_branch(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'With Branch', 'branch_id' => $branch->id])
            ->assertCreated()
            ->assertJsonPath('branch.id', $branch->id);
    }

    public function test_reassigning_an_employees_branch_preserves_history_instead_of_overwriting_it(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();
        $hq = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);
        $branchTwo = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch Two']);

        $employeeId = $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'Mover', 'branch_id' => $hq->id])
            ->assertCreated()
            ->json('id');

        $this->actingAs($admin)
            ->putJson("/api/employees/{$employeeId}", ['branch_id' => $branchTwo->id])
            ->assertOk()
            ->assertJsonPath('branch.id', $branchTwo->id);

        $employee = \App\Models\Employee::query()->findOrFail($employeeId);
        $this->assertCount(2, $employee->assignments);
        $this->assertSame($hq->id, $employee->assignments()->whereNotNull('effective_to')->first()->branch_id);
        $this->assertSame($branchTwo->id, $employee->currentAssignment->branch_id);
    }

    public function test_creating_and_deleting_an_employee_records_usage(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $employeeId = $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'Countable', 'branch_id' => $branch->id])
            ->assertCreated()
            ->json('id');

        $this->assertSame(1, $company->usageRecords()->where('metric', 'employees_count')->latest('id')->value('value'));

        $this->actingAs($admin)->deleteJson("/api/employees/{$employeeId}")->assertNoContent();

        $this->assertSame(0, $company->usageRecords()->where('metric', 'employees_count')->latest('id')->value('value'));
    }

    public function test_adding_an_employee_with_a_password_creates_a_login_linked_to_them(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Login Co', 'Boss', 'boss@loginco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)
            ->postJson('/api/employees', [
                'name' => 'Sokha',
                'email' => 'sokha@loginco.test',
                'password' => 'password123',
                'branch_id' => $branch->id,
            ])
            ->assertCreated()
            ->assertJsonPath('has_login', true);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'sokha@loginco.test',
            'password' => 'password123',
        ])->assertOk()->json('token');

        // actingAs() above leaves the admin on the web guard, which Sanctum
        // checks before the token — a real request has no such leftover.
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/me', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('employee.name', 'Sokha')
            ->assertJsonPath('roles.0', 'employee');
    }

    public function test_a_password_requires_an_email_and_the_email_must_be_unused(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Dup Co', 'Boss', 'boss@dupco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'No Email', 'password' => 'password123', 'branch_id' => $branch->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->actingAs($admin)
            ->postJson('/api/employees', [
                'name' => 'Taken',
                'email' => 'boss@dupco.test',
                'password' => 'password123',
                'branch_id' => $branch->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->assertSame(0, \App\Models\Employee::query()->count());
    }

    public function test_an_employee_added_without_a_login_can_be_given_one_later_but_only_once(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Later Co', 'Boss', 'boss@laterco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $employeeId = $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'Dara', 'branch_id' => $branch->id])
            ->assertCreated()
            ->assertJsonPath('has_login', false)
            ->json('id');

        $this->actingAs($admin)
            ->postJson("/api/employees/{$employeeId}/login", ['email' => 'dara@laterco.test', 'password' => 'password123'])
            ->assertOk()
            ->assertJsonPath('has_login', true);

        $this->assertSame(
            $employeeId,
            \App\Models\User::query()->where('email', 'dara@laterco.test')->firstOrFail()->employee->id,
        );

        $this->actingAs($admin)
            ->postJson("/api/employees/{$employeeId}/login", ['email' => 'again@laterco.test', 'password' => 'password123'])
            ->assertStatus(422);
    }

    public function test_an_employee_role_user_cannot_create_logins(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Perm Co', 'Boss', 'boss@permco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);
        $employeeId = $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'Target', 'branch_id' => $branch->id])
            ->json('id');

        $staff = \App\Models\User::factory()->create();
        $membership = $staff->membership()->create(['company_id' => $company->id, 'status' => 'active', 'joined_at' => now()]);
        $membership->roles()->attach(
            \App\Models\CompanyRole::query()->where('company_id', $company->id)->where('name', 'employee')->value('id'),
            ['created_at' => now()],
        );

        $this->actingAs($staff)
            ->postJson("/api/employees/{$employeeId}/login", ['email' => 'x@permco.test', 'password' => 'password123'])
            ->assertForbidden();
    }

    public function test_the_full_profile_can_be_saved_and_read_back(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Profile Co', 'Boss', 'boss@profileco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)
            ->postJson('/api/employees', [
                'name' => 'Sokha Dara',
                'branch_id' => $branch->id,
                'employee_code' => 'E-001',
                'phone' => '012 345 678',
                'gender' => 'female',
                'date_of_birth' => '1995-04-12',
                'address' => 'Phnom Penh',
                'employment_type' => 'full_time',
                'hire_date' => '2026-01-05',
                'notes' => 'Prefers morning shifts',
            ])
            ->assertCreated()
            ->assertJsonPath('phone', '012 345 678')
            ->assertJsonPath('employment_type', 'full_time')
            ->assertJsonPath('gender', 'female')
            ->assertJsonPath('address', 'Phnom Penh');

        $this->actingAs($admin)
            ->getJson('/api/employees')
            ->assertOk()
            ->assertJsonPath('data.0.notes', 'Prefers morning shifts')
            ->assertJsonPath('data.0.hire_date', '2026-01-05T00:00:00.000000Z');
    }

    public function test_personal_details_are_hidden_from_people_who_cannot_manage_employees(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Privacy Co', 'Boss', 'boss@privacyco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)->postJson('/api/employees', [
            'name' => 'Sokha',
            'email' => 'sokha@privacyco.test',
            'password' => 'password123',
            'branch_id' => $branch->id,
            'phone' => '012 345 678',
            'gender' => 'female',
            'date_of_birth' => '1995-04-12',
            'address' => 'Phnom Penh',
            'notes' => 'private',
        ])->assertCreated();

        $sokha = \App\Models\User::query()->where('email', 'sokha@privacyco.test')->firstOrFail();
        $this->app['auth']->forgetGuards();

        $row = $this->actingAs($sokha)->getJson('/api/employees')->assertOk()->json('data.0');

        // The work profile is visible, the personal details are not.
        $this->assertSame('012 345 678', $row['phone']);
        foreach (['gender', 'date_of_birth', 'address', 'notes'] as $field) {
            $this->assertArrayNotHasKey($field, $row);
        }
    }

    public function test_employee_code_must_be_unique_within_the_company(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Code Co', 'Boss', 'boss@codeco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'First', 'branch_id' => $branch->id, 'employee_code' => 'E-1'])
            ->assertCreated();

        $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'Second', 'branch_id' => $branch->id, 'employee_code' => 'E-1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('employee_code');
    }

    public function test_profile_fields_are_validated(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Valid Co', 'Boss', 'boss@validco.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)
            ->postJson('/api/employees', [
                'name' => 'Bad',
                'branch_id' => $branch->id,
                'gender' => 'robot',
                'employment_type' => 'forever',
                'date_of_birth' => '2999-01-01',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['gender', 'employment_type', 'date_of_birth']);
    }

    private function branchIdsOf(int $companyId, string $email): ?array
    {
        $this->app['auth']->forgetGuards();
        $admin = \App\Models\Company::query()->findOrFail($companyId)->users()->first();

        $row = collect($this->actingAs($admin)->getJson('/api/users')->assertOk()->json())->firstWhere('email', $email);

        return $row['branch_ids'];
    }

    public function test_a_new_employee_login_only_sees_the_branch_the_employee_was_given(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Scope Co', 'Boss', 'boss@scopeco.test', 'password123');
        $admin = $company->users()->first();
        $hq = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);
        $other = Branch::query()->create(['company_id' => $company->id, 'name' => 'Other']);

        $this->actingAs($admin)->postJson('/api/employees', [
            'name' => 'Sokha', 'email' => 'sokha@scopeco.test', 'password' => 'password123', 'branch_id' => $hq->id,
        ])->assertCreated();
        $this->actingAs($admin)->postJson('/api/employees', ['name' => 'Elsewhere', 'branch_id' => $other->id])->assertCreated();

        // Not "All branches" any more.
        $this->assertSame([$hq->id], $this->branchIdsOf($company->id, 'sokha@scopeco.test'));

        // And it really is enforced: Sokha can't see the other branch's employee.
        $sokha = \App\Models\User::query()->where('email', 'sokha@scopeco.test')->firstOrFail();
        $this->app['auth']->forgetGuards();
        $names = collect($this->actingAs($sokha)->getJson('/api/employees')->assertOk()->json('data'))->pluck('name')->all();
        $this->assertSame(['Sokha'], $names);
    }

    public function test_a_login_added_later_is_scoped_to_the_employees_branch_too(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Later Co', 'Boss', 'boss@laterco.test', 'password123');
        $admin = $company->users()->first();
        $hq = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $id = $this->actingAs($admin)->postJson('/api/employees', ['name' => 'Late', 'branch_id' => $hq->id])->json('id');
        $this->actingAs($admin)->postJson("/api/employees/{$id}/login", ['email' => 'late@laterco.test', 'password' => 'password123'])->assertOk();

        $this->assertSame([$hq->id], $this->branchIdsOf($company->id, 'late@laterco.test'));
    }

    public function test_moving_an_employee_moves_their_logins_branch_and_they_still_see_themselves(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Move Co', 'Boss', 'boss@moveco.test', 'password123');
        $admin = $company->users()->first();
        $hq = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);
        $two = Branch::query()->create(['company_id' => $company->id, 'name' => 'Two']);

        $id = $this->actingAs($admin)->postJson('/api/employees', [
            'name' => 'Mover', 'email' => 'mover@moveco.test', 'password' => 'password123', 'branch_id' => $hq->id,
        ])->json('id');

        $this->actingAs($admin)->putJson("/api/employees/{$id}", ['branch_id' => $two->id])->assertOk();

        $this->assertSame([$two->id], $this->branchIdsOf($company->id, 'mover@moveco.test'));

        // Without the follow-along they would be locked out of their own record.
        $mover = \App\Models\User::query()->where('email', 'mover@moveco.test')->firstOrFail();
        $this->app['auth']->forgetGuards();
        $this->actingAs($mover)->getJson('/api/me')->assertOk()->assertJsonPath('employee.name', 'Mover');
    }

    public function test_a_login_an_admin_customised_or_left_unrestricted_is_not_changed_by_a_move(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Keep Co', 'Boss', 'boss@keepco.test', 'password123');
        $admin = $company->users()->first();
        $a = Branch::query()->create(['company_id' => $company->id, 'name' => 'A']);
        $b = Branch::query()->create(['company_id' => $company->id, 'name' => 'B']);
        $c = Branch::query()->create(['company_id' => $company->id, 'name' => 'C']);

        $wide = $this->actingAs($admin)->postJson('/api/employees', [
            'name' => 'Wide', 'email' => 'wide@keepco.test', 'password' => 'password123', 'branch_id' => $a->id,
        ])->json('id');
        $free = $this->actingAs($admin)->postJson('/api/employees', [
            'name' => 'Free', 'email' => 'free@keepco.test', 'password' => 'password123', 'branch_id' => $a->id,
        ])->json('id');

        $wideUser = \App\Models\User::query()->where('email', 'wide@keepco.test')->firstOrFail();
        $freeUser = \App\Models\User::query()->where('email', 'free@keepco.test')->firstOrFail();
        $this->actingAs($admin)->putJson("/api/users/{$wideUser->id}/branch-access", ['branch_ids' => [$a->id, $b->id]])->assertOk();
        $this->actingAs($admin)->putJson("/api/users/{$freeUser->id}/branch-access", ['branch_ids' => []])->assertOk();

        $this->actingAs($admin)->putJson("/api/employees/{$wide}", ['branch_id' => $c->id])->assertOk();
        $this->actingAs($admin)->putJson("/api/employees/{$free}", ['branch_id' => $c->id])->assertOk();

        $this->assertEqualsCanonicalizing([$a->id, $b->id], $this->branchIdsOf($company->id, 'wide@keepco.test'));
        $this->assertNull($this->branchIdsOf($company->id, 'free@keepco.test'));
    }
}
