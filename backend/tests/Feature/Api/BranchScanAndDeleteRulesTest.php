<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceSession;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Shift;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkLocation;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Employees can only scan in at their own branch, and deleting things must
 * never break live data or erase history.
 */
class BranchScanAndDeleteRulesTest extends TestCase
{
    use RefreshDatabase;

    private $company;

    private User $admin;

    private int $branchA;

    private int $branchB;

    private array $atA = ['latitude' => 11.5564, 'longitude' => 104.9282];

    private array $atB = ['latitude' => 11.6564, 'longitude' => 104.9282]; // ~11 km away

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Scan Co', 'Boss', 'boss@scanco.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();

        $this->branchA = $this->makeBranch('Branch A', $this->atA);
        $this->branchB = $this->makeBranch('Branch B', $this->atB);
    }

    private function makeBranch(string $name, array $gps): int
    {
        return $this->actingAs($this->admin)->postJson('/api/branches', ['name' => $name] + $gps)->assertCreated()->json('id');
    }

    /** An employee with a working login, assigned to the given branch. */
    private function makeEmployee(string $name, int $branchId): array
    {
        $employeeId = $this->actingAs($this->admin)->postJson('/api/employees', [
            'name' => $name,
            'email' => strtolower($name).'@scanco.test',
            'password' => 'password123',
            'branch_id' => $branchId,
        ])->assertCreated()->json('id');

        $employee = Employee::query()->findOrFail($employeeId);

        return [$employee, $employee->user];
    }

    private function qrOf(int $branchId): string
    {
        return WorkLocation::query()->where('branch_id', $branchId)->firstOrFail()->qr_token;
    }

    // ---- scanning only at your own branch ------------------------------------

    public function test_an_employee_can_scan_their_own_branchs_code_but_not_another_branchs(): void
    {
        [, $user] = $this->makeEmployee('Dara', $this->branchA);

        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $this->qrOf($this->branchB)])
            ->assertStatus(422)
            ->assertJsonPath('errors.qr_token.0', fn ($m) => str_contains($m, 'assigned to Branch A'));

        $this->assertSame(0, AttendanceSession::query()->count());

        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $this->qrOf($this->branchA)])->assertCreated();
    }

    public function test_a_gps_only_check_in_is_matched_to_the_employees_own_branch_not_the_nearest_one(): void
    {
        [, $user] = $this->makeEmployee('Sokha', $this->branchA);

        // Standing right inside Branch B — the nearest branch, but not hers.
        $this->actingAs($user)->postJson('/api/attendance/check-in', $this->atB)->assertStatus(422);

        $this->actingAs($user)->postJson('/api/attendance/check-in', $this->atA)
            ->assertCreated()
            ->assertJsonPath('work_location_id', WorkLocation::query()->where('branch_id', $this->branchA)->value('id'));
    }

    public function test_a_manager_can_schedule_someone_at_another_branch_for_a_day(): void
    {
        [$employee, $user] = $this->makeEmployee('Vanna', $this->branchA);
        $locationB = WorkLocation::query()->where('branch_id', $this->branchB)->firstOrFail();
        $shift = Shift::query()->create(['company_id' => $this->company->id, 'name' => 'Day', 'start_time' => '00:00', 'end_time' => '23:59']);

        Schedule::query()->create([
            'company_id' => $this->company->id,
            'employee_id' => $employee->id,
            'shift_id' => $shift->id,
            'work_location_id' => $locationB->id,
            'date' => now('Asia/Phnom_Penh')->toDateString(),
        ]);

        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $locationB->qr_token])->assertCreated();
    }

    public function test_a_company_wide_location_is_open_to_every_branch(): void
    {
        [, $user] = $this->makeEmployee('Chan', $this->branchA);
        $warehouse = WorkLocation::query()->create([
            'company_id' => $this->company->id, 'name' => 'Shared warehouse', 'branch_id' => null,
            'latitude' => 11.5, 'longitude' => 104.9, 'radius_meters' => 100,
        ]);

        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $warehouse->qr_token])->assertCreated();
    }

    // ---- deleting things safely -----------------------------------------------

    public function test_a_branch_with_employees_cannot_be_deleted_until_they_are_moved(): void
    {
        [$employee] = $this->makeEmployee('Rithy', $this->branchA);

        $this->actingAs($this->admin)->deleteJson("/api/branches/{$this->branchA}")
            ->assertStatus(422)
            ->assertJsonPath('code', 'in_use');

        $this->actingAs($this->admin)->putJson("/api/employees/{$employee->id}", ['branch_id' => $this->branchB])->assertOk();
        $qr = $this->qrOf($this->branchA);

        $this->actingAs($this->admin)->deleteJson("/api/branches/{$this->branchA}")->assertNoContent();

        // Its check-in code died with it.
        $this->assertSame(0, WorkLocation::query()->where('qr_token', $qr)->count());
    }

    public function test_a_branch_locations_own_check_in_point_cannot_be_deleted_directly(): void
    {
        $location = WorkLocation::query()->where('branch_id', $this->branchA)->firstOrFail();

        $this->actingAs($this->admin)->deleteJson("/api/work_locations/{$location->id}")
            ->assertStatus(422)
            ->assertJsonPath('code', 'in_use');

        $standalone = WorkLocation::query()->create(['company_id' => $this->company->id, 'name' => 'Pop-up', 'radius_meters' => 100]);
        $this->actingAs($this->admin)->deleteJson("/api/work_locations/{$standalone->id}")->assertNoContent();
    }

    public function test_a_shift_still_scheduled_ahead_cannot_be_deleted_but_a_past_only_one_can_and_history_survives(): void
    {
        [$employee] = $this->makeEmployee('Sreyneang', $this->branchA);
        $used = Shift::query()->create(['company_id' => $this->company->id, 'name' => 'Busy', 'start_time' => '08:00', 'end_time' => '17:00']);
        $old = Shift::query()->create(['company_id' => $this->company->id, 'name' => 'Retired', 'start_time' => '09:00', 'end_time' => '18:00']);

        Schedule::query()->create(['company_id' => $this->company->id, 'employee_id' => $employee->id, 'shift_id' => $used->id, 'date' => now()->addDays(3)->toDateString()]);
        Schedule::query()->create(['company_id' => $this->company->id, 'employee_id' => $employee->id, 'shift_id' => $old->id, 'date' => now()->subDays(5)->toDateString()]);

        $this->actingAs($this->admin)->deleteJson("/api/shifts/{$used->id}")->assertStatus(422)->assertJsonPath('code', 'in_use');
        $this->actingAs($this->admin)->deleteJson("/api/shifts/{$old->id}")->assertNoContent();

        // The old schedule still lists, with the deleted shift's name — no crash, no blank.
        $names = collect($this->actingAs($this->admin)->getJson('/api/schedules')->assertOk()->json('data'))->pluck('shift.name');
        $this->assertContains('Retired', $names->all());
    }

    public function test_removing_an_employee_kills_their_login_and_future_shifts_but_keeps_their_history(): void
    {
        [$employee, $user] = $this->makeEmployee('Bopha', $this->branchA);
        $shift = Shift::query()->create(['company_id' => $this->company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00']);
        Schedule::query()->create(['company_id' => $this->company->id, 'employee_id' => $employee->id, 'shift_id' => $shift->id, 'date' => now()->addDays(2)->toDateString()]);

        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $this->qrOf($this->branchA)])->assertCreated();
        $user->createToken('phone');

        $this->actingAs($this->admin)->deleteJson("/api/employees/{$employee->id}")->assertNoContent();

        $this->assertFalse($user->fresh()->is_active);
        $this->assertSame(0, $user->fresh()->tokens()->count());
        $this->assertSame(0, Schedule::query()->where('employee_id', $employee->id)->count());

        // Attendance history still names them.
        $names = collect($this->actingAs($this->admin)->getJson('/api/attendance')->assertOk()->json('data'))->pluck('employee.name');
        $this->assertContains('Bopha', $names->all());
    }

    public function test_a_standalone_locations_qr_code_can_be_regenerated_and_the_old_one_stops_working(): void
    {
        [, $user] = $this->makeEmployee('Kosal', $this->branchA);
        $warehouse = WorkLocation::query()->create([
            'company_id' => $this->company->id, 'name' => 'Warehouse', 'branch_id' => null,
            'latitude' => 11.5, 'longitude' => 104.9, 'radius_meters' => 100,
        ]);
        $old = $warehouse->qr_token;

        $new = $this->actingAs($this->admin)->postJson("/api/work_locations/{$warehouse->id}/regenerate-qr")
            ->assertOk()->json('qr_token');

        $this->assertNotSame($old, $new);
        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $old])->assertStatus(422);
        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $new])->assertCreated();
    }
}
