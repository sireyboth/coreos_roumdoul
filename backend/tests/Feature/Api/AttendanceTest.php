<?php

namespace Tests\Feature\Api;

use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
    }

    private function subscribeToGrowth(int $companyId): void
    {
        $growth = Plan::query()->where('code', 'growth')->firstOrFail();
        Subscription::query()->create(['company_id' => $companyId, 'plan_id' => $growth->id, 'status' => 'active']);
    }

    public function test_company_without_attendance_module_is_blocked(): void
    {
        $company = app(CompanyProvisioner::class)->provision('NoModule Co', 'Boss', 'boss@nomodule.test', 'password123');
        $admin = $company->users()->first();
        // Starter plan doesn't grant attendance either — but here we grant nothing at all.

        $this->actingAs($admin)
            ->postJson('/api/attendance/check-in', [])
            ->assertForbidden();
    }

    public function test_employee_can_check_in_and_out_and_worked_minutes_is_calculated(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();

        $user = $this->createUserWithRole($company, 'employee');
        $employee = Employee::query()->create(['company_id' => $company->id, 'name' => 'Worker', 'user_id' => $user->id]);

        $this->actingAs($user)->postJson('/api/attendance/check-in')->assertCreated();

        $this->travel(4)->hours();

        $this->actingAs($user)->postJson('/api/attendance/check-out')->assertCreated();

        $session = $employee->fresh();
        $response = $this->actingAs($admin)->getJson('/api/attendance');
        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('completed', $data[0]['status']);
        $this->assertEquals(240, $data[0]['worked_minutes']);
    }

    public function test_cannot_check_in_twice_or_check_out_without_checking_in(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $this->subscribeToGrowth($company->id);

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Worker', 'user_id' => $user->id]);

        $this->actingAs($user)->postJson('/api/attendance/check-out')->assertStatus(422);

        $this->actingAs($user)->postJson('/api/attendance/check-in')->assertCreated();
        $this->actingAs($user)->postJson('/api/attendance/check-in')->assertStatus(422);
    }

    public function test_employee_can_only_see_own_attendance(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $this->subscribeToGrowth($company->id);

        $userA = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'A', 'user_id' => $userA->id]);

        $userB = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'B', 'user_id' => $userB->id]);

        $this->actingAs($userA)->postJson('/api/attendance/check-in')->assertCreated();
        $this->actingAs($userB)->postJson('/api/attendance/check-in')->assertCreated();

        $response = $this->actingAs($userA)->getJson('/api/attendance');
        $names = collect($response->json('data'))->pluck('employee.name');
        $this->assertEquals(['A'], $names->all());
    }

    public function test_correction_request_and_approval_flow(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Forgetful', 'user_id' => $user->id]);

        $response = $this->actingAs($user)->postJson('/api/attendance/corrections', [
            'date' => '2026-09-15',
            'reason' => 'Forgot to check in',
            'requested_check_in' => '2026-09-15 08:00:00',
            'requested_check_out' => '2026-09-15 17:00:00',
        ]);
        $response->assertCreated();
        $correctionId = $response->json('id');

        // Employee cannot approve their own request.
        $this->actingAs($user)
            ->postJson("/api/attendance/corrections/{$correctionId}/approve")
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson("/api/attendance/corrections/{$correctionId}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'approved');

        $sessions = $this->actingAs($admin)->getJson('/api/attendance')->json('data');
        $this->assertCount(1, $sessions);
        $this->assertEquals('completed', $sessions[0]['status']);
        $this->assertEquals(540, $sessions[0]['worked_minutes']);
    }

    public function test_employee_cannot_request_correction_for_another_employee(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');
        $this->subscribeToGrowth($company->id);

        $userA = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'A', 'user_id' => $userA->id]);

        $otherEmployee = Employee::query()->create(['company_id' => $company->id, 'name' => 'B']);

        $this->actingAs($userA)->postJson('/api/attendance/corrections', [
            'employee_id' => $otherEmployee->id,
            'date' => '2026-09-15',
            'reason' => 'Not mine',
            'requested_check_in' => '2026-09-15 08:00:00',
        ])->assertForbidden();
    }
}
