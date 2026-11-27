<?php

namespace App\Services\Telegram;

use App\Models\Branch;
use App\Models\Company;
use App\Models\TelegramGroup;
use App\Models\User;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Linking a company to its Telegram group, and keeping the link true.
 *
 *  1. An admin asks for a link (linkFor): a one-time code, valid 30 minutes,
 *     inside https://t.me/<bot>?startgroup=<code>.
 *  2. They open it and pick their group. Telegram adds the bot and posts
 *     "/start <code>" in that group, which reaches our webhook (handle).
 *     Typing "/connect <code>" in the group works the same way.
 *  3. The code names the company — nobody can link a group to a company
 *     they don't manage. The group is told it's connected.
 *
 * The bot removed from the group, or the group upgraded to a supergroup
 * (new id), updates the link too.
 */
class TelegramConnector
{
    public const CODE_MINUTES = 30;

    public function __construct(private readonly TelegramBot $bot, private readonly TelegramGroupAlerts $alerts) {}

    /**
     * @param  list<int>|null  $branchIds  the new group's reach: null = every branch
     * @return array{link: string, code: string, expires_at: string}
     */
    public function linkFor(Company $company, User $by, ?array $branchIds = null): array
    {
        $code = Str::random(24);
        $expires = CarbonImmutable::now()->addMinutes(self::CODE_MINUTES);
        Cache::put($this->cacheKey($code), ['company_id' => $company->id, 'user_id' => $by->id, 'branch_ids' => $branchIds], $expires);

        return [
            'link' => 'https://t.me/'.$this->bot->username().'?startgroup='.$code,
            'code' => $code,
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    /**
     * One update from Telegram's webhook.
     *
     * @param  array<string, mixed>  $update
     */
    public function handle(array $update): void
    {
        if (isset($update['my_chat_member'])) {
            $this->membershipChanged($update['my_chat_member']);

            return;
        }

        $message = $update['message'] ?? null;
        if (! is_array($message) || ! in_array($message['chat']['type'] ?? null, ['group', 'supergroup'], true)) {
            return;
        }

        $chatId = (string) $message['chat']['id'];

        if (isset($message['migrate_to_chat_id'])) {
            TelegramGroup::query()->withoutGlobalScopes()->where('chat_id', $chatId)->update(['chat_id' => (string) $message['migrate_to_chat_id']]);

            return;
        }

        // "/start CODE", "/start@SomeBot CODE" or "/connect CODE".
        if (preg_match('~^/(start|connect)(@\w+)?\s+([A-Za-z0-9]{24})\s*$~', (string) ($message['text'] ?? ''), $m)) {
            $this->connect($chatId, (string) ($message['chat']['title'] ?? ''), $m[3]);
        }
    }

    private function connect(string $chatId, string $title, string $code): void
    {
        $claim = Cache::pull($this->cacheKey($code));
        $company = $claim ? Company::query()->find($claim['company_id']) : null;

        if (! $company) {
            $this->bot->sendMessage($chatId, '⏱ This link has expired or was already used. In Business OS, open Telegram and press "Connect group" again.');

            return;
        }

        // A group links to one company: linking it here unlinks it elsewhere.
        TelegramGroup::query()->withoutGlobalScopes()->where('chat_id', $chatId)->where('company_id', '!=', $company->id)->delete();

        // The same group linked again (e.g. a new link for another branch) is
        // updated, not added twice; its post choices are kept.
        $group = TelegramGroup::query()->withoutGlobalScopes()->firstOrNew(['company_id' => $company->id, 'chat_id' => $chatId]);

        if (! $group->exists && TelegramGroup::query()->withoutGlobalScopes()->where('company_id', $company->id)->count() >= TelegramGroup::MAX_PER_COMPANY) {
            $this->bot->sendMessage($chatId, 'This company already has '.TelegramGroup::MAX_PER_COMPANY.' Telegram groups. Disconnect one in Business OS first.');

            return;
        }

        $group->fill([
            'title' => $title ?: null,
            'branch_ids' => $claim['branch_ids'] ?? null,
            'connected_by' => $claim['user_id'] ?? null,
            'events' => $group->exists ? $group->events : TelegramGroup::DEFAULT_EVENTS,
        ])->save();

        // Comes from Telegram, not a signed-in request: who asked for the link is kept in the data.
        AuditLogger::record('telegram.connected', $group, [
            'title' => $group->title, 'branch_ids' => $group->branch_ids, 'link_by_user_id' => $claim['user_id'] ?? null,
        ], companyId: $company->id);

        $reach = $group->branch_ids === null
            ? 'every branch'
            : Branch::query()->withoutGlobalScopes()->whereIn('id', $group->branch_ids)->orderBy('name')->pluck('name')->join(', ');

        $this->bot->sendMessage($chatId, "✅ Connected to {$company->name} ({$reach}).\nThis group will get leave requests and decisions from Business OS — no pay or private details.");
    }

    /** @param  array<string, mixed>  $change */
    private function membershipChanged(array $change): void
    {
        $status = $change['new_chat_member']['status'] ?? null;

        if (! in_array($status, ['left', 'kicked'], true)) {
            return;
        }

        // Removed inside Telegram (not with Disconnect, which deletes the link
        // before the bot leaves): drop the link and tell the company's admins.
        $groups = TelegramGroup::query()->withoutGlobalScopes()->where('chat_id', (string) ($change['chat']['id'] ?? ''))->get();

        foreach ($groups as $group) {
            $this->alerts->lost($group, 'The bot was removed from the group in Telegram.');
            $group->delete();
        }
    }

    private function cacheKey(string $code): string
    {
        return "telegram-connect:{$code}";
    }
}
