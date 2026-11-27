<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

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

    /**
     * Longest reply, in tokens. Khmer takes several times more tokens than
     * English for the same text, so 600 cut Khmer answers off mid-sentence.
     */
    private const MAX_REPLY_TOKENS = 2000;

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
                // Haiku 5.5 thinks before answering and that thinking counts
                // toward max_tokens: with too little room it can stop
                // (stop_reason max_tokens) before writing any answer at all.
                // Low effort keeps the thinking short for simple how-to questions.
                'max_tokens' => self::MAX_REPLY_TOKENS,
                'output_config' => ['effort' => 'low'],
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

        // No text (cut off while thinking, or a refusal) is a failure, never
        // a blank answer: the controller turns it into "try again" and gives
        // the question back.
        if ($raw === '' || $response->json('stop_reason') === 'refusal') {
            Log::warning('ai.assistant.empty', [
                'stop_reason' => $response->json('stop_reason'),
                'usage' => $response->json('usage'),
            ]);

            throw new RuntimeException('The assistant returned no answer (stop_reason: '.$response->json('stop_reason').').');
        }

        $status = 'answered';
        if (str_starts_with($raw, '[OFF_TOPIC]')) {
            $status = 'off_topic';
        } elseif (str_starts_with($raw, '[UNKNOWN]')) {
            $status = 'unknown';
        }
        $answer = $this->plainText(preg_replace('/^\[(OFF_TOPIC|UNKNOWN)\]\s*/', '', $raw));

        // Still cut off at the cap: log it so the cap can be raised if it happens often.
        if ($response->json('stop_reason') === 'max_tokens') {
            Log::warning('ai.assistant.cut_off', ['question' => $question]);
        }

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

    /**
     * The chat shows plain text, so remove any Markdown the model still writes
     * (the rules ask it not to): **bold**, __bold__, `code`, "# " headings,
     * and "- " / "* " bullets become "• ".
     */
    private function plainText(string $text): string
    {
        $text = str_replace(['**', '__', '`'], '', $text);
        $text = preg_replace('/^#{1,6}\s+/m', '', $text);
        $text = preg_replace('/^(\s*)[-*]\s+/m', '$1• ', $text);

        return trim($text);
    }

    private function staticPrompt(): string
    {
        $rules = file_get_contents(resource_path('ai/assistant-rules.md'));
        $guide = file_get_contents(resource_path('ai/system-guide.md'));

        return $rules."\n<system_guide>\n".$guide."\n</system_guide>";
    }
}
