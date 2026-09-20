<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\MembershipBranchAccess;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * The frontend turns these machine-readable codes and numbers into real
 * alerts (upgrade prompts, trial banners) instead of a line of red text.
 */
class PlanAlertsTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
    }

    private function subscribe($company, Plan $plan): void
    {
        Subscription::query()->create(['company_id' => $company->id, 'plan_id' => $plan->id, 'status' => 'active']);
    }

    public function test_me_reports_the_plan_limits_current_usage_and_trial_end(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->subscribe($company, Plan::query()->where('code', 'starter')->firstOrFail());
        $admin = $company->users()->first();

        Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $this->actingAs($admin)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('plan.name', 'Starter')
            ->assertJsonPath('plan.max_branches', 1)
            ->assertJsonPath('plan.max_employees', 25)
            ->assertJsonPath('usage.branches', 1)
            ->assertJsonPath('usage.employees', 0)
            ->assertJsonPath('company.status', 'trial')
            ->assertJsonStructure(['company' => ['trial_ends_at']]);
    }

    public function test_hitting_a_plan_limit_returns_a_machine_readable_code(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $this->subscribe($company, Plan::query()->where('code', 'starter')->firstOrFail());
        $admin = $company->users()->first();

        $this->actingAs($admin)->postJson('/api/branches', ['name' => 'One', 'latitude' => 11.5, 'longitude' => 104.9])->assertCreated();

        $this->actingAs($admin)->postJson('/api/branches', ['name' => 'Two', 'latitude' => 11.5, 'longitude' => 104.9])
            ->assertStatus(422)
            ->assertJsonPath('code', 'plan_limit_reached');
    }

    public function test_a_branch_restricted_manager_cannot_get_past_the_employee_limit(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $tiny = Plan::factory()->create(['code' => 'tiny', 'max_employees' => 2]);
        $this->subscribe($company, $tiny);
        $admin = $company->users()->first();

        $a = Branch::query()->create(['company_id' => $company->id, 'name' => 'A']);
        $b = Branch::query()->create(['company_id' => $company->id, 'name' => 'B']);

        $this->actingAs($admin)->postJson('/api/employees', ['name' => 'One', 'branch_id' => $a->id])->assertCreated();
        $this->actingAs($admin)->postJson('/api/employees', ['name' => 'Two', 'branch_id' => $b->id])->assertCreated();

        $manager = $this->createUserWithRole($company, 'manager');
        MembershipBranchAccess::query()->create([
            'company_membership_id' => $manager->membership->id,
            'branch_id' => $a->id,
            'created_at' => now(),
        ]);

        // The manager can only *see* one employee, but the company has two —
        // the limit must be judged on the real headcount, not what they see.
        $this->actingAs($manager)->postJson('/api/employees', ['name' => 'Three', 'branch_id' => $a->id])
            ->assertStatus(422)
            ->assertJsonPath('code', 'plan_limit_reached');

        $this->actingAs($manager)->getJson('/api/me')->assertJsonPath('usage.employees', 2);
    }

    public function test_blocked_accounts_return_a_code_the_frontend_can_act_on(): void
    {
        $suspended = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $suspended->update(['status' => 'suspended']);

        $expired = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');
        $expired->update(['trial_ends_at' => now()->subDay()]);

        $this->actingAs($suspended->users()->first())->getJson('/api/branches')
            ->assertForbidden()
            ->assertJsonPath('code', 'company_suspended');

        $this->actingAs($expired->users()->first())->getJson('/api/branches')
            ->assertForbidden()
            ->assertJsonPath('code', 'trial_expired');
    }

    public function test_a_missing_module_returns_a_code(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Zeta', 'Boss', 'boss@zeta.test', 'password123');

        $this->actingAs($company->users()->first())->postJson('/api/attendance/check-in')
            ->assertForbidden()
            ->assertJsonPath('code', 'module_not_enabled');
    }
}
