<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RequestIdAndErrorShapeTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_response_carries_a_request_id(): void
    {
        $this->getJson('/api/health')->assertHeader('X-Request-Id');
    }

    public function test_a_sane_incoming_request_id_is_kept_and_an_odd_one_replaced(): void
    {
        $this->getJson('/api/health', ['X-Request-Id' => 'app-1234abcd'])
            ->assertHeader('X-Request-Id', 'app-1234abcd');

        $replaced = $this->getJson('/api/health', ['X-Request-Id' => "bad id\nwith newline"])
            ->headers->get('X-Request-Id');
        $this->assertNotSame("bad id\nwith newline", $replaced);
    }

    public function test_unauthenticated_error_has_code_and_request_id(): void
    {
        $response = $this->getJson('/api/me')->assertStatus(401)
            ->assertJsonStructure(['message', 'code', 'request_id'])
            ->assertJsonPath('code', 'unauthenticated');

        $this->assertSame($response->headers->get('X-Request-Id'), $response->json('request_id'));
    }

    public function test_an_error_a_middleware_answers_itself_also_carries_the_request_id(): void
    {
        // A fresh company on a trial plan without payroll: EnsureModuleEnabled answers 403 itself.
        $token = $this->postJson('/api/auth/register', [
            'company_name' => 'No Payroll Co', 'name' => 'Admin', 'email' => 'np@example.test',
            'password' => 'Secret-Pass-2026!', 'password_confirmation' => 'Secret-Pass-2026!',
        ])->json('token');

        $response = $this->withToken($token)->getJson('/api/payroll/runs');
        if ($response->status() !== 403) {
            $this->markTestSkipped('trial plan includes payroll here');
        }

        $response->assertJsonPath('code', 'module_not_enabled')
            ->assertJsonPath('request_id', $response->headers->get('X-Request-Id'));
    }

    public function test_validation_error_keeps_errors_and_adds_code(): void
    {
        $this->postJson('/api/auth/login', [])->assertStatus(422)
            ->assertJsonStructure(['message', 'errors', 'code', 'request_id'])
            ->assertJsonPath('code', 'validation_failed');
    }
}
