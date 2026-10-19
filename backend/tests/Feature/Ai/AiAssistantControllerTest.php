<?php

namespace Tests\Feature\Ai;

use App\Models\Module;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * The help assistant endpoint: any member may ask, the member's role is
 * passed along as a hint, and the daily limits are counted per company.
 */
class AiAssistantControllerTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Help Co', 'Boss', 'boss@help.test', 'password123');

        // A paying company on a plan that includes the assistant.
        $plan = Plan::query()->where('code', 'growth')->firstOrFail();
        $plan->modules()->attach(Module::query()->where('code', 'ai_assistant')->firstOrFail()->id);
        Subscription::query()->create(['company_id' => $this->company->id, 'plan_id' => $plan->id, 'status' => 'active']);
        $this->company->update(['status' => 'active']);

        config(['services.anthropic.key' => 'test', 'services.anthropic.model' => 'claude-haiku-5-5']);
    }

    private function fakeAnswer(string $text = 'Open "Attendance" and tap "Scan QR".'): void
    {
        Http::fake([
            'api.anthropic.com/*' => Http::response([
                'content' => [['type' => 'text', 'text' => $text]],
                'usage' => ['input_tokens' => 10, 'output_tokens' => 5],
            ]),
        ]);
    }

    private function sentRole(): string
    {
        $context = '';
        Http::assertSent(function (HttpRequest $request) use (&$context) {
            $context = $request['system'][1]['text'];

            return true;
        });

        preg_match('/role: (\S+)/', $context, $m);

        return $m[1];
    }

    public function test_an_employee_can_ask_and_their_role_is_sent(): void
    {
        $this->fakeAnswer();
        $staff = $this->createUserWithRole($this->company, 'employee');

        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'How do I scan in?'])
            ->assertOk()
            ->assertJson(['status' => 'answered', 'answer' => 'Open "Attendance" and tap "Scan QR".']);

        $this->assertSame('employee', $this->sentRole());
    }

    public function test_the_broadest_built_in_role_wins(): void
    {
        $this->fakeAnswer();
        $admin = $this->company->users()->first();

        $this->actingAs($admin)->postJson('/api/ai/assistant', ['question' => 'How do I add a branch?'])->assertOk();

        $this->assertSame('company-admin', $this->sentRole());
    }

    public function test_a_trial_company_is_refused_even_when_its_plan_has_the_module(): void
    {
        $this->fakeAnswer();
        $this->company->update(['status' => 'trial', 'trial_ends_at' => now()->addDays(7)]);
        $staff = $this->createUserWithRole($this->company, 'employee');

        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'How do I scan in?'])
            ->assertForbidden()
            ->assertJson(['code' => 'module_not_enabled']);

        Http::assertNothingSent();
    }

    public function test_a_plan_without_the_module_is_refused(): void
    {
        $this->fakeAnswer();
        Plan::query()->where('code', 'growth')->firstOrFail()->modules()->detach(
            Module::query()->where('code', 'ai_assistant')->firstOrFail()->id,
        );
        $staff = $this->createUserWithRole($this->company, 'employee');

        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'How do I scan in?'])
            ->assertForbidden()
            ->assertJson(['code' => 'module_not_enabled']);

        Http::assertNothingSent();
    }

    public function test_a_user_without_a_company_is_refused(): void
    {
        $this->fakeAnswer();

        $this->actingAs(User::factory()->create())
            ->postJson('/api/ai/assistant', ['question' => 'Hello?'])
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_the_daily_user_limit_returns_a_readable_message(): void
    {
        $this->fakeAnswer();
        $staff = $this->createUserWithRole($this->company, 'employee');

        for ($i = 0; $i < 30; $i++) {
            $this->actingAs($staff)->postJson('/api/ai/assistant', ['question' => "Question {$i}"])->assertOk();
        }

        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'One more'])
            ->assertStatus(429)
            ->assertJson(['message' => 'Daily question limit reached. Try again tomorrow.']);
    }

    public function test_a_chat_is_capped_at_ten_questions(): void
    {
        $this->fakeAnswer();
        $staff = $this->createUserWithRole($this->company, 'employee');
        $turns = fn (int $questions) => collect(range(1, $questions))->flatMap(fn ($i) => [
            ['role' => 'user', 'content' => "Question {$i}"],
            ['role' => 'assistant', 'content' => "Answer {$i}"],
        ])->all();

        // The 10th question (9 before it) is allowed; an 11th is not.
        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'Tenth', 'history' => $turns(9)])
            ->assertOk();

        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'Eleventh', 'history' => $turns(10)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('history');

        Http::assertSentCount(1);
    }

    public function test_an_api_failure_is_a_503_and_is_not_counted(): void
    {
        Http::fake(['api.anthropic.com/*' => Http::response(['error' => 'overloaded'], 529)]);
        $staff = $this->createUserWithRole($this->company, 'employee');

        $this->actingAs($staff)
            ->postJson('/api/ai/assistant', ['question' => 'How do I request leave?'])
            ->assertStatus(503)
            ->assertJsonStructure(['message']);

        $this->assertSame(0, RateLimiter::attempts("ai-assistant:user:{$this->company->id}:{$staff->id}"));
    }
}
