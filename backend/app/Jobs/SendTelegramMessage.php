<?php

namespace App\Jobs;

use App\Models\TelegramGroup;
use App\Services\Telegram\TelegramBot;
use App\Services\Telegram\TelegramGroupAlerts;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Sends one message to one Telegram group, on its own queue ("telegram" by
 * default, TELEGRAM_QUEUE), so a burst of posts never delays phone pushes.
 *
 * Staying inside Telegram's limits: each post is queued for its group's next
 * free slot (TelegramPacer — one every 3.6 s per group). As a safety net, at
 * most 18 a minute per group and 25 a second for the whole bot (the
 * "telegram" rate limiter in AppServiceProvider); over that, the job waits.
 *
 * When Telegram says no:
 *  - Too many messages (429): waits as long as Telegram asks, then retries.
 *  - Telegram down / no answer: retried after 1, 5, then 15 minutes.
 *    Waiting never uses up tries — the job keeps going for RETRY_HOURS; only
 *    3 real errors (MAX_ERRORS) end it sooner.
 *  - The group became a supergroup: follows it to its new id and resends.
 *  - The bot was removed or the group is gone (403 / chat not found): the
 *    link is dropped and the company's admins are told (TelegramGroupAlerts).
 *
 * If it finally fails, the "already posted" mark is forgotten (failed), so
 * an hourly re-run (late warnings) posts it again. The app is the record —
 * a lost post loses no data, only that copy of the news.
 */
class SendTelegramMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public const RETRY_HOURS = 6;

    public const MAX_ERRORS = 3;

    /** Errors (not waits) allowed before giving up. */
    public int $maxExceptions = self::MAX_ERRORS;

    /**
     * @param  string|null  $dedupeKey  TelegramGroupPoster's "already posted" mark, forgotten if this fails
     */
    public function __construct(public readonly int $groupId, public readonly string $text, public readonly ?string $dedupeKey = null)
    {
        $this->onQueue(config('services.telegram.queue'));
    }

    /** Keeps trying until then — however many times it had to wait. */
    public function retryUntil(): \DateTimeInterface
    {
        return now()->addHours(self::RETRY_HOURS);
    }

    /** @return list<int> seconds before the 1st, 2nd, 3rd retry after an error */
    public function backoff(): array
    {
        return [60, 300, 900];
    }

    /** @return list<object> */
    public function middleware(): array
    {
        return [new RateLimited('telegram')];
    }

    public function handle(TelegramBot $bot, TelegramGroupAlerts $alerts): void
    {
        $group = TelegramGroup::query()->withoutGlobalScopes()->find($this->groupId);

        if (! $group || ! $bot->enabled()) {
            return;
        }

        $response = $bot->sendMessage($group->chat_id, $this->text);

        if ($response->successful()) {
            return;
        }

        $error = $response->json() ?? [];
        $newChatId = $error['parameters']['migrate_to_chat_id'] ?? null;

        if ($newChatId) {
            $group->update(['chat_id' => (string) $newChatId]);
            $bot->sendMessage($group->chat_id, $this->text);

            return;
        }

        if ($response->status() === 429) {
            $this->release((int) ($error['parameters']['retry_after'] ?? 30));

            return;
        }

        if ($response->status() === 403 || str_contains(strtolower($error['description'] ?? ''), 'chat not found')) {
            Log::warning('Telegram group unreachable; link removed', ['company_id' => $group->company_id, 'telegram_group_id' => $group->id, 'description' => $error['description'] ?? null]);
            $alerts->lost($group, 'The bot can no longer post there — it was removed from the group, or the group was deleted.');
            $group->delete();

            return;
        }

        if ($response->serverError()) {
            // Counts as an error: retried after the backoff, up to MAX_ERRORS.
            throw new RuntimeException('Telegram server error '.$response->status().': '.($error['description'] ?? ''));
        }

        // Anything else (e.g. 400 bad request) won't get better by retrying.
        Log::warning('Telegram message not sent', ['company_id' => $group->company_id, 'telegram_group_id' => $group->id, 'status' => $response->status(), 'description' => $error['description'] ?? null]);
    }

    /** Gave up: let a later run post it again. */
    public function failed(?Throwable $e): void
    {
        if ($this->dedupeKey) {
            Cache::forget($this->dedupeKey);
        }

        Log::warning('Telegram post given up', ['telegram_group_id' => $this->groupId, 'error' => $e?->getMessage()]);
    }
}
