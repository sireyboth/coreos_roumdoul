<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkLocation;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/**
 * Employees can only scan in at their own branch, and deleting things must
 * never break live data or erase history.
 */
class BranchScanAndDeleteRulesTest extends TestCase
{
    use CreatesWorkSchedules, RefreshDatabase;

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

        $this->assertSame(0, AttendanceEvent::query()->count());

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
        $allDay = $this->makeWorkSchedule($this->company, [['in', '00:00'], ['out', '23:59']]);

        // A roster override for today, at Branch B's check-in point.
        $this->overrideOn($employee, $allDay, now('Asia/Phnom_Penh')->toDateString(), $locationB->id);

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

    public function test_a_work_schedule_still_used_ahead_cannot_be_deleted_but_a_past_only_one_can_and_history_survives(): void
    {
        [$employee] = $this->makeEmployee('Sreyneang', $this->branchA);
        $used = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Busy']);
        $old = $this->makeWorkSchedule($this->company, [['in', '09:00'], ['out', '18:00']], ['name' => 'Retired']);

        $this->overrideOn($employee, $used, now()->addDays(3)->toDateString());
        $this->overrideOn($employee, $old, now()->subDays(5)->toDateString());

        $this->actingAs($this->admin)->deleteJson("/api/work_schedules/{$used->id}")->assertStatus(422)->assertJsonPath('code', 'in_use');
        $this->actingAs($this->admin)->deleteJson("/api/work_schedules/{$old->id}")->assertNoContent();

        // The old roster entry still lists, with the deleted schedule's name — no crash, no blank.
        $names = collect($this->actingAs($this->admin)->getJson('/api/schedules')->assertOk()->json('data'))->pluck('work_schedule.name');
        $this->assertContains('Retired', $names->all());
    }

    public function test_a_work_schedule_someone_is_assigned_to_cannot_be_deleted(): void
    {
        [$employee] = $this->makeEmployee('Pisey', $this->branchA);
        $schedule = $this->makeWorkSchedule($this->company);
        $this->assignSchedule($employee, $schedule);

        $this->actingAs($this->admin)->deleteJson("/api/work_schedules/{$schedule->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', '1 person is assigned to it. Move them to another schedule first, or set this one to inactive.');
    }

    public function test_deleting_an_employee_removes_them_their_login_and_everything_they_had(): void
    {
        [$employee, $user] = $this->makeEmployee('Bopha', $this->branchA);
        $schedule = $this->makeWorkSchedule($this->company);
        $this->overrideOn($employee, $schedule, now()->addDays(2)->toDateString());
        $this->assignSchedule($employee, $schedule);

        $this->actingAs($user)->postJson('/api/attendance/check-in', ['qr_token' => $this->qrOf($this->branchA)])->assertCreated();
        $user->createToken('phone');

        $this->actingAs($this->admin)->deleteJson("/api/employees/{$employee->id}")->assertNoContent();

        $this->assertDatabaseMissing('employees', ['id' => $employee->id]);
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
        $this->assertSame(0, Schedule::query()->where('employee_id', $employee->id)->count());
        $this->assertSame(0, EmployeeScheduleAssignment::query()->where('employee_id', $employee->id)->count());
        $this->assertSame(0, AttendanceEvent::query()->where('employee_id', $employee->id)->count());
    }

    public function test_a_deleted_employees_id_and_email_can_be_used_again(): void
    {
        $create = fn () => $this->actingAs($this->admin)->postJson('/api/employees', [
            'name' => 'Sophea',
            'employee_code' => 'EMP-7',
            'email' => 'sophea@scanco.test',
            'password' => 'password123',
            'branch_id' => $this->branchA,
        ]);

        $id = $create()->assertCreated()->json('id');
        $this->actingAs($this->admin)->deleteJson("/api/employees/{$id}")->assertNoContent();

        $create()->assertCreated();
    }

    public function test_employees_can_be_deleted_in_bulk(): void
    {
        [$a] = $this->makeEmployee('Vanna', $this->branchA);
        [$b] = $this->makeEmployee('Rithy', $this->branchB);
        [$keep] = $this->makeEmployee('Chenda', $this->branchA);

        $this->actingAs($this->admin)->postJson('/api/employees/bulk-delete', ['ids' => [$a->id, $b->id]])
            ->assertOk()
            ->assertJsonPath('deleted', 2);

        $this->assertSame([$keep->id], Employee::query()->withoutGlobalScopes()->pluck('id')->all());
    }

    public function test_a_bulk_delete_with_an_unknown_id_deletes_nothing(): void
    {
        [$a] = $this->makeEmployee('Vanna', $this->branchA);

        $this->actingAs($this->admin)->postJson('/api/employees/bulk-delete', ['ids' => [$a->id, 999999]])
            ->assertStatus(422)
            ->assertJsonValidationErrors('ids');

        $this->assertDatabaseHas('employees', ['id' => $a->id]);
    }

    public function test_you_cannot_delete_your_own_employee_record(): void
    {
        $own = Employee::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id,
            'user_id' => $this->admin->id,
            'name' => 'Boss',
        ]);

        $this->actingAs($this->admin)->deleteJson("/api/employees/{$own->id}")->assertStatus(422);
        $this->actingAs($this->admin)->postJson('/api/employees/bulk-delete', ['ids' => [$own->id]])->assertStatus(422);

        $this->assertDatabaseHas('employees', ['id' => $own->id]);
        $this->assertDatabaseHas('users', ['id' => $this->admin->id]);
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
