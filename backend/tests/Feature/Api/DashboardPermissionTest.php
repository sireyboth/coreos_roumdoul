<?php

namespace Tests\Feature\Api;

use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class DashboardPermissionTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    private function permissionsOf($user): array
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user)->getJson('/api/me')->assertOk()->json('permissions');
    }

    public function test_admins_and_managers_get_the_dashboard_but_employees_do_not(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Dash Co', 'Boss', 'boss@dash.test', 'password123');

        $this->assertContains('dashboard.view', $this->permissionsOf($company->users()->first()));
        $this->assertContains('dashboard.view', $this->permissionsOf($this->createUserWithRole($company, 'manager')));

        $employeePermissions = $this->permissionsOf($this->createUserWithRole($company, 'employee'));
        $this->assertNotContains('dashboard.view', $employeePermissions);
        // ...but the pages an employee does need are untouched.
        $this->assertContains('attendance.view', $employeePermissions);
    }

    public function test_dashboard_is_a_permission_admins_can_grant_from_the_roles_page(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Grant Co', 'Boss', 'boss@grant.test', 'password123');
        $admin = $company->users()->first();

        $resources = collect($this->actingAs($admin)->getJson('/api/permissions')->assertOk()->json())->pluck('resource');
        $this->assertContains('dashboard', $resources);

        $roleId = $this->actingAs($admin)
            ->postJson('/api/roles', ['name' => 'Supervisor', 'permissions' => ['dashboard.view', 'attendance.view']])
            ->assertCreated()
            ->json('id');

        $role = collect($this->actingAs($admin)->getJson('/api/roles')->assertOk()->json())->firstWhere('id', $roleId);
        $this->assertEqualsCanonicalizing(['dashboard.view', 'attendance.view'], $role['permissions']);
    }
}
