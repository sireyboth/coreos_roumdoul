<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceCorrection;
use App\Models\Branch;
use App\Models\CompanyModuleEntitlement;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Module;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Shift;
use App\Models\Subscription;
use App\Models\Team;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * These endpoints run on every page load, often over a slow connection to the
 * database, so how many queries they run matters more than how fast any one
 * of them is. Each test proves the count stays flat as the data grows —
 * "one more query per employee" is what made the lists slow.
 */
class QueryEfficiencyTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private $admin;

    private Shift $shift;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Fast Co', 'Boss', 'boss@fast.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $this->branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 1, 'longitude' => 1]);
        $this->shift = Shift::query()->create([
            'company_id' => $this->company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00', 'break_minutes' => 0, 'grace_minutes' => 0,
        ]);
    }

    private function addEmployees(int $count): void
    {
        $dept = Department::query()->firstOrCreate(['company_id' => $this->company->id, 'name' => 'Ops']);
        $team = Team::query()->firstOrCreate(['company_id' => $this->company->id, 'name' => 'Crew', 'department_id' => $dept->id]);

        for ($i = 0; $i < $count; $i++) {
            $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'E'.uniqid()]);
            app(\App\Services\EmployeeAssignmentService::class)->open($employee, [
                'branch_id' => $this->branch->id, 'department_id' => $dept->id, 'team_id' => $team->id, 'job_title' => 'Clerk',
            ]);
            Schedule::query()->create(['company_id' => $this->company->id, 'employee_id' => $employee->id, 'shift_id' => $this->shift->id, 'date' => '2026-09-22']);
            AttendanceCorrection::query()->create([
                'company_id' => $this->company->id, 'employee_id' => $employee->id, 'requested_by' => $this->admin->id,
                'date' => '2026-09-21', 'reason' => 'forgot', 'status' => 'pending',
            ]);
        }
    }

    private function queries(string $path): int
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson($path)->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    /** @return array<string, string> the endpoints that list people */
    private function listEndpoints(): array
    {
        return [
            'employees' => '/api/employees?per_page=200',
            'roster' => '/api/schedules?from=2026-09-01&to=2026-09-30&per_page=500',
            'corrections' => '/api/attendance/corrections',
            'departments' => '/api/departments?per_page=200',
            'teams' => '/api/teams?per_page=200',
        ];
    }

    public function test_lists_do_not_run_more_queries_when_there_are_more_people(): void
    {
        $this->addEmployees(3);
        $small = collect($this->listEndpoints())->map(fn ($path) => $this->queries($path))->all();

        $this->addEmployees(25);
        $large = collect($this->listEndpoints())->map(fn ($path) => $this->queries($path))->all();

        // "No more" rather than "identical": the first request of a test also pays a
        // couple of one-off setup queries, so the second set can even be lower.
        foreach ($small as $name => $count) {
            $this->assertLessThanOrEqual($count, $large[$name], "{$name} runs more queries as the data grows ({$count} -> {$large[$name]})");
        }
    }

    public function test_the_employee_list_and_roster_stay_within_a_small_fixed_budget(): void
    {
        $this->addEmployees(30);

        // Loose ceilings, well under the old ~2 queries per person; they catch a regression, not tune one.
        $this->assertLessThanOrEqual(20, $this->queries('/api/employees?per_page=200'));
        $this->assertLessThanOrEqual(20, $this->queries('/api/schedules?from=2026-09-01&to=2026-09-30&per_page=500'));
    }

    public function test_me_answers_the_same_module_questions_as_before_in_far_fewer_queries(): void
    {
        $modules = Module::query()->where('status', 'active')->get()->keyBy('code');

        // One module switched off even though the plan has it, one switched on although the plan lacks it,
        // and one whose override has expired (so the plan decides again).
        $planCodes = Plan::query()->where('code', 'growth')->firstOrFail()->modules()->pluck('code')->all();
        $inPlan = $modules->keys()->first(fn ($code) => in_array($code, $planCodes, true));
        $notInPlan = $modules->keys()->first(fn ($code) => ! in_array($code, $planCodes, true));
        $expiredOn = $modules->keys()->first(fn ($code) => $code !== $inPlan && $code !== $notInPlan && in_array($code, $planCodes, true));

        $override = fn (string $code, bool $enabled, array $extra = []) => CompanyModuleEntitlement::query()->create([
            'company_id' => $this->company->id, 'module_id' => $modules[$code]->id, 'is_enabled' => $enabled, 'source' => 'platform_override',
        ] + $extra);

        if ($inPlan) {
            $override($inPlan, false);
        }
        if ($notInPlan) {
            $override($notInPlan, true);
        }
        if ($expiredOn) {
            $override($expiredOn, false, ['ends_at' => now()->subDay()]);
        }

        $company = $this->company->fresh();
        $expected = $modules->mapWithKeys(fn ($m) => [$m->code => $company->hasModule($m->code)])->all();

        $this->assertSame($expected, $company->fresh()->moduleAccess());
        $this->assertNotEmpty(array_filter($expected), 'the scenario should leave some module on');
        $this->assertContains(false, $expected, 'the scenario should leave some module off');

        $this->app['auth']->forgetGuards();
        $response = $this->actingAs($this->admin)->getJson('/api/me')->assertOk();
        $this->assertSame($expected, $response->json('modules'));

        $this->assertLessThanOrEqual(20, $this->queries('/api/me'));
    }

    public function test_a_company_with_no_subscription_gets_every_module_off_unless_overridden(): void
    {
        $bare = app(CompanyProvisioner::class)->provision('Bare Co', 'Boss', 'boss@bare.test', 'password123');

        $access = $bare->moduleAccess();

        $this->assertNotEmpty($access);
        $this->assertSame([], array_filter($access));
        foreach ($access as $code => $enabled) {
            $this->assertSame($bare->hasModule($code), $enabled);
        }
    }
}
