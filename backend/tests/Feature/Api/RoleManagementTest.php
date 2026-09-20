<?php

namespace Tests\Feature\Api;

use App\Models\CompanyRole;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    public function test_company_admin_can_create_a_custom_role_with_specific_permissions(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $response = $this->actingAs($admin)->postJson('/api/roles', [
            'name' => 'HR Officer',
            'permissions' => ['employees.view', 'employees.manage'],
        ]);

        $response->assertCreated()->assertJsonFragment(['name' => 'HR Officer']);

        $role = CompanyRole::query()->where('name', 'HR Officer')->where('company_id', $company->id)->firstOrFail();
        $this->assertTrue($role->permissions()->where('code', 'employees.manage')->exists());
        $this->assertFalse($role->permissions()->where('code', 'branches.manage')->exists());
    }

    public function test_new_role_can_be_assigned_to_a_user(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)->postJson('/api/roles', [
            'name' => 'Supervisor',
            'permissions' => ['teams.view', 'teams.manage'],
        ])->assertCreated();

        $response = $this->actingAs($admin)->postJson('/api/users', [
            'name' => 'New Super',
            'email' => 'super@beta.test',
            'password' => 'password123',
            'role' => 'Supervisor',
        ]);

        $response->assertCreated()->assertJsonFragment(['role' => 'Supervisor']);
    }

    public function test_company_admin_role_cannot_be_edited_or_deleted(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();
        $adminRole = CompanyRole::query()->where('name', 'company-admin')->where('company_id', $company->id)->firstOrFail();

        $this->actingAs($admin)
            ->putJson("/api/roles/{$adminRole->id}", ['permissions' => ['branches.view']])
            ->assertStatus(422);

        $this->actingAs($admin)
            ->deleteJson("/api/roles/{$adminRole->id}")
            ->assertStatus(422);
    }

    public function test_role_still_assigned_to_a_user_cannot_be_deleted(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)->postJson('/api/roles', [
            'name' => 'Cashier',
            'permissions' => ['employees.view'],
        ])->assertCreated();

        $cashierRole = CompanyRole::query()->where('name', 'Cashier')->where('company_id', $company->id)->firstOrFail();

        $this->createUserWithRole($company, 'Cashier');

        $this->actingAs($admin)
            ->deleteJson("/api/roles/{$cashierRole->id}")
            ->assertStatus(422);
    }

    public function test_employee_cannot_manage_roles(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');

        $employee = $this->createUserWithRole($company, 'employee');

        $this->actingAs($employee)
            ->postJson('/api/roles', ['name' => 'Should Fail', 'permissions' => []])
            ->assertForbidden();
    }

    public function test_admin_cannot_touch_another_companys_role(): void
    {
        $companyA = app(CompanyProvisioner::class)->provision('Zeta', 'Boss A', 'bossa@zeta.test', 'password123');
        $companyB = app(CompanyProvisioner::class)->provision('Eta', 'Boss B', 'bossb@eta.test', 'password123');
        $adminA = $companyA->users()->first();
        $roleB = CompanyRole::query()->where('name', 'manager')->where('company_id', $companyB->id)->firstOrFail();

        $this->actingAs($adminA)
            ->putJson("/api/roles/{$roleB->id}", ['permissions' => []])
            ->assertNotFound();
    }
}
