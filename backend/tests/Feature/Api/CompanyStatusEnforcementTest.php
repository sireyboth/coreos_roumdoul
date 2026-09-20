<?php

namespace Tests\Feature\Api;

use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyStatusEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    public function test_suspended_companys_user_cannot_log_in(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $company->update(['status' => 'suspended']);

        $this->postJson('/api/auth/login', [
            'email' => 'boss@acme.test',
            'password' => 'password123',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_cancelled_companys_user_is_blocked_from_the_api_but_can_still_log_out(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Beta', 'Boss', 'boss@beta.test', 'password123');
        $admin = $company->users()->first();
        $token = $admin->createToken('api')->plainTextToken;

        $company->update(['status' => 'cancelled']);

        $headers = ['Authorization' => "Bearer {$token}"];

        $this->getJson('/api/branches', $headers)->assertForbidden();
        $this->getJson('/api/me', $headers)->assertOk();
        $this->postJson('/api/auth/logout', [], $headers)->assertOk();
    }

    public function test_active_and_trial_companies_are_unaffected(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Gamma', 'Boss', 'boss@gamma.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)->getJson('/api/branches')->assertOk();

        $company->update(['status' => 'active']);
        $this->actingAs($admin)->getJson('/api/branches')->assertOk();
    }

    public function test_expired_trial_blocks_login_and_the_api(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Delta', 'Boss', 'boss@delta.test', 'password123');
        $admin = $company->users()->first();
        $token = $admin->createToken('api')->plainTextToken;

        $company->update(['trial_ends_at' => now()->subDay()]);

        $this->postJson('/api/auth/login', [
            'email' => 'boss@delta.test',
            'password' => 'password123',
        ])->assertStatus(422)->assertJsonValidationErrors('email');

        $this->getJson('/api/branches', ['Authorization' => "Bearer {$token}"])->assertForbidden();
    }

    public function test_trial_with_a_future_end_date_is_unaffected(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Epsilon', 'Boss', 'boss@epsilon.test', 'password123');
        $admin = $company->users()->first();

        $company->update(['trial_ends_at' => now()->addDays(10)]);

        $this->actingAs($admin)->getJson('/api/branches')->assertOk();
    }
}
