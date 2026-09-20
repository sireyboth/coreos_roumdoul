<?php

namespace Tests\Feature\Api;

use App\Models\WorkLocation;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchWorkLocationSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    /**
     * The database column is branch_code (per the Stage 1 spec), but the
     * API still speaks "code" so the existing frontend needs no changes.
     */
    public function test_branch_code_is_stored_as_branch_code_but_exposed_as_code(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $response = $this->actingAs($admin)->postJson('/api/branches', [
            'name' => 'Head Office',
            'code' => 'HQ-01',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);

        $response->assertCreated()->assertJsonPath('code', 'HQ-01');

        $branch = \App\Models\Branch::query()->where('name', 'Head Office')->firstOrFail();
        $this->assertSame('HQ-01', $branch->getAttributes()['branch_code']);
    }

    public function test_creating_a_branch_with_coordinates_creates_a_matching_work_location(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $admin = $company->users()->first();

        $response = $this->actingAs($admin)->postJson('/api/branches', [
            'name' => 'Head Office',
            'address' => '123 Main St',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);

        $response->assertCreated();
        $branchId = $response->json('id');

        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->first();
        $this->assertNotNull($workLocation);
        $this->assertSame('Head Office', $workLocation->name);
        $this->assertSame(100, $workLocation->radius_meters);
    }

    /**
     * GPS is required at creation so a branch can always be checked as
     * "too far" whenever an employee's phone happens to get a GPS reading —
     * an admin can no longer accidentally skip setting it.
     */
    public function test_branch_creation_requires_coordinates(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)
            ->postJson('/api/branches', ['name' => 'No GPS Branch'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['latitude', 'longitude']);
    }

    /**
     * A branch gets a WorkLocation carrying its QR code the moment it's
     * created — that's what actually gets scanned, regardless of whether
     * the employee's own phone can get a GPS reading at check-in time.
     */
    public function test_branch_creation_issues_a_qr_code(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Iota', 'Boss', 'boss@iota.test', 'password123');
        $admin = $company->users()->first();

        $response = $this->actingAs($admin)->postJson('/api/branches', [
            'name' => 'Indoor Branch',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ]);
        $response->assertCreated();
        $this->assertNotNull($response->json('qr_token'));

        $workLocation = WorkLocation::query()->where('branch_id', $response->json('id'))->first();
        $this->assertNotNull($workLocation);
        $this->assertNotNull($workLocation->qr_token);
    }

    public function test_a_branchs_coordinates_cannot_be_cleared_once_set(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Kappa', 'Boss', 'boss@kappa.test', 'password123');
        $admin = $company->users()->first();

        $branchId = $this->actingAs($admin)->postJson('/api/branches', [
            'name' => 'Branch A',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
        ])->json('id');

        $this->actingAs($admin)
            ->putJson("/api/branches/{$branchId}", ['latitude' => null])
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');
    }

    public function test_updating_a_branchs_coordinates_updates_its_work_location_without_duplicating(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();

        $branchId = $this->actingAs($admin)->postJson('/api/branches', [
            'name' => 'Branch A',
            'latitude' => 11.0,
            'longitude' => 104.0,
        ])->json('id');

        $this->actingAs($admin)->putJson("/api/branches/{$branchId}", [
            'name' => 'Branch A Renamed',
            'latitude' => 12.0,
            'longitude' => 105.0,
        ])->assertOk();

        $this->assertSame(1, WorkLocation::query()->where('branch_id', $branchId)->count());
        $workLocation = WorkLocation::query()->where('branch_id', $branchId)->first();
        $this->assertSame('Branch A Renamed', $workLocation->name);
        $this->assertEquals(12.0, (float) $workLocation->latitude);
    }
}
