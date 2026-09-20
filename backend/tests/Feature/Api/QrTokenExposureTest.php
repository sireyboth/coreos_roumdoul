<?php

namespace Tests\Feature\Api;

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
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * The QR code is what proves an employee is physically at a branch. Anyone
 * who can read its token can "scan" it from home, so it must only ever reach
 * the people who print it — never leak through an employee, schedule or
 * attendance response that merely nests the branch or location.
 */
class QrTokenExposureTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $admin;

    private User $employeeUser;

    private User $manager;

    private string $token;

    private int $branchId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $company = app(CompanyProvisioner::class)->provision('Secure Co', 'Boss', 'boss@secure.test', 'password123');
        Subscription::query()->create([
            'company_id' => $company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $company->users()->first();

        $branch = $this->as($this->admin)->postJson('/api/branches', ['name' => 'HQ', 'latitude' => 11.55, 'longitude' => 104.92])
            ->assertCreated()->json();
        $this->branchId = $branch['id'];
        $this->token = WorkLocation::query()->where('branch_id', $this->branchId)->firstOrFail()->qr_token;

        $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Staff', 'email' => 'staff@secure.test', 'password' => 'password123', 'branch_id' => $this->branchId,
        ])->assertCreated();
        $this->employeeUser = User::query()->where('email', 'staff@secure.test')->firstOrFail();
        $this->manager = $this->createUserWithRole($company, 'manager');

        // Give the employee a schedule at the branch and a real QR check-in,
        // so schedules and attendance responses have a location to nest.
        $employee = Employee::query()->where('user_id', $this->employeeUser->id)->firstOrFail();
        $shift = Shift::query()->create([
            'company_id' => $company->id, 'name' => 'Day', 'start_time' => '00:00', 'end_time' => '23:59', 'break_minutes' => 0, 'grace_minutes' => 0,
        ]);
        Schedule::query()->create([
            'company_id' => $company->id, 'employee_id' => $employee->id, 'shift_id' => $shift->id,
            'work_location_id' => WorkLocation::query()->where('branch_id', $this->branchId)->value('id'), 'date' => now()->toDateString(),
        ]);
        $this->as($this->employeeUser)->postJson('/api/attendance/check-in', ['qr_token' => $this->token])->assertCreated();
    }

    private function as($user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function leaks(User $user, string $path): bool
    {
        return str_contains($this->as($user)->getJson($path)->getContent(), $this->token);
    }

    public function test_an_employee_can_never_read_the_token_from_any_response(): void
    {
        foreach (['/api/me', '/api/employees', '/api/schedules', '/api/attendance', '/api/calendar?month='.now()->format('Y-m'),
            '/api/branches', '/api/work_locations', '/api/departments'] as $path) {
            $this->assertFalse($this->leaks($this->employeeUser, $path), "employee can read the QR token from {$path}");
        }
    }

    public function test_managers_who_only_view_branches_do_not_get_the_token_either(): void
    {
        foreach (['/api/branches', '/api/work_locations', '/api/employees', '/api/schedules', '/api/attendance'] as $path) {
            $this->assertFalse($this->leaks($this->manager, $path), "a view-only manager can read the QR token from {$path}");
        }
    }

    public function test_people_who_manage_branches_and_locations_still_get_it_for_printing(): void
    {
        $branches = $this->as($this->admin)->getJson('/api/branches')->assertOk()->json('data');
        $this->assertSame($this->token, collect($branches)->firstWhere('id', $this->branchId)['qr_token']);

        $locations = $this->as($this->admin)->getJson('/api/work_locations')->assertOk()->json('data');
        $this->assertContains($this->token, collect($locations)->pluck('qr_token')->all());

        $this->as($this->admin)->getJson("/api/branches/{$this->branchId}")->assertOk()->assertJsonPath('qr_token', $this->token);

        // Regenerating hands the manager the new code, and the old one dies.
        $new = $this->as($this->admin)->postJson("/api/branches/{$this->branchId}/regenerate-qr")->assertOk()->json('qr_token');
        $this->assertNotNull($new);
        $this->assertNotSame($this->token, $new);
    }
}
