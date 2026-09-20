<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_their_name_and_email(): void
    {
        $user = User::factory()->create(['name' => 'Old Name']);

        $this->actingAs($user)
            ->putJson('/api/profile', ['name' => 'New Name', 'email' => $user->email])
            ->assertOk()
            ->assertJsonFragment(['name' => 'New Name']);

        $this->assertSame('New Name', $user->fresh()->name);
    }

    public function test_user_can_change_password_with_correct_current_password(): void
    {
        $user = User::factory()->create(['password' => 'old-password-123']);

        $this->actingAs($user)
            ->putJson('/api/profile/password', [
                'current_password' => 'old-password-123',
                'password' => 'new-password-456',
                'password_confirmation' => 'new-password-456',
            ])
            ->assertOk();

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('new-password-456', $user->fresh()->password));
    }

    public function test_password_change_rejected_with_wrong_current_password(): void
    {
        $user = User::factory()->create(['password' => 'old-password-123']);

        $this->actingAs($user)
            ->putJson('/api/profile/password', [
                'current_password' => 'wrong-password',
                'password' => 'new-password-456',
                'password_confirmation' => 'new-password-456',
            ])
            ->assertStatus(422);
    }
}
