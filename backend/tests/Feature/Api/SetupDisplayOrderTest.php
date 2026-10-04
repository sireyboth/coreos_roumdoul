<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\CompanyRole;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkLocation;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/** The display order rule on everything a company sets up: lowest first, empty last, then by name. */
class SetupDisplayOrderTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private $company;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Setup Co', 'Boss', 'boss@setup.test', 'password123');
        $this->admin = $this->company->users()->first();
    }

    /** Names from a list endpoint, whether it's paginated or a plain array. */
    private function names(string $url): array
    {
        $json = $this->actingAs($this->admin)->getJson($url)->assertOk()->json();

        return array_column($json['data'] ?? $json, 'name');
    }

    public function test_setup_lists_put_the_lowest_number_first_and_unnumbered_last(): void
    {
        $id = ['company_id' => $this->company->id];
        foreach ([['Zeta', null], ['Alpha', null], ['Second', 2], ['First', 1]] as [$name, $order]) {
            $branch = Branch::query()->create([...$id, 'name' => "Branch $name", 'sort_order' => $order]);
            $department = Department::query()->create([...$id, 'name' => "Dept $name", 'sort_order' => $order]);
            Team::query()->create([...$id, 'name' => "Team $name", 'department_id' => $department->id, 'sort_order' => $order]);
            WorkLocation::query()->create([...$id, 'name' => "Site $name", 'sort_order' => $order]);
            $this->makeWorkSchedule($this->company, attributes: ['name' => "Shift $name", 'sort_order' => $order]);
        }

        $expected = fn (string $prefix) => ["$prefix First", "$prefix Second", "$prefix Alpha", "$prefix Zeta"];

        $this->assertSame($expected('Dept'), $this->names('/api/departments?per_page=50'));
        $this->assertSame($expected('Team'), $this->names('/api/teams?per_page=50'));
        $this->assertSame($expected('Shift'), $this->names('/api/work_schedules'));
        // Each branch also gets its own check-in location, so only ours are compared.
        $this->assertSame($expected('Branch'), array_values(array_filter($this->names('/api/branches'), fn ($n) => str_starts_with($n, 'Branch '))));
        $this->assertSame($expected('Site'), array_values(array_filter($this->names('/api/work_locations'), fn ($n) => str_starts_with($n, 'Site '))));
    }

    public function test_the_order_is_saved_from_the_forms_and_validated(): void
    {
        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 11.5, 'longitude' => 104.9]);

        $this->actingAs($this->admin)->putJson("/api/branches/{$branch->id}", ['sort_order' => 4])->assertOk();
        $this->assertSame(4, $branch->fresh()->sort_order);

        $this->actingAs($this->admin)->postJson('/api/departments', ['name' => 'Kitchen', 'sort_order' => 2])->assertCreated();
        $this->assertSame(2, Department::query()->where('name', 'Kitchen')->value('sort_order'));

        $this->actingAs($this->admin)->putJson("/api/branches/{$branch->id}", ['sort_order' => 'first'])->assertJsonValidationErrors('sort_order');
    }

    public function test_company_admin_can_be_ordered_but_stays_locked_otherwise(): void
    {
        $adminRole = CompanyRole::query()->where('company_id', $this->company->id)->where('code', 'company-admin')->firstOrFail();

        $this->actingAs($this->admin)->putJson("/api/roles/{$adminRole->id}", ['sort_order' => 1])->assertOk()->assertJsonPath('sort_order', 1);
        $this->actingAs($this->admin)->putJson("/api/roles/{$adminRole->id}", ['name' => 'Boss'])->assertJsonValidationErrors('role');

        $this->assertSame('company-admin', $this->names('/api/roles')[0]);
    }

    public function test_users_follow_their_employees_display_order(): void
    {
        $staff = $this->createUserWithRole($this->company, 'employee', ['name' => 'Anna Staff']);
        $manager = $this->createUserWithRole($this->company, 'manager', ['name' => 'Zed Manager']);
        Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Anna Staff', 'user_id' => $staff->id, 'sort_order' => 5]);
        Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Zed Manager', 'user_id' => $manager->id, 'sort_order' => 1]);

        // The owner has no employee record, so comes after the numbered people.
        $this->assertSame(['Zed Manager', 'Anna Staff', 'Boss'], $this->names('/api/users'));
    }
}
