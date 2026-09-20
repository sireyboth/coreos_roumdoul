<?php

namespace Tests\Feature\Api;

use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\WorkLocation;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class AttendanceQrCheckInTest extends TestCase
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

    private function createBranch($admin, array $data): int
    {
        return $this->actingAs($admin)->postJson('/api/branches', $data)->assertCreated()->json('id');
    }

    /**
     * The branch has GPS on file (required at creation), but the employee's
     * own device doesn't send any — exactly what happens when their phone
     * can't get a signal indoors. The scan alone is still enough.
     */
    public function test_employee_can_check_in_by_scanning_a_branchs_qr_code_with_no_gps_of_their_own(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();
        $branchId = $this->createBranch($admin, [
            'name' => 'Indoor Branch',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->firstOrFail();

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Scanner', 'user_id' => $user->id]);

        $response = $this->actingAs($user)->postJson('/api/attendance/check-in', [
            'qr_token' => $workLocation->qr_token,
        ]);

        $response->assertCreated();
        $this->assertSame($workLocation->id, $response->json('work_location_id'));
    }

    public function test_unrecognized_qr_token_is_rejected(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $this->subscribeToGrowth($company->id);

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Scanner', 'user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/attendance/check-in', ['qr_token' => 'not-a-real-token'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('qr_token');
    }

    public function test_a_companys_qr_code_cannot_be_used_by_another_companys_employee(): void
    {
        $companyA = app(CompanyProvisioner::class)->provision('Gamma', 'Boss A', 'bossa@gamma.test', 'password123');
        $companyB = app(CompanyProvisioner::class)->provision('Delta', 'Boss B', 'bossb@delta.test', 'password123');
        $this->subscribeToGrowth($companyA->id);
        $this->subscribeToGrowth($companyB->id);

        $adminA = $companyA->users()->first();
        $branchAId = $this->createBranch($adminA, [
            'name' => 'Branch A',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $tokenA = WorkLocation::query()->where('branch_id', $branchAId)->value('qr_token');

        $userB = $this->createUserWithRole($companyB, 'employee');
        Employee::query()->create(['company_id' => $companyB->id, 'name' => 'Cross Co', 'user_id' => $userB->id]);

        $this->actingAs($userB)
            ->postJson('/api/attendance/check-in', ['qr_token' => $tokenA])
            ->assertStatus(422)
            ->assertJsonValidationErrors('qr_token');
    }

    public function test_gps_check_in_too_far_from_the_work_location_is_rejected(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();

        $branchId = $this->createBranch($admin, [
            'name' => 'HQ',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->firstOrFail();

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Far Away', 'user_id' => $user->id]);

        // Roughly 1km away — well outside the default 100m radius.
        $this->actingAs($user)
            ->postJson('/api/attendance/check-in', [
                'work_location_id' => $workLocation->id,
                'latitude' => 11.5654,
                'longitude' => 104.9282,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');
    }

    public function test_gps_check_in_within_radius_succeeds(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Zeta', 'Boss', 'boss@zeta.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();

        $branchId = $this->createBranch($admin, [
            'name' => 'HQ',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->firstOrFail();

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Nearby', 'user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/attendance/check-in', [
                'work_location_id' => $workLocation->id,
                'latitude' => 11.5564,
                'longitude' => 104.9283,
            ])
            ->assertCreated();
    }

    /**
     * Scanning the right QR code is not, by itself, a guarantee of
     * proximity — if the branch has GPS coordinates on file and the
     * device's location came along with the scan, being far away still
     * blocks the check-in, exactly like a plain GPS check-in would.
     */
    public function test_qr_scan_combined_with_gps_still_enforces_the_branchs_radius(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Eta', 'Boss', 'boss@eta.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();

        $branchId = $this->createBranch($admin, [
            'name' => 'HQ',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->firstOrFail();

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Far Scanner', 'user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson('/api/attendance/check-in', [
                'qr_token' => $workLocation->qr_token,
                'latitude' => 11.5654,
                'longitude' => 104.9282,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');
    }

    /**
     * The attendance list carries everything a reviewer needs to preview a
     * record: who, where, how it was verified and how far they were.
     */
    public function test_attendance_records_expose_location_method_and_distance_details(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Theta', 'Boss', 'boss@theta.test', 'password123');
        $this->subscribeToGrowth($company->id);
        $admin = $company->users()->first();

        $branchId = $this->createBranch($admin, [
            'name' => 'Riverside',
            'address' => '12 Sisowath Quay',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->firstOrFail();

        $user = $this->createUserWithRole($company, 'employee');
        $employee = Employee::query()->create(['company_id' => $company->id, 'name' => 'Reviewed', 'user_id' => $user->id]);
        $this->actingAs($admin)->putJson("/api/employees/{$employee->id}", ['branch_id' => $branchId])->assertOk();

        $this->actingAs($user)->postJson('/api/attendance/check-in', [
            'qr_token' => $workLocation->qr_token,
            'latitude' => 11.5564,
            'longitude' => 104.9283,
        ])->assertCreated();

        $record = $this->actingAs($admin)->getJson('/api/attendance')->assertOk()->json('data.0');

        $this->assertSame('Reviewed', $record['employee']['name']);
        $this->assertSame('Riverside', $record['employee']['branch']['name']);
        $this->assertSame('qr', $record['check_in_event']['method']);
        $this->assertSame('Riverside', $record['check_in_event']['work_location']['name']);
        $this->assertSame('12 Sisowath Quay', $record['check_in_event']['work_location']['address']);
        $this->assertLessThan(100, $record['check_in_event']['distance_meters']);
        $this->assertNull($record['check_out_event']);
    }

    public function test_a_check_in_with_no_qr_and_no_gps_is_recorded_as_unverified(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Lambda', 'Boss', 'boss@lambda.test', 'password123');
        $this->subscribeToGrowth($company->id);

        $user = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Bare', 'user_id' => $user->id]);

        $this->actingAs($user)->postJson('/api/attendance/check-in')
            ->assertCreated()
            ->assertJsonPath('method', 'none');
    }
}
