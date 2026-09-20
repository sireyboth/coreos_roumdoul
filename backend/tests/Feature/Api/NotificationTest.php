<?php

namespace Tests\Feature\Api;

use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_list_and_read_their_notifications(): void
    {
        $this->seed(PermissionSeeder::class);
        $company = app(CompanyProvisioner::class)->provision('Notif Co', 'Boss', 'boss@notif.test', 'password123');
        $admin = $company->users()->first();

        $this->actingAs($admin)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.data.title', 'Welcome to Business OS');

        $notificationId = $admin->notifications()->first()->id;

        $this->actingAs($admin)
            ->postJson("/api/notifications/{$notificationId}/read")
            ->assertNoContent();

        $this->assertNotNull($admin->notifications()->first()->fresh()->read_at);
    }
}
