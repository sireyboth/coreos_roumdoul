<?php

namespace App\Services;

use App\Jobs\SendPushNotification;
use App\Models\Notification;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\Push\PushSender;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Replaces Laravel's built-in $user->notify(...) — inserts directly into the
 * notifications/notification_deliveries tables instead of going through a
 * Notification class per message type. Future channels (email, push,
 * Telegram) add a notification_deliveries row each without any schema or
 * call-site change. "in_app" is delivered immediately; "webpush" (phones and
 * computers, even with the app closed) is queued for people who turned it on.
 */
class NotificationService
{
    /**
     * @param  array<string, mixed>  $data  Extra structured payload beyond title/body (e.g. module_key, company_id).
     * @param  Model|null  $subject  what the alert is about, so all alerts about it can be resolved together
     * @param  string|null  $link  where clicking the alert goes (a dashboard path)
     * @param  string|null  $dedupeKey  one alert per key: sending the same event twice returns the first
     */
    public static function send(
        User $recipient,
        string $type,
        string $title,
        ?string $body = null,
        array $data = [],
        ?Model $subject = null,
        ?User $actor = null,
        ?string $link = null,
        ?string $dedupeKey = null,
    ): Notification {
        if ($dedupeKey && ($existing = Notification::query()->withoutGlobalScopes()->where('dedupe_key', $dedupeKey)->first())) {
            return $existing;
        }

        try {
            $notification = Notification::query()->create([
                'company_id' => $recipient->company_id,
                'recipient_user_id' => $recipient->id,
                'actor_user_id' => $actor?->id,
                'notification_type' => $type,
                'subject_type' => $subject?->getMorphClass(),
                'subject_id' => $subject?->getKey(),
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'link' => $link,
                'dedupe_key' => $dedupeKey,
                'created_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            // Two requests raced to send the same event; the other one won.
            return Notification::query()->withoutGlobalScopes()->where('dedupe_key', $dedupeKey)->firstOrFail();
        }

        $notification->deliveries()->create([
            'channel' => 'in_app',
            'status' => 'delivered',
            'attempts' => 1,
            'delivered_at' => now(),
        ]);

        // Also to their phone / computer, if they turned that on — sent from
        // the queue, and only once the alert itself is saved.
        if (app(PushSender::class)->enabled() && PushSubscription::query()->where('user_id', $recipient->id)->exists()) {
            $push = $notification->deliveries()->create(['channel' => 'webpush', 'status' => 'pending', 'attempts' => 0]);
            SendPushNotification::dispatch($push->id)->afterCommit();
        }

        return $notification;
    }

    /**
     * Marks every still-open $type alert about $subject as dealt with — e.g. once
     * one admin approves a request, the other admins see "Approved by …"
     * instead of a request waiting for them. Returns how many were resolved.
     */
    public static function resolve(Model $subject, string $type, string $resolution, ?User $by = null): int
    {
        return Notification::query()->withoutGlobalScopes()
            ->where('subject_type', $subject->getMorphClass())
            ->where('subject_id', $subject->getKey())
            ->where('notification_type', $type)
            ->whereNull('resolved_at')
            ->update([
                'resolved_at' => now(),
                'resolved_by_user_id' => $by?->id,
                'resolution' => $resolution,
            ]);
    }
}
