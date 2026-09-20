<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\MembershipBranchAccess;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class BranchAccessTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    public function test_membership_with_no_branch_access_rows_sees_every_branchs_employees(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $branchA = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch A']);
        $branchB = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch B']);

        $manager = $this->createUserWithRole($company, 'manager');

        $this->actingAs($admin)->postJson('/api/employees', ['name' => 'Alice', 'branch_id' => $branchA->id])->assertCreated();
        $this->actingAs($admin)->postJson('/api/employees', ['name' => 'Bob', 'branch_id' => $branchB->id])->assertCreated();

        $names = collect($this->actingAs($manager)->getJson('/api/employees')->json('data'))->pluck('name');

        $this->assertEqualsCanonicalizing(['Alice', 'Bob'], $names->all());
    }

    public function test_manager_restricted_to_one_branch_cannot_see_another_branchs_employees(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();

        $branchA = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch A']);
        $branchB = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch B']);

        $manager = $this->createUserWithRole($company, 'manager');

        MembershipBranchAccess::query()->create([
            'company_membership_id' => $manager->membership->id,
            'branch_id' => $branchA->id,
            'created_at' => now(),
        ]);

        $this->actingAs($admin)->postJson('/api/employees', ['name' => 'Alice', 'branch_id' => $branchA->id])->assertCreated();
        $branchBEmployeeId = $this->actingAs($admin)
            ->postJson('/api/employees', ['name' => 'Bob', 'branch_id' => $branchB->id])
            ->assertCreated()
            ->json('id');

        $names = collect($this->actingAs($manager)->getJson('/api/employees')->json('data'))->pluck('name');
        $this->assertEquals(['Alice'], $names->all());

        $this->actingAs($manager)
            ->getJson("/api/employees/{$branchBEmployeeId}")
            ->assertNotFound();

        // The restriction is per-membership, not global — the admin (no
        // membership_branch_access rows) still sees both.
        $adminNames = collect($this->actingAs($admin)->getJson('/api/employees')->json('data'))->pluck('name');
        $this->assertEqualsCanonicalizing(['Alice', 'Bob'], $adminNames->all());
    }

    public function test_manager_restricted_to_one_branch_cannot_create_an_employee_in_another_branch(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');

        $branchA = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch A']);
        $branchB = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch B']);

        $manager = $this->createUserWithRole($company, 'manager');

        MembershipBranchAccess::query()->create([
            'company_membership_id' => $manager->membership->id,
            'branch_id' => $branchA->id,
            'created_at' => now(),
        ]);

        $this->actingAs($manager)
            ->postJson('/api/employees', ['name' => 'Sneaky', 'branch_id' => $branchB->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('branch_id');

        $this->actingAs($manager)
            ->postJson('/api/employees', ['name' => 'Fine', 'branch_id' => $branchA->id])
            ->assertCreated();

        $this->assertSame(0, Employee::query()->withoutBranchAccessScope()->where('company_id', $company->id)->where('branch_id', $branchB->id)->count());
    }

    public function test_admin_can_set_and_clear_a_users_branch_access_via_the_api(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();

        $branchA = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch A']);
        $branchB = Branch::query()->create(['company_id' => $company->id, 'name' => 'Branch B']);
        $manager = $this->createUserWithRole($company, 'manager');

        $this->actingAs($admin)
            ->putJson("/api/users/{$manager->id}/branch-access", ['branch_ids' => [$branchA->id]])
            ->assertOk()
            ->assertJsonPath('branch_ids', [$branchA->id]);

        $this->assertEquals([$branchA->id], $manager->fresh()->membership->accessibleBranchIds());

        // A branch from another company is rejected.
        $otherCompany = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');
        $otherBranch = Branch::query()->create(['company_id' => $otherCompany->id, 'name' => 'Foreign Branch']);

        $this->actingAs($admin)
            ->putJson("/api/users/{$manager->id}/branch-access", ['branch_ids' => [$otherBranch->id]])
            ->assertStatus(422)
            ->assertJsonValidationErrors('branch_ids.0');

        // Clearing it back to an empty array means unrestricted again.
        $this->actingAs($admin)
            ->putJson("/api/users/{$manager->id}/branch-access", ['branch_ids' => []])
            ->assertOk()
            ->assertJsonPath('branch_ids', null);

        $this->assertNull($manager->fresh()->membership->accessibleBranchIds());
    }
}
