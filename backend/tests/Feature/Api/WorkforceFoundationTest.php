<?php

namespace Tests\Feature\Api;

use App\Models\Employee;
use App\Models\Shift;
use App\Models\WorkLocation;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class WorkforceFoundationTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    public function test_company_admin_can_create_a_work_location_and_a_shift(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)
            ->postJson('/api/work_locations', ['name' => 'Head Office', 'radius_meters' => 150])
            ->assertCreated();

        $this->actingAs($admin)
            ->postJson('/api/shifts', [
                'name' => 'Morning Shift',
                'start_time' => '08:00',
                'end_time' => '17:00',
                'break_minutes' => 60,
            ])
            ->assertCreated()
            ->assertJsonFragment(['name' => 'Morning Shift']);
    }

    public function test_admin_can_create_holiday_and_roster_an_employee(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)
            ->postJson('/api/holidays', ['name' => 'Pchum Ben', 'date' => '2026-10-01', 'is_recurring_yearly' => true])
            ->assertCreated();

        $shift = Shift::query()->create([
            'company_id' => $company->id,
            'name' => 'Day Shift',
            'start_time' => '08:00',
            'end_time' => '17:00',
        ]);

        $employee = Employee::query()->create(['company_id' => $company->id, 'name' => 'Worker One']);

        $response = $this->actingAs($admin)->postJson('/api/schedules', [
            'employee_id' => $employee->id,
            'shift_id' => $shift->id,
            'date' => '2026-09-20',
        ]);

        $response->assertCreated()->assertJsonPath('employee.name', 'Worker One');
    }

    public function test_cannot_double_book_the_same_employee_on_the_same_date(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();

        $shift = Shift::query()->create([
            'company_id' => $company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00',
        ]);
        $employee = Employee::query()->create(['company_id' => $company->id, 'name' => 'Worker Two']);

        $this->actingAs($admin)->postJson('/api/schedules', [
            'employee_id' => $employee->id, 'shift_id' => $shift->id, 'date' => '2026-09-21',
        ])->assertCreated();

        $this->actingAs($admin)->postJson('/api/schedules', [
            'employee_id' => $employee->id, 'shift_id' => $shift->id, 'date' => '2026-09-21',
        ])->assertStatus(422);
    }

    public function test_employee_can_only_see_their_own_schedule(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();

        $employeeUser = $this->createUserWithRole($company, 'employee');

        $shift = Shift::query()->create([
            'company_id' => $company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00',
        ]);

        $ownEmployeeRecord = Employee::query()->create([
            'company_id' => $company->id, 'name' => 'Me', 'user_id' => $employeeUser->id,
        ]);
        $otherEmployeeRecord = Employee::query()->create(['company_id' => $company->id, 'name' => 'Someone Else']);

        $this->actingAs($admin)->postJson('/api/schedules', [
            'employee_id' => $ownEmployeeRecord->id, 'shift_id' => $shift->id, 'date' => '2026-09-22',
        ])->assertCreated();

        $this->actingAs($admin)->postJson('/api/schedules', [
            'employee_id' => $otherEmployeeRecord->id, 'shift_id' => $shift->id, 'date' => '2026-09-22',
        ])->assertCreated();

        $response = $this->actingAs($employeeUser)->getJson('/api/schedules');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('employee.name');
        $this->assertEquals(['Me'], $names->all());
    }

    public function test_employee_role_cannot_manage_work_locations(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');

        $employee = $this->createUserWithRole($company, 'employee');

        $this->actingAs($employee)
            ->postJson('/api/work_locations', ['name' => 'Should fail'])
            ->assertForbidden();
    }

    public function test_tenant_isolation_on_work_locations(): void
    {
        $companyA = app(CompanyProvisioner::class)->provision('Zeta', 'Boss A', 'bossa@zeta.test', 'password123');
        $companyB = app(CompanyProvisioner::class)->provision('Eta', 'Boss B', 'bossb@eta.test', 'password123');
        $adminA = $companyA->users()->first();

        $locationB = WorkLocation::query()->create(['company_id' => $companyB->id, 'name' => 'B HQ']);

        $this->actingAs($adminA)
            ->getJson("/api/work_locations/{$locationB->id}")
            ->assertNotFound();
    }
}
