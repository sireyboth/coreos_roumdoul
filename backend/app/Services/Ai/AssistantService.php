<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Help assistant for CoreOS Roumdoul.
 *
 * The prompt is built from two files in resources/ai:
 *  - assistant-rules.md : behaviour rules (rarely changed)
 *  - system-guide.md    : how the system works (update with every feature)
 */
class AssistantService
{
    /** How many earlier messages to resend (keeps cost down). */
    private const HISTORY_LIMIT = 6;

    public function ask(string $question, array $history, string $role): array
    {
        $messages = collect($history)
            ->take(-self::HISTORY_LIMIT)
            ->map(fn ($m) => [
                'role' => $m['role'] === 'assistant' ? 'assistant' : 'user',
                'content' => (string) $m['content'],
            ])
            ->values()
            ->all();

        $messages[] = ['role' => 'user', 'content' => $question];

        $response = Http::withHeaders([
            'x-api-key' => config('services.anthropic.key'),
            'anthropic-version' => '2023-06-01',
        ])
            ->timeout(30)
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => config('services.anthropic.model'),
                'max_tokens' => 400,
                'system' => [
                    // The big, unchanging part is cached: much cheaper on repeat calls.
                    [
                        'type' => 'text',
                        'text' => $this->staticPrompt(),
                        'cache_control' => ['type' => 'ephemeral'],
                    ],
                    // The small per-user part comes after the cached block.
                    [
                        'type' => 'text',
                        'text' => "<user_context>\nrole: {$role}\n</user_context>",
                    ],
                ],
                'messages' => $messages,
            ]);

        try {
            $response->throw();
        } catch (RequestException $e) {
            Log::warning('ai.assistant.error', ['status' => $response->status(), 'body' => $response->body()]);
            throw $e;
        }

        $raw = trim(collect($response->json('content', []))
            ->where('type', 'text')
            ->pluck('text')
            ->implode("\n"));

        $status = 'answered';
        if (str_starts_with($raw, '[OFF_TOPIC]')) {
            $status = 'off_topic';
        } elseif (str_starts_with($raw, '[UNKNOWN]')) {
            $status = 'unknown';
        }
        $answer = trim(preg_replace('/^\[(OFF_TOPIC|UNKNOWN)\]\s*/', '', $raw));

        // Questions the guide could not answer: review these weekly
        // and add the answers to system-guide.md.
        if ($status === 'unknown') {
            Log::info('ai.assistant.unknown', ['question' => $question, 'role' => $role]);
        }

        return [
            'answer' => $answer,
            'status' => $status,
            'usage' => $response->json('usage'),
        ];
    }

    private function staticPrompt(): string
    {
        $rules = file_get_contents(resource_path('ai/assistant-rules.md'));
        $guide = file_get_contents(resource_path('ai/system-guide.md'));

        return $rules."\n<system_guide>\n".$guide."\n</system_guide>";
    }
}
