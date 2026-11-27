<?php

namespace Tests\Feature\Api\Telegram;

use App\Jobs\SendTelegramMessage;
use App\Models\AttendanceDay;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\LeaveType;
use App\Models\Notification;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\TelegramGroup;
use App\Models\User;
use App\Services\Attendance\LateWarningNotifier;
use App\Services\Company\CompanyProvisioner;
use App\Services\Telegram\TelegramBot;
use App\Services\Telegram\TelegramGroupAlerts;
use App\Services\Telegram\TelegramPacer;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Mockery;
use RuntimeException;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/**
 * A company links its own Telegram group to the platform bot and chooses
 * what it gets; the group then gets short, private-detail-free posts.
 * Telegram itself is faked — every call to it is recorded instead.
 *
 * "Today" is Monday 5 October 2026, 10:00 in Phnom Penh.
 */
class TelegramGroupTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private const SECRET = 'webhook-secret-123';

    private const CHAT = '-1001234567890';

    private Company $company;

    private User $admin;

    private User $staff;

    private Employee $dara;

    /** Dara's branch. */
    private Branch $main;

    /** Telegram's next answers, in order; when empty it answers ok. */
    private array $answers = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
        $this->travelTo(Carbon::parse('2026-10-05 10:00', 'Asia/Phnom_Penh'));

        config([
            'services.telegram.bot_token' => '123:ABC',
            'services.telegram.bot_username' => 'RoumdoulBot',
            'services.telegram.webhook_secret' => self::SECRET,
        ]);
        Http::fake(['api.telegram.org/*' => fn () => array_shift($this->answers) ?? Http::response(['ok' => true, 'result' => true])]);

        $this->company = app(CompanyProvisioner::class)->provision('Sovanna Trading', 'Boss', 'boss@sovanna.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh']);
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();

        $this->main = $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Main']);
        $this->staff = $this->createUserWithRole($this->company, 'employee', ['name' => 'Dara']);
        $this->dara = Employee::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'display_name' => 'Dara', 'user_id' => $this->staff->id, 'hire_date' => '2024-01-01',
        ]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->dara->id, 'branch_id' => $branch->id, 'effective_from' => '2020-01-01',
        ]);
        $this->assignSchedule($this->dara, $this->makeWorkSchedule($this->company, weekdays: [1, 2, 3, 4, 5]));
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    /** What Telegram would receive from us, as [method, payload] pairs. */
    private function sent(?string $method = null): array
    {
        return collect(Http::recorded())
            ->map(fn (array $pair) => [basename($pair[0]->url()), $pair[0]->data()])
            ->filter(fn (array $call) => $method === null || $call[0] === $method)
            ->values()
            ->all();
    }

    /** The text of the last message we sent. */
    private function lastText(): string
    {
        $messages = $this->sent('sendMessage');

        return $messages[count($messages) - 1][1]['text'];
    }

    private function webhook(array $update, ?string $secret = self::SECRET)
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/telegram/webhook', $update, $secret === null ? [] : ['X-Telegram-Bot-Api-Secret-Token' => $secret]);
    }

    /** Telegram's update when someone types $text in a group. */
    private function groupMessage(string $text, string $chatId = self::CHAT, string $type = 'supergroup'): array
    {
        return ['update_id' => 1, 'message' => ['message_id' => 1, 'chat' => ['id' => (int) $chatId, 'type' => $type, 'title' => 'Sovanna HR'], 'text' => $text]];
    }

    /**
     * Connects a group the way an admin does: get a link (for every branch, or
     * $branchIds), Telegram posts /start CODE from that group.
     *
     * @param  list<string>|null  $events  then ticks these (a new group starts with DEFAULT_EVENTS)
     */
    private function connect(string $chatId = self::CHAT, ?array $branchIds = null, ?array $events = null): TelegramGroup
    {
        $code = $this->as($this->admin)->postJson('/api/telegram/link', $branchIds === null ? [] : ['branch_ids' => $branchIds])->assertOk()->json('code');
        $this->webhook($this->groupMessage("/start@RoumdoulBot {$code}", $chatId))->assertOk();

        $group = TelegramGroup::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('chat_id', $chatId)->sole();

        return $events === null ? $group : tap($group)->update(['events' => $events]);
    }

    /** Messages posted to one chat, after its "Connected" reply. */
    private function postsTo(string $chatId): array
    {
        return collect($this->sent('sendMessage'))
            ->filter(fn (array $call) => (string) $call[1]['chat_id'] === $chatId)
            ->map(fn (array $call) => $call[1]['text'])
            ->reject(fn (string $text) => str_starts_with($text, '✅ Connected'))
            ->values()
            ->all();
    }

    /** Runs a send job the way the queue would (its handle() dependencies injected). */
    private function runJob(SendTelegramMessage $job): void
    {
        app()->call([$job, 'handle']);
    }

    private function lostAlerts(): int
    {
        return Notification::query()->withoutGlobalScopes()->where('notification_type', TelegramGroupAlerts::TYPE)->count();
    }

    private function askForLeave(string $date = '2026-10-07'): int
    {
        return $this->as($this->staff)->postJson('/api/requests', [
            'leave_type_id' => $this->unpaid()->id, 'start_date' => $date, 'end_date' => $date,
        ])->assertCreated()->json('id');
    }

    private function unpaid(): LeaveType
    {
        return LeaveType::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('code', 'unpaid')->firstOrFail();
    }

    // ───────────────────────────── connecting ─────────────────────────────

    public function test_an_admin_gets_a_start_group_link_for_the_bot(): void
    {
        $this->as($this->admin)->getJson('/api/telegram')
            ->assertOk()
            ->assertJson(['available' => true, 'bot_username' => 'RoumdoulBot', 'groups' => [], 'details' => ['full', 'basic']]);

        $link = $this->postJson('/api/telegram/link')->assertOk()->json();
        $this->assertMatchesRegularExpression('~^https://t\.me/RoumdoulBot\?startgroup=[A-Za-z0-9]{24}$~', $link['link']);
    }

    public function test_local_polling_connects_a_group_without_the_webhook(): void
    {
        $code = $this->as($this->admin)->postJson('/api/telegram/link')->assertOk()->json('code');
        $this->answers = [
            Http::response(['ok' => true, 'result' => true]),                                        // deleteWebhook
            Http::response(['ok' => true, 'result' => [$this->groupMessage("/start@RoumdoulBot {$code}")]]), // getUpdates
        ];

        $this->artisan('telegram:poll', ['--once' => true])->assertSuccessful();

        $this->assertSame(self::CHAT, TelegramGroup::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->sole()->chat_id);
        $this->assertSame(['deleteWebhook', 'getUpdates', 'sendMessage'], array_column($this->sent(), 0));
    }

    public function test_without_a_bot_on_the_server_the_page_says_so_and_connect_is_refused(): void
    {
        config(['services.telegram.bot_token' => null]);

        $this->as($this->admin)->getJson('/api/telegram')->assertOk()->assertJson(['available' => false]);
        $this->postJson('/api/telegram/link')->assertStatus(409)->assertJson(['code' => 'telegram_not_configured']);
    }

    public function test_the_group_is_linked_by_the_start_message_and_told_so(): void
    {
        $group = $this->connect();

        // Late warnings are opt-in: a new group gets requests and decisions only.
        $this->assertSame([self::CHAT, 'Sovanna HR', ['requests', 'request_decisions'], null, 'full'], [$group->chat_id, $group->title, $group->events, $group->branch_ids, $group->detail]);
        $this->assertStringContainsString('Connected to Sovanna Trading (every branch)', $this->sent('sendMessage')[0][1]['text']);
        $this->as($this->admin)->getJson('/api/telegram')->assertJsonPath('groups.0.title', 'Sovanna HR');
    }

    public function test_a_company_links_a_group_per_branch(): void
    {
        $other = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Riverside']);

        $this->connect();
        $branchGroup = $this->connect('-100222', [$other->id]);

        $this->assertSame([$other->id], $branchGroup->branch_ids);
        $this->assertStringContainsString('Connected to Sovanna Trading (Riverside)', $this->lastText());
        $this->as($this->admin)->getJson('/api/telegram')->assertJsonCount(2, 'groups');
    }

    public function test_a_link_only_takes_the_companys_own_branches(): void
    {
        $elsewhere = app(CompanyProvisioner::class)->provision('Other Co', 'Owner', 'owner@other.test', 'password123');
        $theirs = Branch::query()->withoutGlobalScopes()->create(['company_id' => $elsewhere->id, 'name' => 'Theirs']);

        $this->as($this->admin)->postJson('/api/telegram/link', ['branch_ids' => [$theirs->id]])->assertUnprocessable()->assertJsonValidationErrors('branch_ids.0');
        $this->postJson('/api/telegram/link', ['branch_ids' => []])->assertUnprocessable();
    }

    public function test_linking_the_same_group_again_updates_it_instead_of_adding_it(): void
    {
        $this->connect(events: ['requests', 'late_warnings']);
        $again = $this->connect(branchIds: [$this->main->id]);

        $this->assertSame(1, TelegramGroup::query()->withoutGlobalScopes()->count());
        // The new reach is taken; the post choices are kept.
        $this->assertSame([[$this->main->id], ['requests', 'late_warnings']], [$again->branch_ids, $again->events]);
    }

    public function test_a_company_can_link_up_to_the_limit(): void
    {
        foreach (range(1, TelegramGroup::MAX_PER_COMPANY) as $i) {
            TelegramGroup::query()->withoutGlobalScopes()->create(['company_id' => $this->company->id, 'chat_id' => "-500{$i}", 'events' => []]);
        }

        $this->as($this->admin)->postJson('/api/telegram/link')->assertUnprocessable()->assertJsonValidationErrors('telegram');
    }

    public function test_a_code_works_once_and_a_wrong_code_links_nothing(): void
    {
        $code = $this->as($this->admin)->postJson('/api/telegram/link')->json('code');
        $this->webhook($this->groupMessage("/connect {$code}"))->assertOk();
        TelegramGroup::query()->withoutGlobalScopes()->delete();

        // The same code again, from another group.
        $this->webhook($this->groupMessage("/start {$code}", '-100999'))->assertOk();

        $this->assertSame(0, TelegramGroup::query()->withoutGlobalScopes()->count());
        $this->assertStringContainsString('expired', $this->lastText());
    }

    public function test_the_webhook_needs_telegrams_secret(): void
    {
        $this->webhook($this->groupMessage('/start x'), null)->assertNotFound();
        $this->webhook($this->groupMessage('/start x'), 'wrong')->assertNotFound();
    }

    public function test_private_chats_and_other_messages_are_ignored(): void
    {
        $code = $this->as($this->admin)->postJson('/api/telegram/link')->json('code');

        $this->webhook($this->groupMessage("/start {$code}", '555', 'private'))->assertOk();
        $this->webhook($this->groupMessage('hello everyone'))->assertOk();

        $this->assertSame(0, TelegramGroup::query()->withoutGlobalScopes()->count());
        $this->assertSame([], $this->sent('sendMessage'));
    }

    public function test_removing_the_bot_in_telegram_unlinks_the_group_and_tells_the_admins(): void
    {
        $this->connect();

        $this->webhook($this->botLeft())->assertOk();

        $this->assertSame(0, TelegramGroup::query()->withoutGlobalScopes()->count());
        $alert = Notification::query()->withoutGlobalScopes()->where('notification_type', TelegramGroupAlerts::TYPE)->sole();
        $this->assertSame([$this->admin->id, 'Telegram group disconnected: Sovanna HR'], [$alert->recipient_user_id, $alert->title]);
    }

    /** Telegram's update when the bot is removed from the group. */
    private function botLeft(): array
    {
        return ['update_id' => 2, 'my_chat_member' => [
            'chat' => ['id' => (int) self::CHAT, 'type' => 'supergroup'],
            'new_chat_member' => ['status' => 'kicked', 'user' => ['id' => 123, 'is_bot' => true]],
        ]];
    }

    public function test_a_group_upgraded_to_a_supergroup_keeps_its_link(): void
    {
        $this->connect();

        $this->webhook(['update_id' => 3, 'message' => ['message_id' => 9, 'chat' => ['id' => (int) self::CHAT, 'type' => 'group'], 'migrate_to_chat_id' => -100777]])->assertOk();

        $this->assertSame('-100777', TelegramGroup::query()->withoutGlobalScopes()->sole()->chat_id);
    }

    public function test_a_group_linked_by_another_company_moves_to_the_new_one(): void
    {
        $other = app(CompanyProvisioner::class)->provision('Other Co', 'Owner', 'owner@other.test', 'password123');
        TelegramGroup::query()->withoutGlobalScopes()->create(['company_id' => $other->id, 'chat_id' => self::CHAT, 'events' => TelegramGroup::EVENTS]);

        $this->connect();

        $this->assertSame([$this->company->id], TelegramGroup::query()->withoutGlobalScopes()->pluck('company_id')->all());
    }

    // ───────────────────────────── settings ─────────────────────────────

    public function test_the_admin_chooses_what_each_group_gets(): void
    {
        $group = $this->connect();
        $url = "/api/telegram/groups/{$group->id}";

        $this->as($this->admin)->putJson($url, ['events' => ['late_warnings'], 'detail' => 'basic', 'branch_ids' => [$this->main->id]])
            ->assertOk()->assertJson(['events' => ['late_warnings'], 'detail' => 'basic', 'branch_ids' => [$this->main->id]]);
        // Back to every branch; one field at a time leaves the others alone.
        $this->putJson($url, ['branch_ids' => null])->assertOk()->assertJson(['branch_ids' => null, 'detail' => 'basic']);
        $this->putJson($url, ['events' => []])->assertOk();

        $this->putJson($url, ['events' => ['salaries']])->assertUnprocessable();
        $this->putJson($url, ['detail' => 'everything'])->assertUnprocessable();
    }

    public function test_a_company_only_reaches_its_own_groups(): void
    {
        $elsewhere = app(CompanyProvisioner::class)->provision('Other Co', 'Owner', 'owner@other.test', 'password123');
        $theirs = TelegramGroup::query()->withoutGlobalScopes()->create(['company_id' => $elsewhere->id, 'chat_id' => '-100999', 'events' => []]);

        $this->as($this->admin)->putJson("/api/telegram/groups/{$theirs->id}", ['events' => []])->assertNotFound();
        $this->postJson("/api/telegram/groups/{$theirs->id}/test")->assertNotFound();
        $this->deleteJson("/api/telegram/groups/{$theirs->id}")->assertNotFound();
        $this->assertNotNull($theirs->fresh());
    }

    public function test_an_employee_cannot_see_or_change_the_groups(): void
    {
        $group = $this->connect();

        $this->as($this->staff)->getJson('/api/telegram')->assertForbidden();
        $this->postJson('/api/telegram/link')->assertForbidden();
        $this->putJson("/api/telegram/groups/{$group->id}", ['events' => []])->assertForbidden();
        $this->deleteJson("/api/telegram/groups/{$group->id}")->assertForbidden();
    }

    public function test_a_test_message_is_sent_at_once_and_a_refusal_is_shown(): void
    {
        $group = $this->connect();

        $this->as($this->admin)->postJson("/api/telegram/groups/{$group->id}/test")->assertNoContent();
        $this->assertStringContainsString('Test from Business OS', $this->lastText());

        $this->answers = [Http::response(['ok' => false, 'description' => 'Forbidden: bot was kicked'], 403)];
        $this->postJson("/api/telegram/groups/{$group->id}/test")->assertUnprocessable()->assertJsonPath('errors.telegram.0', 'Telegram did not accept the message: Forbidden: bot was kicked');
    }

    public function test_disconnecting_says_goodbye_leaves_and_forgets_the_group_without_a_false_alarm(): void
    {
        $group = $this->connect();

        $this->as($this->admin)->deleteJson("/api/telegram/groups/{$group->id}")->assertNoContent();
        // Telegram then reports that the bot left — the link is already gone, so nobody is alerted.
        $this->webhook($this->botLeft())->assertOk();

        $this->assertSame(0, TelegramGroup::query()->withoutGlobalScopes()->count());
        $this->assertCount(1, $this->sent('leaveChat'));
        $this->assertSame(0, $this->lostAlerts());
        $this->as($this->admin)->getJson('/api/telegram')->assertJson(['groups' => []]);
    }

    // ───────────────────────────── posts ─────────────────────────────

    public function test_a_leave_request_and_its_decision_are_posted_without_private_details(): void
    {
        $this->connect();

        $id = $this->as($this->staff)->postJson('/api/requests', [
            'leave_type_id' => $this->unpaid()->id, 'start_date' => '2026-10-07', 'end_date' => '2026-10-07', 'reason' => 'Family matter',
        ])->assertCreated()->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/reject", ['notes' => 'Busy week for stock count'])->assertOk();

        $texts = array_column(array_column(array_slice($this->sent('sendMessage'), 1), 1), 'text');
        $this->assertCount(2, $texts);
        // Dara has no code, title or department: those lines are left out, the branch stays.
        $this->assertSame(implode("\n", [
            '🌴 LEAVE REQUEST',
            '━━━━━━━━━━━━━━',
            '👤 Dara',
            '🏢 Main',
            '━━━━━━━━━━━━━━',
            '📅 Unpaid leave',
            '      Wed 7 Oct · 1 day',
            '⏳ Waiting for approval',
        ]), $texts[0]);
        $this->assertStringStartsWith('❌ LEAVE REJECTED', $texts[1]);
        $this->assertStringEndsWith('✍️ Rejected by '.trim($this->admin->name), $texts[1]);
        // The reason and the remark stay between the people involved.
        $this->assertStringNotContainsString('Family matter', implode(' ', $texts));
        $this->assertStringNotContainsString('stock count', implode(' ', $texts));
    }

    public function test_nothing_is_posted_for_an_event_the_company_turned_off(): void
    {
        $this->connect(events: ['late_warnings']);

        $this->askForLeave();

        $this->assertSame([], $this->postsTo(self::CHAT));
    }

    public function test_posts_go_to_company_wide_groups_and_the_employees_branch_group_only(): void
    {
        $riverside = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Riverside']);
        $this->connect('-100001');                          // every branch
        $this->connect('-100002', [$this->main->id]);       // Dara's branch
        $this->connect('-100003', [$riverside->id]);        // another branch

        $this->askForLeave();

        $this->assertCount(1, $this->postsTo('-100001'));
        $this->assertCount(1, $this->postsTo('-100002'));
        $this->assertSame([], $this->postsTo('-100003'));
    }

    public function test_someone_with_no_branch_only_reaches_company_wide_groups(): void
    {
        $this->connect('-100001');
        $this->connect('-100002', [$this->main->id]);
        $this->dara->currentAssignment()->withoutGlobalScopes()->update(['branch_id' => null]);

        $this->askForLeave();

        $this->assertCount(1, $this->postsTo('-100001'));
        $this->assertSame([], $this->postsTo('-100002'));
    }

    public function test_a_basic_group_sees_only_the_name_and_branch(): void
    {
        $this->dara->update(['employee_code' => 'X41-001', 'name_km' => 'ដារា']);
        $this->dara->currentAssignment()->withoutGlobalScopes()->update(['job_title' => 'Cook']);
        $this->connect('-100001')->update(['detail' => 'basic']);
        $this->connect('-100002');

        $this->askForLeave();

        $basic = $this->postsTo('-100001')[0];
        $this->assertStringContainsString("👤 Dara\n🏢 Main\n", $basic);
        $this->assertStringNotContainsString('X41-001', $basic);
        $this->assertStringNotContainsString('ដារា', $basic);
        $this->assertStringContainsString('🆔 X41-001 · Cook', $this->postsTo('-100002')[0]);
    }

    public function test_a_late_warning_is_posted_once_per_level(): void
    {
        $this->connect(events: TelegramGroup::EVENTS);
        $this->company->update(['late_warning_limit' => 3]);
        // A fully filled-in employee: every line of the card shows.
        $this->dara->update(['employee_code' => 'X41-001', 'name_km' => 'ដារា']);
        $kitchen = Department::query()->withoutGlobalScopes()->create(['company_id' => $this->company->id, 'name' => 'Kitchen']);
        $this->dara->currentAssignment()->withoutGlobalScopes()->update(['department_id' => $kitchen->id, 'job_title' => 'Cook']);
        foreach (['01', '02', '05'] as $d) {
            AttendanceDay::query()->withoutGlobalScopes()->create([
                'company_id' => $this->company->id, 'employee_id' => $this->dara->id, 'date' => "2026-10-{$d}",
                'kind' => 'work', 'status' => 'complete', 'late_minutes' => 10,
            ]);
        }

        app(LateWarningNotifier::class)->run($this->company->fresh());
        app(LateWarningNotifier::class)->run($this->company->fresh());

        $posts = array_slice($this->sent('sendMessage'), 1);
        $this->assertCount(1, $posts);
        $this->assertSame(implode("\n", [
            '⚠️ LATE WARNING',
            '━━━━━━━━━━━━━━',
            '👤 Dara (ដារា)',
            '🆔 X41-001 · Cook',
            '🏢 Kitchen · Main',
            '━━━━━━━━━━━━━━',
            '🔁 Late or left early 3 times in October 2026',
            '   • Thu 1 Oct — late 10 min',
            '   • Fri 2 Oct — late 10 min',
            '   • Mon 5 Oct — late 10 min',
        ]), $posts[0][1]['text']);
    }

    public function test_a_group_the_bot_was_removed_from_is_unlinked_and_the_admins_told_when_a_post_fails(): void
    {
        $group = $this->connect();
        $this->answers = [Http::response(['ok' => false, 'description' => 'Forbidden: bot was kicked from the supergroup chat'], 403)];

        $this->runJob(new SendTelegramMessage($group->id, 'Hello'));

        $this->assertSame(0, TelegramGroup::query()->withoutGlobalScopes()->count());
        $this->assertSame(1, $this->lostAlerts());
    }

    // ───────────────────────────── reliability ─────────────────────────────

    public function test_posts_wait_their_turn_on_their_own_queue_instead_of_giving_up(): void
    {
        $group = $this->connect();
        Queue::fake();

        $this->askForLeave();

        Queue::assertPushedOn('telegram', SendTelegramMessage::class);
        $job = new SendTelegramMessage($group->id, 'Hello');
        // Waiting (Telegram's 429, our own limit) never uses up tries: it keeps
        // going for 6 hours; only 3 real errors end it sooner.
        $this->assertSame(SendTelegramMessage::MAX_ERRORS, $job->maxExceptions);
        $this->assertEqualsWithDelta(now()->addHours(6)->timestamp, $job->retryUntil()->getTimestamp(), 5);
        $this->assertInstanceOf(RateLimited::class, $job->middleware()[0]);
    }

    public function test_each_group_gets_its_posts_at_an_even_pace(): void
    {
        $pacer = app(TelegramPacer::class);

        // A burst of 40 posts for one group: one slot every 3.6 s, never two at once.
        $slots = array_map(fn () => $pacer->book(1), range(1, 40));

        $this->assertSame(0, $slots[0]);
        $this->assertSame($slots, array_values(array_unique($slots)), 'two posts got the same slot');
        foreach ($slots as $i => $slot) {
            // At most 17 posts start inside any 60 seconds (Telegram takes ~20).
            $this->assertLessThanOrEqual(17, count(array_filter($slots, fn ($s) => $s >= $slot && $s < $slot + 60)), "window from post {$i}");
        }

        // Another group isn't held up by the first one's queue.
        $this->assertSame(0, $pacer->book(2));
    }

    public function test_a_burst_is_queued_slot_by_slot(): void
    {
        $this->connect('-100001');
        $this->connect('-100002');
        Queue::fake();

        $this->askForLeave('2026-10-07');
        $this->askForLeave('2026-10-08');

        // Per group: the 1st post now, the 2nd one slot later.
        $delays = Queue::pushed(SendTelegramMessage::class)
            ->groupBy(fn (SendTelegramMessage $job) => $job->groupId)
            ->map(fn ($jobs) => $jobs->map(fn (SendTelegramMessage $job) => $job->delay)->all())
            ->values()
            ->all();
        $this->assertSame([[0, 4], [0, 4]], $delays);
    }

    public function test_the_rate_limit_keeps_each_group_under_telegrams_limit(): void
    {
        $limits = RateLimiter::limiter('telegram')(new SendTelegramMessage(7, 'Hello'));

        $this->assertSame([18, 'telegram-group:7'], [$limits[0]->maxAttempts, $limits[0]->key]);
        $this->assertSame([25, 1], [$limits[1]->maxAttempts, $limits[1]->decaySeconds]);
    }

    public function test_telegram_saying_slow_down_releases_the_post_for_later(): void
    {
        $group = $this->connect();
        $this->answers = [Http::response(['ok' => false, 'description' => 'Too Many Requests: retry after 40', 'parameters' => ['retry_after' => 40]], 429)];

        $job = new SendTelegramMessage($group->id, 'Hello');
        $queued = Mockery::mock(Job::class);
        $queued->shouldReceive('release')->once()->with(40);
        $queued->shouldReceive('isReleased', 'isDeletedOrReleased', 'hasFailed')->andReturn(false);
        $job->setJob($queued);

        $this->runJob($job);

        $this->assertNotNull($group->fresh()); // nothing dropped
    }

    public function test_a_post_that_finally_fails_can_be_posted_again_by_a_later_run(): void
    {
        $this->connect(events: TelegramGroup::EVENTS);
        $this->company->update(['late_warning_limit' => 1]);
        AttendanceDay::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->dara->id, 'date' => '2026-10-01',
            'kind' => 'work', 'status' => 'complete', 'late_minutes' => 10,
        ]);

        // Telegram is down: every try errors, the queue gives up and calls failed().
        Queue::fake();
        app(LateWarningNotifier::class)->run($this->company->fresh());
        Queue::assertPushed(SendTelegramMessage::class, function (SendTelegramMessage $job) {
            $job->failed(new RuntimeException('Telegram server error 502'));

            return true;
        });

        // The next hourly run posts it again — the "already posted" mark was forgotten.
        Queue::fake();
        app(LateWarningNotifier::class)->run($this->company->fresh());
        Queue::assertPushed(SendTelegramMessage::class, 1);
    }

    public function test_the_bot_token_never_reaches_an_error_message(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timed out for https://api.telegram.org/bot123:ABC/sendMessage'));

        try {
            app(TelegramBot::class)->sendMessage(self::CHAT, 'Hello');
            $this->fail('Expected the connection error');
        } catch (ConnectionException $e) {
            $this->assertStringNotContainsString('123:ABC', $e->getMessage());
            $this->assertStringContainsString('/bot***/sendMessage', $e->getMessage());
        }
    }

    public function test_posts_follow_a_group_that_became_a_supergroup(): void
    {
        $group = $this->connect();
        $this->answers = [Http::response(['ok' => false, 'description' => 'Bad Request: group chat was upgraded to a supergroup chat', 'parameters' => ['migrate_to_chat_id' => -100888]], 400)];

        $this->runJob(new SendTelegramMessage($group->id, 'Hello'));

        $this->assertSame('-100888', $group->fresh()->chat_id);
        Http::assertSent(fn (HttpRequest $r) => ($r->data()['chat_id'] ?? null) === '-100888' && $r->data()['text'] === 'Hello');
    }
}
