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
}
