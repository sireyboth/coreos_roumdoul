<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * Replaces Laravel's built-in $user->notify(...) — inserts directly into the
 * notifications/notification_deliveries tables instead of going through a
 * Notification class per message type. Future channels (email, push,
 * Telegram) add a notification_deliveries row each without any schema or
 * call-site change; today only "in_app" is delivered, immediately.
 */
class NotificationService
{
    /**
     * @param  array<string, mixed>  $data  Extra structured payload beyond title/body (e.g. module_key, company_id).
     */
    public static function send(User $recipient, string $type, string $title, ?string $body = null, array $data = []): Notification
    {
        $notification = Notification::query()->create([
            'company_id' => $recipient->company_id,
            'recipient_user_id' => $recipient->id,
            'notification_type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'created_at' => now(),
        ]);

        $notification->deliveries()->create([
            'channel' => 'in_app',
            'status' => 'delivered',
            'attempts' => 1,
            'delivered_at' => now(),
        ]);

        return $notification;
    }
}
