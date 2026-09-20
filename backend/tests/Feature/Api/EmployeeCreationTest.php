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
}
