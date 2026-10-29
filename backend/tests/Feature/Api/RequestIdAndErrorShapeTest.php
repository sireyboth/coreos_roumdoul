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

    public function test_validation_error_keeps_errors_and_adds_code(): void
    {
        $this->postJson('/api/auth/login', [])->assertStatus(422)
            ->assertJsonStructure(['message', 'errors', 'code', 'request_id'])
            ->assertJsonPath('code', 'validation_failed');
    }
}
