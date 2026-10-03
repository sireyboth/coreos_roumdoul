<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\PushSubscription;
use App\Services\Push\PushResult;
use App\Services\Push\PushSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Pushes one alert to every device its recipient turned notifications on
 * for. Runs on the queue so a slow push service never slows a request down.
 * Devices that are gone are forgotten; if every device failed for a
 * temporary reason, the job is retried.
 */
class SendPushNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var array<int, int> seconds between tries */
    public array $backoff = [30, 120];

    public function __construct(public readonly int $deliveryId) {}

    public function handle(PushSender $sender): void
    {
        $delivery = NotificationDelivery::query()->find($this->deliveryId);
        $notification = $delivery ? Notification::query()->withoutGlobalScopes()->find($delivery->notification_id) : null;

        if (! $delivery || ! $notification || $delivery->status === 'delivered') {
            return;
        }

        $devices = PushSubscription::query()->where('user_id', $notification->recipient_user_id)->get();

        if ($devices->isEmpty() || ! $sender->enabled()) {
            $delivery->update(['status' => 'skipped', 'attempts' => $delivery->attempts + 1]);

            return;
        }

        // Already read in the app by the time this runs (e.g. a retry hours later): don't buzz the phone.
        if ($notification->read_at !== null) {
            $delivery->update(['status' => 'skipped', 'attempts' => $delivery->attempts + 1]);

            return;
        }

        $results = $sender->send($devices, $this->payload($notification));

        $sent = collect($results)->filter(fn (PushResult $r) => $r->status === 'sent')->keys();
        $expired = collect($results)->filter(fn (PushResult $r) => $r->status === 'expired')->keys();

        PushSubscription::query()->whereIn('id', $expired)->delete();
        PushSubscription::query()->whereIn('id', $sent)->update(['last_used_at' => now()]);

        $retryable = collect($results)->contains(fn (PushResult $r) => $r->status === 'failed');

        $delivery->update([
            'status' => $sent->isNotEmpty() ? 'delivered' : ($retryable ? 'failed' : 'skipped'),
            'attempts' => $delivery->attempts + 1,
            'delivered_at' => $sent->isNotEmpty() ? now() : null,
        ]);

        if ($sent->isEmpty() && $retryable && $this->attempts() < $this->tries) {
            $this->release($this->backoff[$this->attempts() - 1] ?? 120);
        }
    }

    /** What the service worker gets: enough to show the alert and open it, plus the unread count for the app badge. */
    private function payload(Notification $notification): array
    {
        return [
            'id' => $notification->id,
            'title' => $notification->title,
            'body' => $notification->body,
            'link' => $notification->link,
            'tag' => "notification-{$notification->id}",
            'unread' => Notification::query()->withoutGlobalScopes()
                ->where('recipient_user_id', $notification->recipient_user_id)
                ->whereNull('read_at')
                ->count(),
        ];
    }
}
