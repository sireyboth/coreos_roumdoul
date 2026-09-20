<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    public function test_company_admin_can_invite_a_user_with_a_role(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $response = $this->actingAs($admin)->postJson('/api/users', [
            'name' => 'New Manager',
            'email' => 'manager@acme.test',
            'password' => 'password123',
            'role' => 'manager',
        ]);

        $response->assertCreated()->assertJsonFragment(['role' => 'manager']);

        $newUser = User::query()->where('email', 'manager@acme.test')->firstOrFail();
        $this->assertSame($company->id, $newUser->company_id);
        $this->assertTrue($newUser->membership->roles->contains('code', 'manager'));
    }

    public function test_employee_cannot_invite_users(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');

        $employee = $this->createUserWithRole($company, 'employee');

        $this->actingAs($employee)
            ->postJson('/api/users', [
                'name' => 'Should Fail',
                'email' => 'fail@beta.test',
                'password' => 'password123',
                'role' => 'manager',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_change_a_users_role(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();

        $user = $this->createUserWithRole($company, 'employee');

        $this->actingAs($admin)
            ->putJson("/api/users/{$user->id}", ['role' => 'manager'])
            ->assertOk()
            ->assertJsonFragment(['role' => 'manager']);

        $this->assertTrue($user->fresh()->membership->roles->contains('code', 'manager'));
        $this->assertFalse($user->fresh()->membership->roles->contains('code', 'employee'));
    }

    public function test_admin_can_deactivate_a_user_but_not_themselves(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();

        $user = $this->createUserWithRole($company, 'employee');

        $this->actingAs($admin)
            ->patchJson("/api/users/{$user->id}/active", ['is_active' => false])
            ->assertOk();

        $this->assertFalse($user->fresh()->is_active);

        $this->actingAs($admin)
            ->patchJson("/api/users/{$admin->id}/active", ['is_active' => false])
            ->assertStatus(422);
    }

    public function test_deactivated_user_cannot_log_in(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');
        $admin = $company->users()->first();
        $admin->update(['is_active' => false]);

        $this->postJson('/api/auth/login', [
            'email' => 'boss@epsilon.test',
            'password' => 'password123',
        ])->assertStatus(422);
    }

    public function test_admin_cannot_manage_a_user_from_another_company(): void
    {
        $companyA = app(CompanyProvisioner::class)->provision('Zeta', 'Boss A', 'bossa@zeta.test', 'password123');
        $companyB = app(CompanyProvisioner::class)->provision('Eta', 'Boss B', 'bossb@eta.test', 'password123');
        $adminA = $companyA->users()->first();
        $userB = $companyB->users()->first();

        $this->actingAs($adminA)
            ->putJson("/api/users/{$userB->id}", ['role' => 'manager'])
            ->assertNotFound();
    }
}
