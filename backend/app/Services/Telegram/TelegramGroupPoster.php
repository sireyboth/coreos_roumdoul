<?php

namespace App\Services\Telegram;

use App\Jobs\SendTelegramMessage;
use App\Models\Employee;
use App\Models\TelegramGroup;
use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Posts an event to the company's Telegram groups. Called by the notifiers
 * next to their per-person alerts (RequestNotifier, LateWarningNotifier).
 *
 * Which groups: every group that ticked this kind of event AND covers the
 * employee's current branch (TelegramGroup::covers) — a company-wide group
 * gets everything, a branch group only its branch. Each group gets the text
 * at its own detail level ("full" or "basic", see TelegramCard).
 *
 * The app is the record; a post is only a copy of the news. The send goes
 * through the queue after the surrounding transaction commits, so a slow
 * Telegram never slows a request and a rolled-back change never posts. Each
 * event posts once per group (remembered 40 days), so retries and hourly
 * re-runs don't repeat it — and if a send finally fails, the job forgets
 * that mark so a re-run can try again (SendTelegramMessage::failed).
 */
class TelegramGroupPoster
{
    public const DEDUPE_DAYS = 40;

    public function __construct(private readonly TelegramBot $bot, private readonly TelegramPacer $pacer) {}

    /**
     * @param  string  $event  one of TelegramGroup::EVENTS
     * @param  string  $key  identifies the event, e.g. "request_decided:42"
     * @param  Closure(string): string  $text  the post for a detail level (TelegramGroup::DETAILS)
     */
    public function post(int $companyId, string $event, string $key, ?Employee $employee, Closure $text): void
    {
        if (! $this->bot->enabled()) {
            return;
        }

        $branchId = $employee ? TelegramCard::branchOf($employee) : null;

        $groups = TelegramGroup::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->get()
            ->filter(fn (TelegramGroup $group) => $group->wants($event) && $group->covers($branchId));

        foreach ($groups as $group) {
            $dedupe = self::dedupeKey($group->id, $key);

            if (Cache::add($dedupe, true, now()->addDays(self::DEDUPE_DAYS))) {
                // Queued for the group's next free slot (TelegramPacer), so a burst goes out at an even pace.
                SendTelegramMessage::dispatch($group->id, $text($group->detail), $dedupe)
                    ->delay($this->pacer->book($group->id))
                    ->afterCommit();
            }
        }
    }

    public static function dedupeKey(int $groupId, string $key): string
    {
        return "telegram-post:{$groupId}:{$key}";
    }
}
