<?php

namespace App\Services\Telegram;

use App\Models\CompanyMembership;
use App\Models\TelegramGroup;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;

/**
 * Tells a company's admins (company.manage) when one of their Telegram groups
 * stops getting posts without them pressing Disconnect — the bot was removed
 * from the group, or the group no longer exists. Otherwise nobody would know
 * until they noticed the group had gone quiet.
 */
class TelegramGroupAlerts
{
    public const TYPE = 'telegram.group_lost';

    public const LINK = '/dashboard/telegram';

    public function lost(TelegramGroup $group, string $why): void
    {
        $title = $group->title ?: 'your Telegram group';

        foreach ($this->admins($group->company_id) as $admin) {
            NotificationService::send(
                $admin, self::TYPE,
                "Telegram group disconnected: {$title}",
                "{$why} No more posts go there. Connect it again in Access → Telegram if that wasn't on purpose.",
                data: ['telegram_group_id' => $group->id, 'title' => $group->title],
                link: self::LINK,
                dedupeKey: self::TYPE.":{$group->id}:{$admin->id}",
            );
        }
    }

    /** @return iterable<User> */
    private function admins(int $companyId): iterable
    {
        return CompanyMembership::query()
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->whereHas('user', fn (Builder $q) => $q->where('is_active', true))
            ->whereHas('roles.permissions', fn (Builder $q) => $q->where('code', 'company.manage'))
            ->with('user')
            ->get()
            ->pluck('user')
            ->filter(fn ($user) => $user instanceof User)
            ->unique('id');
    }
}
