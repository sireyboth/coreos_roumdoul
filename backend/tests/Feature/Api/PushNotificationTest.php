<?php

namespace Tests\Feature\Api;

use App\Models\NotificationDelivery;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\CompanyProvisioner;
use App\Services\NotificationService;
use App\Services\Push\PushResult;
use App\Services\Push\PushSender;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/** Push notifications to a person's devices: turning it on/off, and what's sent. */
class PushNotificationTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private User $admin;

    private User $staff;

    private FakePushSender $sender;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $company = app(CompanyProvisioner::class)->provision('Push Co', 'Boss', 'boss@push.test', 'password123');
        $this->admin = $company->users()->first();
        $this->staff = $this->createUserWithRole($company, 'employee');

        config(['services.webpush.public_key' => 'test-public-key']);
        $this->sender = new FakePushSender;
        $this->app->instance(PushSender::class, $this->sender);
    }

    private function subscribe(User $user, string $endpoint = 'https://push.example.com/device-1')
    {
        return $this->actingAs($user)->postJson('/api/push/subscriptions', [
            'endpoint' => $endpoint,
            'keys' => ['p256dh' => 'device-public-key', 'auth' => 'device-auth'],
        ]);
    }

    public function test_the_browser_gets_the_public_key_only_when_push_is_set_up(): void
    {
        $this->actingAs($this->admin)->getJson('/api/push/key')->assertExactJson(['enabled' => true, 'public_key' => 'test-public-key']);

        $this->sender->enabled = false;
        $this->actingAs($this->admin)->getJson('/api/push/key')->assertExactJson(['enabled' => false, 'public_key' => null]);
    }

    public function test_a_shared_device_belongs_to_whoever_turned_it_on_last(): void
    {
        $this->subscribe($this->admin)->assertNoContent();
        $this->subscribe($this->staff)->assertNoContent();

        $device = PushSubscription::query()->sole();
        $this->assertSame($this->staff->id, $device->user_id);
    }

    public function test_only_https_push_endpoints_are_accepted(): void
    {
        $this->subscribe($this->admin, 'http://evil.example.com/x')->assertJsonValidationErrors('endpoint');
    }

    public function test_turning_off_only_removes_your_own_device(): void
    {
        $this->subscribe($this->admin);

        $this->actingAs($this->staff)->deleteJson('/api/push/subscriptions', ['endpoint' => 'https://push.example.com/device-1'])->assertNoContent();
        $this->assertSame(1, PushSubscription::query()->count());

        $this->actingAs($this->admin)->deleteJson('/api/push/subscriptions', ['endpoint' => 'https://push.example.com/device-1'])->assertNoContent();
        $this->assertSame(0, PushSubscription::query()->count());
    }

    public function test_an_alert_is_pushed_to_every_device_of_its_recipient(): void
    {
        $this->subscribe($this->admin, 'https://push.example.com/phone');
        $this->subscribe($this->admin, 'https://push.example.com/laptop');
        $this->subscribe($this->staff, 'https://push.example.com/someone-else');

        $alert = NotificationService::send($this->admin, 'attendance.correction_requested', 'Correction request from Dara', 'Mon 21 Sep: add 17:00', link: '/dashboard/attendance?tab=corrections');

        $this->assertCount(1, $this->sender->sent);
        [$devices, $payload] = $this->sender->sent[0];
        $this->assertEqualsCanonicalizing(['https://push.example.com/phone', 'https://push.example.com/laptop'], $devices);
        $this->assertSame('Correction request from Dara', $payload['title']);
        $this->assertSame('Mon 21 Sep: add 17:00', $payload['body']);
        $this->assertSame('/dashboard/attendance?tab=corrections', $payload['link']);
        $this->assertSame("notification-{$alert->id}", $payload['tag']);
        $this->assertGreaterThanOrEqual(1, $payload['unread']);

        $push = NotificationDelivery::query()->where('notification_id', $alert->id)->where('channel', 'webpush')->sole();
        $this->assertSame('delivered', $push->status);
        $this->assertNotNull(PushSubscription::query()->where('endpoint', 'https://push.example.com/phone')->value('last_used_at'));
    }

    public function test_a_device_that_is_gone_is_forgotten(): void
    {
        $this->subscribe($this->admin, 'https://push.example.com/uninstalled');
        $this->sender->result = 'expired';

        NotificationService::send($this->admin, 'test', 'Hello');

        $this->assertSame(0, PushSubscription::query()->count());
    }

    public function test_nothing_is_pushed_without_a_device_or_without_push_set_up(): void
    {
        NotificationService::send($this->admin, 'test', 'No device yet');
        $this->assertSame(0, NotificationDelivery::query()->where('channel', 'webpush')->count());

        $this->subscribe($this->admin);
        $this->sender->enabled = false;
        NotificationService::send($this->admin, 'test', 'Push not set up');

        $this->assertSame([], $this->sender->sent);
        $this->assertSame(0, NotificationDelivery::query()->where('channel', 'webpush')->count());
    }
}

class FakePushSender implements PushSender
{
    public bool $enabled = true;

    public string $result = 'sent';

    /** @var array<int, array{0: array<int, string>, 1: array<string, mixed>}> */
    public array $sent = [];

    public function enabled(): bool
    {
        return $this->enabled;
    }

    public function send(iterable $subscriptions, array $payload): array
    {
        $results = [];
        $endpoints = [];
        foreach ($subscriptions as $subscription) {
            $endpoints[] = $subscription->endpoint;
            $results[$subscription->id] = $this->result === 'expired' ? PushResult::expired('Gone') : PushResult::sent();
        }
        $this->sent[] = [$endpoints, $payload];

        return $results;
    }
}
