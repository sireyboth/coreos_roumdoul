<?php

namespace App\Http\Controllers\Api\Telegram;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Company;
use App\Models\TelegramGroup;
use App\Services\AuditLogger;
use App\Services\Telegram\TelegramBot;
use App\Services\Telegram\TelegramConnector;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The company's Telegram groups (company.manage): list them, get a link to
 * connect one (for every branch or chosen branches), choose what each gets
 * and how much it shows, send a test, disconnect.
 */
class TelegramGroupController extends Controller
{
    private const COLUMNS = ['id', 'title', 'branch_ids', 'events', 'detail', 'created_at', 'updated_at'];

    public function __construct(private readonly TelegramBot $bot) {}

    public function show()
    {
        return [
            // The platform hasn't set up a bot yet: the page explains instead of offering Connect.
            'available' => $this->bot->enabled(),
            'bot_username' => $this->bot->username(),
            'events' => TelegramGroup::EVENTS,
            'details' => TelegramGroup::DETAILS,
            'max_groups' => TelegramGroup::MAX_PER_COMPANY,
            'groups' => TelegramGroup::query()->orderBy('created_at')->get(self::COLUMNS),
        ];
    }

    public function link(Request $request, TelegramConnector $connector)
    {
        $this->assertAvailable();
        $company = $request->user()->company;
        abort_unless($company instanceof Company, 404);

        $data = $request->validate($this->branchRules());

        if (TelegramGroup::query()->count() >= TelegramGroup::MAX_PER_COMPANY) {
            throw ValidationException::withMessages(['telegram' => [__('You can connect up to :n groups. Disconnect one first.', ['n' => TelegramGroup::MAX_PER_COMPANY])]]);
        }

        return $connector->linkFor($company, $request->user(), $this->branchIds($data));
    }

    public function update(Request $request, TelegramGroup $group)
    {
        $data = $request->validate([
            'events' => ['sometimes', 'present', 'array'],
            'events.*' => ['string', Rule::in(TelegramGroup::EVENTS)],
            'detail' => ['sometimes', Rule::in(TelegramGroup::DETAILS)],
            ...$this->branchRules(),
        ]);

        $before = $group->only(['events', 'detail', 'branch_ids']);
        $changes = [];

        if (array_key_exists('events', $data)) {
            $changes['events'] = array_values(array_unique($data['events']));
        }
        if (array_key_exists('detail', $data)) {
            $changes['detail'] = $data['detail'];
        }
        if (array_key_exists('branch_ids', $data)) {
            $changes['branch_ids'] = $this->branchIds($data);
        }

        $group->update($changes);
        AuditLogger::record('telegram.group_updated', $group, $group->only(['events', 'detail', 'branch_ids']), beforeData: $before);

        return $group->only(self::COLUMNS);
    }

    /** Sent straight away (not queued), so the admin sees at once whether it works. */
    public function test(TelegramGroup $group)
    {
        $this->assertAvailable();

        $response = $this->bot->sendMessage($group->chat_id, '👋 Test from Business OS — this group is connected.');

        if (! $response->successful()) {
            throw ValidationException::withMessages(['telegram' => [__('Telegram did not accept the message: :reason', ['reason' => $response->json('description') ?? $response->status()])]]);
        }

        return response()->noContent();
    }

    public function destroy(TelegramGroup $group)
    {
        AuditLogger::record('telegram.disconnected', $group, [], beforeData: $group->only(['title', 'branch_ids']));

        // Delete the link first: when the bot then leaves, Telegram reports it to
        // the webhook, which must find nothing — or it would alert "bot removed".
        $group->delete();

        if ($this->bot->enabled()) {
            // Best effort: say goodbye and leave; the link is gone either way.
            rescue(fn () => $this->bot->sendMessage($group->chat_id, '🔌 Disconnected from Business OS. No more alerts will be posted here.'), report: false);
            rescue(fn () => $this->bot->leaveChat($group->chat_id), report: false);
        }

        return response()->noContent();
    }

    /**
     * branch_ids: null or absent = every branch; else at least one of this
     * company's branches (the company scope on Branch keeps others out).
     *
     * @return array<string, mixed>
     */
    private function branchRules(): array
    {
        return [
            'branch_ids' => ['sometimes', 'nullable', 'array', 'min:1'],
            'branch_ids.*' => ['integer', 'distinct', function (string $attribute, mixed $id, \Closure $fail) {
                if (! Branch::query()->whereKey($id)->exists()) {
                    $fail(__('That branch does not exist.'));
                }
            }],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<int>|null
     */
    private function branchIds(array $data): ?array
    {
        $ids = $data['branch_ids'] ?? null;

        return $ids === null ? null : array_values(array_map('intval', $ids));
    }

    private function assertAvailable(): void
    {
        if (! $this->bot->enabled()) {
            abort(response()->json([
                'message' => __('Telegram is not set up on this server yet.'),
                'code' => 'telegram_not_configured',
            ], 409));
        }
    }
}
