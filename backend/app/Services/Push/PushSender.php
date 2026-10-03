<?php

namespace App\Services\Push;

use App\Models\PushSubscription;

/** Sends one message to a set of devices. Swapped for a fake in tests. */
interface PushSender
{
    /** False when push isn't set up (no keys, or the library isn't installed) — alerts then stay in-app only. */
    public function enabled(): bool;

    /**
     * @param  iterable<PushSubscription>  $subscriptions
     * @param  array<string, mixed>  $payload  what the service worker receives
     * @return array<int, PushResult> keyed by subscription id
     */
    public function send(iterable $subscriptions, array $payload): array;
}
