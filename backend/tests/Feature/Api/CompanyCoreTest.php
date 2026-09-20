<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\CompanyModuleEntitlement;
use App\Models\Module;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class CompanyCoreTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
    }

    public function test_registering_a_company_provisions_roles_and_sends_a_welcome_notification(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'company_name' => 'Acme Inc',
            'name' => 'Admin User',
            'email' => 'admin@acme.test',
            'password' => 'password123',
        ]);

        $response->assertCreated();

        $admin = User::query()->where('email', 'admin@acme.test')->first();

        $this->assertTrue($admin->membership->roles->contains('code', 'company-admin'));
        $this->assertCount(1, $admin->notifications);
        $this->assertSame('company.created', \App\Models\AuditLog::query()->first()->event);
    }

    public function test_company_admin_can_manage_branches_but_employee_cannot(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta LLC', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();

        $employee = $this->createUserWithRole($company, 'employee');

        $this->actingAs($admin)
            ->postJson('/api/branches', ['name' => 'HQ', 'latitude' => 11.5564, 'longitude' => 104.9282])
            ->assertCreated();

        $this->actingAs($employee)
            ->postJson('/api/branches', ['name' => 'Should fail'])
            ->assertForbidden();

        $this->actingAs($employee)
            ->getJson('/api/branches')
            ->assertForbidden();

        $this->actingAs($employee)
            ->getJson('/api/employees')
            ->assertOk();
    }

    public function test_branch_creation_is_blocked_once_the_plan_limit_is_reached(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma Co', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();

        $starter = Plan::query()->where('code', 'starter')->firstOrFail();
        Subscription::query()->create([
            'company_id' => $company->id,
            'plan_id' => $starter->id,
            'status' => 'active',
        ]);

        $this->actingAs($admin)->postJson('/api/branches', ['name' => 'Only Branch', 'latitude' => 11.5564, 'longitude' => 104.9282])->assertCreated();

        $this->actingAs($admin)
            ->postJson('/api/branches', ['name' => 'One Too Many'])
            ->assertStatus(422);
    }

    /**
     * The Stage 1 spec's explicit success condition: Company A must never
     * be able to reach Company B's data, re-verified against the new
     * membership-based company resolution (no company_id column on users).
     */
    public function test_company_a_cannot_access_company_bs_data(): void
    {
        $companyA = app(CompanyProvisioner::class)->provision('Company A', 'Boss A', 'bossa@a.test', 'password123');
        $companyB = app(CompanyProvisioner::class)->provision('Company B', 'Boss B', 'bossb@b.test', 'password123');
        $adminA = $companyA->users()->first();

        $branchB = $this->actingAs($companyB->users()->first())
            ->postJson('/api/branches', ['name' => 'B HQ', 'latitude' => 11.5564, 'longitude' => 104.9282])
            ->assertCreated()
            ->json();

        $this->actingAs($adminA)
            ->getJson("/api/branches/{$branchB['id']}")
            ->assertNotFound();

        $this->actingAs($adminA)
            ->getJson('/api/branches')
            ->assertOk()
            ->assertJsonMissing(['name' => 'B HQ']);

        $employeeB = $this->createUserWithRole($companyB, 'employee');

        $this->actingAs($adminA)
            ->putJson("/api/users/{$employeeB->id}", ['role' => 'manager'])
            ->assertNotFound();
    }

    public function test_module_override_notifies_company_admins_and_flips_entitlement(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta Co', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();
        $hrModule = Module::query()->where('code', 'hr')->firstOrFail();

        $this->assertFalse($company->fresh()->hasModule('hr'));

        CompanyModuleEntitlement::query()->create([
            'company_id' => $company->id,
            'module_id' => $hrModule->id,
            'is_enabled' => true,
        ]);

        $this->assertTrue($company->fresh()->hasModule('hr'));
        $this->assertCount(2, $admin->fresh()->notifications); // welcome + module change
    }

    public function test_module_override_only_applies_within_its_time_window(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Zeta Co', 'Boss', 'boss@zeta.test', 'password123');
        $hrModule = Module::query()->where('code', 'hr')->firstOrFail();

        // An override that already ended is ignored entirely — access falls
        // back to whatever the plan grants (nothing here), not stuck "on".
        CompanyModuleEntitlement::query()->create([
            'company_id' => $company->id,
            'module_id' => $hrModule->id,
            'is_enabled' => true,
            'ends_at' => now()->subDay(),
        ]);

        $this->assertFalse($company->fresh()->hasModule('hr'));

        $hrModule->fresh();
        CompanyModuleEntitlement::query()->where('company_id', $company->id)->where('module_id', $hrModule->id)->delete();
        CompanyModuleEntitlement::query()->create([
            'company_id' => $company->id,
            'module_id' => $hrModule->id,
            'is_enabled' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
        ]);

        $this->assertTrue($company->fresh()->hasModule('hr'));
    }
}
