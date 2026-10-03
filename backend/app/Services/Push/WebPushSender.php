<?php

namespace App\Services\Push;

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Web Push through minishlink/web-push, signed with the VAPID keys in
 * config('services.webpush'). Messages are end-to-end encrypted to each
 * device, so the push services (Google, Apple, Mozilla) can't read them.
 */
class WebPushSender implements PushSender
{
    public function enabled(): bool
    {
        return class_exists(WebPush::class)
            && filled(config('services.webpush.public_key'))
            && filled(config('services.webpush.private_key'));
    }

    public function send(iterable $subscriptions, array $payload): array
    {
        if (! $this->enabled()) {
            return [];
        }

        $webPush = new WebPush(['VAPID' => [
            'subject' => config('services.webpush.subject'),
            'publicKey' => config('services.webpush.public_key'),
            'privateKey' => config('services.webpush.private_key'),
        ]], [
            // An alert a day old is no longer worth waking a phone for.
            'TTL' => 86400,
            'urgency' => 'high',
        ]);

        $byEndpoint = [];
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE);

        foreach ($subscriptions as $subscription) {
            $byEndpoint[$subscription->endpoint] = $subscription->id;
            $webPush->queueNotification(Subscription::create([
                'endpoint' => $subscription->endpoint,
                'publicKey' => $subscription->public_key,
                'authToken' => $subscription->auth_token,
                'contentEncoding' => $subscription->content_encoding,
            ]), $body);
        }

        $results = [];
        foreach ($webPush->flush() as $report) {
            $id = $byEndpoint[$report->getEndpoint()] ?? null;
            if ($id === null) {
                continue;
            }

            $results[$id] = match (true) {
                $report->isSuccess() => PushResult::sent(),
                $report->isSubscriptionExpired() => PushResult::expired($report->getReason()),
                default => PushResult::failed($report->getReason()),
            };
        }

        return $results;
    }
}
