<?php

namespace App\Services\Telegram;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * Gives every post a time slot in its group's queue, like a ticket at a
 * counter: one post every GAP_SECONDS per group, booked when the post is
 * queued. Each post then wakes once, at its slot.
 *
 * Why: Telegram takes ~20 posts a minute into one group. Load test
 * (2026-11-21, 200 posts at once into one group): with only the per-minute
 * limiter, every waiting post woke every minute (1,045 wake-ups for 200
 * posts) and minute boundaries let 20 through in 60 s. Booked slots keep an
 * even pace (at most ~17 in any 60 s) and wake each post once.
 *
 * Groups don't share slots, so many companies post side by side. The
 * "telegram" rate limiter (AppServiceProvider) stays as the safety net —
 * e.g. when a slow worker lets several slots fall due together.
 */
final class TelegramPacer
{
    /** Seconds between two posts to one group: ~16.7 a minute, safely under Telegram's ~20. */
    public const GAP_SECONDS = 3.6;

    /**
     * Books this group's next free slot. Returns how many seconds from now
     * it is (0 = straight away).
     */
    public function book(int $groupId): int
    {
        try {
            // One booking at a time per group, so two posts never get the same slot.
            return Cache::lock("telegram-pace-lock:{$groupId}", 5)->block(5, function () use ($groupId) {
                $now = microtime(true);
                $slot = max($now, (float) Cache::get($this->key($groupId), 0));

                // Remember the next free slot until well after it has passed.
                Cache::put($this->key($groupId), $slot + self::GAP_SECONDS, now()->addSeconds((int) ceil($slot - $now) + 3600));

                return (int) round($slot - $now);
            });
        } catch (LockTimeoutException) {
            // Couldn't book in time: send now; the rate limiter still keeps the pace.
            return 0;
        }
    }

    private function key(int $groupId): string
    {
        return "telegram-pace-next:{$groupId}";
    }
}
