<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Team;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class OrganizationStructureTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private $admin;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Org Co', 'Boss', 'boss@org.test', 'password123');
        $this->admin = $this->company->users()->first();
        $this->branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);
    }

    private function as($user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function rival(): array
    {
        $rival = app(CompanyProvisioner::class)->provision('Rival Co', 'Rival', 'boss@rival.test', 'password123');

        return [
            $rival,
            Branch::query()->create(['company_id' => $rival->id, 'name' => 'Rival HQ']),
            Department::query()->create(['company_id' => $rival->id, 'name' => 'Rival Dept']),
            Team::query()->create(['company_id' => $rival->id, 'name' => 'Rival Team']),
        ];
    }

    public function test_another_companys_department_team_or_branch_cannot_be_referenced(): void
    {
        [, $rivalBranch, $rivalDepartment, $rivalTeam] = $this->rival();

        $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Sneaky', 'branch_id' => $this->branch->id, 'department_id' => $rivalDepartment->id,
        ])->assertStatus(422)->assertJsonValidationErrors('department_id');

        $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Sneaky', 'branch_id' => $this->branch->id, 'team_id' => $rivalTeam->id,
        ])->assertStatus(422)->assertJsonValidationErrors('team_id');

        $this->as($this->admin)->postJson('/api/departments', ['name' => 'X', 'branch_id' => $rivalBranch->id])
            ->assertStatus(422)->assertJsonValidationErrors('branch_id');
        $this->as($this->admin)->postJson('/api/departments', ['name' => 'X', 'parent_department_id' => $rivalDepartment->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_department_id');
        $this->as($this->admin)->postJson('/api/teams', ['name' => 'X', 'department_id' => $rivalDepartment->id])
            ->assertStatus(422)->assertJsonValidationErrors('department_id');
    }

    public function test_an_employee_can_be_given_and_moved_between_departments_and_teams(): void
    {
        $sales = Department::query()->create(['company_id' => $this->company->id, 'name' => 'Sales']);
        $ops = Department::query()->create(['company_id' => $this->company->id, 'name' => 'Ops']);
        $salesTeam = Team::query()->create(['company_id' => $this->company->id, 'department_id' => $sales->id, 'name' => 'Field']);

        $id = $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Dara', 'branch_id' => $this->branch->id, 'department_id' => $sales->id, 'team_id' => $salesTeam->id,
        ])->assertCreated()->assertJsonPath('department.name', 'Sales')->assertJsonPath('team.name', 'Field')->json('id');

        // Moving to another department and clearing the team keeps history.
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['department_id' => $ops->id, 'team_id' => null])
            ->assertOk()->assertJsonPath('department.name', 'Ops')->assertJsonPath('team', null);

        $this->assertCount(2, Employee::query()->findOrFail($id)->assignments);
    }

    public function test_lists_include_headcounts_and_ignore_people_who_left(): void
    {
        $sales = Department::query()->create(['company_id' => $this->company->id, 'name' => 'Sales']);
        $team = Team::query()->create(['company_id' => $this->company->id, 'department_id' => $sales->id, 'name' => 'Field']);

        foreach (['A', 'B'] as $name) {
            $this->as($this->admin)->postJson('/api/employees', [
                'name' => $name, 'branch_id' => $this->branch->id, 'department_id' => $sales->id, 'team_id' => $team->id,
            ])->assertCreated();
        }
        $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Gone', 'branch_id' => $this->branch->id, 'department_id' => $sales->id, 'employment_status' => 'terminated',
        ])->assertCreated();

        $department = collect($this->as($this->admin)->getJson('/api/departments')->assertOk()->json('data'))->firstWhere('id', $sales->id);
        $this->assertSame(2, $department['members_count']);
        $this->assertSame(1, $department['teams_count']);

        $this->assertSame(2, $this->as($this->admin)->getJson('/api/teams')->assertOk()->json('data.0.members_count'));
    }

    public function test_a_department_or_team_with_people_in_it_cannot_be_deleted_but_an_empty_one_can(): void
    {
        $sales = Department::query()->create(['company_id' => $this->company->id, 'name' => 'Sales']);
        $team = Team::query()->create(['company_id' => $this->company->id, 'department_id' => $sales->id, 'name' => 'Field']);
        $empty = Department::query()->create(['company_id' => $this->company->id, 'name' => 'Empty']);

        $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Dara', 'branch_id' => $this->branch->id, 'department_id' => $sales->id, 'team_id' => $team->id,
        ])->assertCreated();

        $this->as($this->admin)->deleteJson("/api/teams/{$team->id}")
            ->assertStatus(422)->assertJsonValidationErrors('team');

        $this->as($this->admin)->deleteJson("/api/departments/{$sales->id}")
            ->assertStatus(422)->assertJsonValidationErrors('department');
        $this->assertNotNull(Department::query()->find($sales->id));

        $this->as($this->admin)->deleteJson("/api/departments/{$empty->id}")->assertNoContent();
        $this->assertNull(Department::query()->find($empty->id));
    }

    public function test_a_department_with_sub_departments_or_teams_cannot_be_deleted(): void
    {
        $parent = Department::query()->create(['company_id' => $this->company->id, 'name' => 'Parent']);
        Department::query()->create(['company_id' => $this->company->id, 'name' => 'Child', 'parent_department_id' => $parent->id]);

        $this->as($this->admin)->deleteJson("/api/departments/{$parent->id}")->assertStatus(422);
    }

    public function test_a_department_cannot_become_its_own_ancestor(): void
    {
        $a = Department::query()->create(['company_id' => $this->company->id, 'name' => 'A']);
        $b = Department::query()->create(['company_id' => $this->company->id, 'name' => 'B', 'parent_department_id' => $a->id]);
        $c = Department::query()->create(['company_id' => $this->company->id, 'name' => 'C', 'parent_department_id' => $b->id]);

        $this->as($this->admin)->putJson("/api/departments/{$a->id}", ['parent_department_id' => $a->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_department_id');
        $this->as($this->admin)->putJson("/api/departments/{$a->id}", ['parent_department_id' => $c->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_department_id');

        // Re-parenting sideways is fine.
        $this->as($this->admin)->putJson("/api/departments/{$c->id}", ['parent_department_id' => $a->id])->assertOk();
    }

    public function test_departments_and_teams_can_be_created_edited_and_listed_in_full_for_dropdowns(): void
    {
        $this->as($this->admin)->postJson('/api/departments', [
            'name' => 'Finance', 'code' => 'FIN', 'branch_id' => $this->branch->id,
        ])->assertCreated()->assertJsonPath('branch.name', 'HQ');

        foreach (range(1, 30) as $i) {
            Department::query()->create(['company_id' => $this->company->id, 'name' => sprintf('D%02d', $i)]);
        }

        $this->assertCount(25, $this->as($this->admin)->getJson('/api/departments')->json('data'));
        $this->assertCount(31, $this->as($this->admin)->getJson('/api/departments?per_page=200')->json('data'));
    }

    public function test_employees_cannot_manage_the_structure_but_managers_can_run_teams(): void
    {
        $employee = $this->createUserWithRole($this->company, 'employee');
        $manager = $this->createUserWithRole($this->company, 'manager');

        $this->as($employee)->postJson('/api/departments', ['name' => 'Nope'])->assertForbidden();
        $this->as($employee)->postJson('/api/teams', ['name' => 'Nope'])->assertForbidden();

        // Managers can view departments but only manage teams (their default role).
        $this->as($manager)->getJson('/api/departments')->assertOk();
        $this->as($manager)->postJson('/api/departments', ['name' => 'Nope'])->assertForbidden();
        $this->as($manager)->postJson('/api/teams', ['name' => 'Crew'])->assertCreated();
    }

    private function employee(string $name, array $extra = []): int
    {
        return $this->as($this->admin)->postJson('/api/employees', ['name' => $name, 'branch_id' => $this->branch->id] + $extra)
            ->assertCreated()->json('id');
    }

    private function dept(string $name, array $extra = []): Department
    {
        return Department::query()->create(['company_id' => $this->company->id, 'name' => $name] + $extra);
    }

    private function team(string $name, ?Department $department = null): Team
    {
        return Team::query()->create(['company_id' => $this->company->id, 'name' => $name, 'department_id' => $department?->id]);
    }

    public function test_the_employee_list_can_show_just_a_departments_or_teams_current_members(): void
    {
        $sales = $this->dept('Sales');
        $field = $this->team('Field', $sales);
        $a = $this->employee('Alice', ['department_id' => $sales->id, 'team_id' => $field->id]);
        $this->employee('Bob', ['department_id' => $sales->id]);
        $this->employee('Cara');
        $this->employee('Left', ['department_id' => $sales->id, 'employment_status' => 'terminated']);

        $names = fn ($query) => collect($this->as($this->admin)->getJson("/api/employees?{$query}")->assertOk()->json('data'))->pluck('name')->all();

        $this->assertSame(['Alice', 'Bob'], $names("department_id={$sales->id}"));
        $this->assertSame(['Alice'], $names("team_id={$field->id}"));
        $this->assertCount(4, $names(''));
        $this->assertNotNull($a);
    }

    public function test_the_employee_list_is_not_capped_at_25_when_asked_for_more(): void
    {
        foreach (range(1, 30) as $i) {
            Employee::query()->create(['company_id' => $this->company->id, 'name' => sprintf('Emp %02d', $i)]);
        }

        $page = $this->as($this->admin)->getJson('/api/employees?per_page=200')->assertOk();

        $this->assertCount(30, $page->json('data'));
        $this->assertSame(30, $page->json('total'));
        $this->assertCount(25, $this->as($this->admin)->getJson('/api/employees')->json('data'));
    }

    public function test_several_employees_can_be_added_to_a_department_at_once_and_moved_from_another(): void
    {
        $sales = $this->dept('Sales');
        $ops = $this->dept('Ops');
        $opsTeam = $this->team('Night crew', $ops);
        $a = $this->employee('Alice');
        $b = $this->employee('Bob', ['department_id' => $ops->id, 'team_id' => $opsTeam->id]);

        $this->as($this->admin)->postJson("/api/departments/{$sales->id}/members", ['employee_ids' => [$a, $b]])
            ->assertOk()->assertJsonPath('added', 2);

        $bob = Employee::query()->findOrFail($b);
        $this->assertSame($sales->id, $bob->currentAssignment->department_id);
        // Bob's old team belonged to Ops, so it no longer fits and is cleared…
        $this->assertNull($bob->currentAssignment->team_id);
        // …and the move is history, not an overwrite.
        $this->assertCount(2, $bob->assignments);
        // Their branch is untouched.
        $this->assertSame($this->branch->id, $bob->currentAssignment->branch_id);
    }

    public function test_joining_a_team_also_puts_the_employee_in_the_teams_department(): void
    {
        $sales = $this->dept('Sales');
        $ops = $this->dept('Ops');
        $field = $this->team('Field', $sales);
        $a = $this->employee('Alice', ['department_id' => $ops->id]);

        $this->as($this->admin)->postJson("/api/teams/{$field->id}/members", ['employee_ids' => [$a]])->assertOk();

        $assignment = Employee::query()->findOrFail($a)->currentAssignment;
        $this->assertSame($field->id, $assignment->team_id);
        $this->assertSame($sales->id, $assignment->department_id);
    }

    public function test_members_can_be_removed_and_removing_from_a_department_drops_its_team_too(): void
    {
        $sales = $this->dept('Sales');
        $field = $this->team('Field', $sales);
        $a = $this->employee('Alice', ['department_id' => $sales->id, 'team_id' => $field->id]);
        $b = $this->employee('Bob', ['department_id' => $sales->id, 'team_id' => $field->id]);

        $this->as($this->admin)->deleteJson("/api/teams/{$field->id}/members/{$a}")->assertNoContent();
        $alice = Employee::query()->findOrFail($a)->currentAssignment;
        $this->assertNull($alice->team_id);
        $this->assertSame($sales->id, $alice->department_id);

        $this->as($this->admin)->deleteJson("/api/departments/{$sales->id}/members/{$b}")->assertNoContent();
        $bob = Employee::query()->findOrFail($b)->currentAssignment;
        $this->assertNull($bob->department_id);
        $this->assertNull($bob->team_id);

        // Removing someone who isn't a member is a clear error, not a silent no-op.
        $this->as($this->admin)->deleteJson("/api/departments/{$sales->id}/members/{$b}")->assertStatus(422);
    }

    public function test_a_team_must_belong_to_the_employees_department(): void
    {
        $sales = $this->dept('Sales');
        $ops = $this->dept('Ops');
        $field = $this->team('Field', $sales);

        $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Mismatch', 'branch_id' => $this->branch->id, 'department_id' => $ops->id, 'team_id' => $field->id,
        ])->assertStatus(422)->assertJsonValidationErrors('team_id');

        $id = $this->employee('Fine', ['department_id' => $sales->id, 'team_id' => $field->id]);
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['department_id' => $ops->id])
            ->assertStatus(422)->assertJsonValidationErrors('team_id');
        // Changing both together is fine, and editing something else never trips on this.
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['department_id' => $ops->id, 'team_id' => null])->assertOk();
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['phone' => '012'])->assertOk();
    }

    public function test_membership_changes_reject_inactive_groups_unknown_people_and_other_companies(): void
    {
        $inactive = $this->dept('Old', ['status' => 'inactive']);
        $sales = $this->dept('Sales');
        $a = $this->employee('Alice');
        $rivalEmployee = Employee::query()->create(['company_id' => $this->rival()[0]->id, 'name' => 'Spy']);

        $this->as($this->admin)->postJson("/api/departments/{$inactive->id}/members", ['employee_ids' => [$a]])->assertStatus(422);
        $this->as($this->admin)->postJson("/api/departments/{$sales->id}/members", ['employee_ids' => [$a, $rivalEmployee->id]])
            ->assertStatus(422)->assertJsonValidationErrors('employee_ids');
        // All-or-nothing: Alice wasn't moved by the failed request.
        $this->assertNull(Employee::query()->findOrFail($a)->currentAssignment->department_id);
    }

    public function test_only_people_who_manage_departments_or_teams_can_change_membership(): void
    {
        $sales = $this->dept('Sales');
        $field = $this->team('Field', $sales);
        $a = $this->employee('Alice');
        $employee = $this->createUserWithRole($this->company, 'employee');
        $manager = $this->createUserWithRole($this->company, 'manager');

        $this->as($employee)->postJson("/api/departments/{$sales->id}/members", ['employee_ids' => [$a]])->assertForbidden();
        $this->as($employee)->postJson("/api/teams/{$field->id}/members", ['employee_ids' => [$a]])->assertForbidden();
        // Managers manage teams but only view departments, by default.
        $this->as($manager)->postJson("/api/departments/{$sales->id}/members", ['employee_ids' => [$a]])->assertForbidden();
        $this->as($manager)->postJson("/api/teams/{$field->id}/members", ['employee_ids' => [$a]])->assertOk();
    }
}
