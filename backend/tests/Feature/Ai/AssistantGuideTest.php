<?php

namespace Tests\Feature\Ai;

use App\Services\Ai\AssistantService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AssistantGuideTest extends TestCase
{
    /**
     * Fails when a page is added to the sidebar (frontend nav.ts)
     * but not described in resources/ai/system-guide.md.
     * This is what keeps the assistant up to date with the system.
     */
    public function test_every_sidebar_page_is_in_the_guide(): void
    {
        $navPath = base_path('../frontend/src/components/dashboard/layout/nav.ts');

        if (! file_exists($navPath)) {
            $this->markTestSkipped('frontend nav.ts not found');
        }

        // Adjust if your nav items use a different key than title/label.
        preg_match_all('/\b(?:title|label)\s*:\s*["\']([^"\']+)["\']/', file_get_contents($navPath), $m);
        $guide = mb_strtolower(file_get_contents(resource_path('ai/system-guide.md')));

        $missing = collect($m[1])
            ->unique()
            ->reject(fn ($name) => str_contains($guide, mb_strtolower($name)))
            ->values()
            ->all();

        $this->assertSame([], $missing,
            'Add these pages to backend/resources/ai/system-guide.md: '.implode(', ', $missing));
    }

    public function test_guide_stays_small_enough_to_be_cheap(): void
    {
        // ~4 characters per token: 40,000 chars is about 10,000 tokens.
        $this->assertLessThan(40000, strlen(file_get_contents(resource_path('ai/system-guide.md'))));
    }

    public function test_markers_are_stripped_and_reported(): void
    {
        config(['services.anthropic.key' => 'test', 'services.anthropic.model' => 'claude-haiku-5-5']);

        Http::fake([
            'api.anthropic.com/*' => Http::response([
                'content' => [['type' => 'text', 'text' => '[OFF_TOPIC] Sorry, I can only help with questions about CoreOS Roumdoul.']],
                'usage' => ['input_tokens' => 10, 'output_tokens' => 5],
            ]),
        ]);

        $result = app(AssistantService::class)->ask('Write me a poem', [], 'employee');

        $this->assertSame('off_topic', $result['status']);
        $this->assertStringStartsWith('Sorry', $result['answer']);
    }
}
