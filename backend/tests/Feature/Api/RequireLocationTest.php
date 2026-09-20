<?php

namespace Tests\Feature\Api;

use App\Models\Employee;
use App\Models\Plan;
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
 * A printed QR can be photographed and scanned from home. A branch that turns
 * "require location" on only accepts a scan the phone backs with a position
 * inside the radius.
 */
class RequireLocationTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private const HERE = ['latitude' => 11.5564, 'longitude' => 104.9282];

    private const FAR_AWAY = ['latitude' => 11.6500, 'longitude' => 105.0500];

    private $admin;

    private User $staff;

    private int $branchId;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $company = app(CompanyProvisioner::class)->provision('Loc Co', 'Boss', 'boss@loc.test', 'password123');
        Subscription::query()->create([
            'company_id' => $company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $company->users()->first();
        $this->staff = $this->createUserWithRole($company, 'employee');
        Employee::query()->create(['company_id' => $company->id, 'name' => 'Staff', 'user_id' => $this->staff->id]);
    }

    private function as($user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function branch(bool $require): void
    {
        $this->branchId = $this->as($this->admin)->postJson('/api/branches', [
            'name' => 'HQ', ...self::HERE, 'require_location' => $require,
        ])->assertCreated()->json('id');
        $this->token = WorkLocation::query()->where('branch_id', $this->branchId)->firstOrFail()->qr_token;
    }

    public function test_by_default_a_qr_scan_alone_is_still_enough(): void
    {
        $this->branch(false);

        $this->as($this->staff)->postJson('/api/attendance/check-in', ['qr_token' => $this->token])->assertCreated();
    }

    public function test_when_required_a_scan_without_location_is_rejected_with_a_code_the_app_can_act_on(): void
    {
        $this->branch(true);

        $this->as($this->staff)->postJson('/api/attendance/check-in', ['qr_token' => $this->token])
            ->assertStatus(422)
            ->assertJsonPath('code', 'location_required')
            ->assertJsonValidationErrors('latitude');

        $this->assertSame(0, \App\Models\AttendanceEvent::query()->count());
    }

    public function test_when_required_a_scan_from_inside_the_radius_works_and_from_outside_does_not(): void
    {
        $this->branch(true);

        $this->as($this->staff)->postJson('/api/attendance/check-in', ['qr_token' => $this->token] + self::FAR_AWAY)
            ->assertStatus(422)->assertJsonValidationErrors('latitude');

        $this->as($this->staff)->postJson('/api/attendance/check-in', ['qr_token' => $this->token] + self::HERE)
            ->assertCreated()->assertJsonPath('method', 'qr');
    }

    public function test_the_rule_applies_when_checking_out_too(): void
    {
        $this->branch(true);
        $this->as($this->staff)->postJson('/api/attendance/check-in', ['qr_token' => $this->token] + self::HERE)->assertCreated();

        $this->as($this->staff)->postJson('/api/attendance/check-out', ['qr_token' => $this->token])
            ->assertStatus(422)->assertJsonPath('code', 'location_required');

        $this->as($this->staff)->postJson('/api/attendance/check-out', ['qr_token' => $this->token] + self::HERE)->assertCreated();
    }

    public function test_the_setting_can_be_switched_on_and_off_and_an_unrelated_edit_never_changes_it(): void
    {
        $this->branch(false);

        $this->as($this->admin)->putJson("/api/branches/{$this->branchId}", ['require_location' => true])
            ->assertOk()->assertJsonPath('require_location', true);
        $this->assertTrue(WorkLocation::query()->where('branch_id', $this->branchId)->firstOrFail()->require_location);

        // Renaming the branch says nothing about location, so it must stay on.
        $this->as($this->admin)->putJson("/api/branches/{$this->branchId}", ['name' => 'Head Office'])
            ->assertOk()->assertJsonPath('require_location', true);

        $listed = collect($this->as($this->admin)->getJson('/api/branches')->json('data'))->firstWhere('id', $this->branchId);
        $this->assertTrue($listed['require_location']);

        $this->as($this->admin)->putJson("/api/branches/{$this->branchId}", ['require_location' => false])
            ->assertOk()->assertJsonPath('require_location', false);
    }

    public function test_a_location_without_coordinates_cannot_require_location(): void
    {
        $this->as($this->admin)->postJson('/api/work_locations', ['name' => 'Pop-up', 'require_location' => true])
            ->assertStatus(422)->assertJsonValidationErrors('require_location');

        $id = $this->as($this->admin)->postJson('/api/work_locations', ['name' => 'Pop-up', ...self::HERE, 'require_location' => true])
            ->assertCreated()->assertJsonPath('require_location', true)->json('id');

        // Taking the coordinates away while it still requires location is refused too.
        $this->as($this->admin)->putJson("/api/work_locations/{$id}", ['latitude' => null, 'longitude' => null])
            ->assertStatus(422)->assertJsonValidationErrors('require_location');
    }

    public function test_gps_only_check_in_is_unchanged(): void
    {
        $this->branch(true);

        $this->as($this->staff)->postJson('/api/attendance/check-in', self::HERE)->assertCreated()->assertJsonPath('method', 'gps');
    }
}
