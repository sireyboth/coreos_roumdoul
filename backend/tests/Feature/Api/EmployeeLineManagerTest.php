<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Company;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The line manager: who approves an employee's requests first. Kept on the
 * assignment (so it has history like branch/department), never the employee
 * themselves, never a loop, never someone from another company.
 */
class EmployeeLineManagerTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private User $admin;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->admin = $this->company->users()->first();
        $this->branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);
    }

    private function hire(string $name, array $extra = []): int
    {
        return $this->actingAs($this->admin)
            ->postJson('/api/employees', ['name' => $name, 'branch_id' => $this->branch->id, ...$extra])
            ->assertCreated()
            ->json('id');
    }

    public function test_an_employee_can_be_given_a_line_manager_when_hired_and_later(): void
    {
        $boss = $this->hire('Sokha');
        $other = $this->hire('Vanna');

        $staffId = $this->actingAs($this->admin)
            ->postJson('/api/employees', ['name' => 'Dara', 'branch_id' => $this->branch->id, 'manager_employee_id' => $boss])
            ->assertCreated()
            ->assertJsonPath('manager_employee_id', $boss)
            ->assertJsonPath('manager.name', 'Sokha')
            ->json('id');

        $this->actingAs($this->admin)->putJson("/api/employees/{$staffId}", ['manager_employee_id' => $other])
            ->assertOk()
            ->assertJsonPath('manager.name', 'Vanna');

        // A plain profile edit keeps the manager.
        $this->actingAs($this->admin)->putJson("/api/employees/{$staffId}", ['phone' => '012 345 678'])
            ->assertOk()
            ->assertJsonPath('manager_employee_id', $other);

        $this->actingAs($this->admin)->putJson("/api/employees/{$staffId}", ['manager_employee_id' => null])
            ->assertOk()
            ->assertJsonPath('manager_employee_id', null);
    }

    public function test_someone_cannot_be_their_own_manager(): void
    {
        $dara = $this->hire('Dara');

        $this->actingAs($this->admin)->putJson("/api/employees/{$dara}", ['manager_employee_id' => $dara])
            ->assertStatus(422)
            ->assertJsonValidationErrors('manager_employee_id');
    }

    public function test_a_reporting_loop_is_refused(): void
    {
        $a = $this->hire('A');
        $b = $this->hire('B', ['manager_employee_id' => $a]);
        $c = $this->hire('C', ['manager_employee_id' => $b]);

        // A -> C would make A report to C, who reports (via B) to A.
        $this->actingAs($this->admin)->putJson("/api/employees/{$a}", ['manager_employee_id' => $c])
            ->assertStatus(422)
            ->assertJsonValidationErrors('manager_employee_id');
    }

    public function test_a_manager_from_another_company_is_refused(): void
    {
        $other = app(CompanyProvisioner::class)->provision('Other', 'Owner', 'owner@other.test', 'password123');
        $otherBranch = Branch::query()->create(['company_id' => $other->id, 'name' => 'Far']);
        $outsider = $this->actingAs($other->users()->first())
            ->postJson('/api/employees', ['name' => 'Outsider', 'branch_id' => $otherBranch->id])
            ->assertCreated()->json('id');

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)
            ->postJson('/api/employees', ['name' => 'Dara', 'branch_id' => $this->branch->id, 'manager_employee_id' => $outsider])
            ->assertStatus(422)
            ->assertJsonValidationErrors('manager_employee_id');
    }
}
