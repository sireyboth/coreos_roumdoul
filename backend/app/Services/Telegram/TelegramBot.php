<?php

namespace App\Services\Telegram;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * The platform's one Telegram bot — a thin client for the few Bot API calls
 * we use. Off (enabled() = false) until TELEGRAM_BOT_TOKEN is set.
 * https://core.telegram.org/bots/api
 */
class TelegramBot
{
    public function enabled(): bool
    {
        return filled(config('services.telegram.bot_token')) && filled(config('services.telegram.bot_username'));
    }

    public function username(): ?string
    {
        return config('services.telegram.bot_username');
    }

    /** Plain text (no Markdown), so names with * or _ never break a message. */
    public function sendMessage(string $chatId, string $text): Response
    {
        return $this->call('sendMessage', [
            'chat_id' => $chatId,
            'text' => $text,
            'disable_web_page_preview' => true,
        ]);
    }

    /** Points Telegram at our webhook; it sends `secret` back on every update. */
    public function setWebhook(string $url, string $secret): Response
    {
        return $this->call('setWebhook', [
            'url' => $url,
            'secret_token' => $secret,
            'allowed_updates' => ['message', 'my_chat_member'],
        ]);
    }

    /** Best effort: the bot leaves a group the company disconnected. */
    public function leaveChat(string $chatId): Response
    {
        return $this->call('leaveChat', ['chat_id' => $chatId]);
    }

    /**
     * Long polling (local dev, no public address): waits up to `wait` seconds
     * for updates after `offset`. Telegram refuses it while a webhook is set.
     */
    public function getUpdates(int $offset, int $wait = 25): Response
    {
        return $this->call('getUpdates', [
            'offset' => $offset,
            'timeout' => $wait,
            'allowed_updates' => ['message', 'my_chat_member'],
        ], $wait + 10);
    }

    /** Removes the webhook, so getUpdates can be used instead. */
    public function deleteWebhook(): Response
    {
        return $this->call('deleteWebhook', []);
    }

    /**
     * Every call is a POST over HTTPS with the data in the body. Telegram puts
     * the bot token in the URL, and a connection error's message repeats that
     * URL — so it is re-thrown with the token blanked, and never reaches a log.
     *
     * @param  array<string, mixed>  $payload
     */
    private function call(string $method, array $payload, int $timeout = 10): Response
    {
        $token = (string) config('services.telegram.bot_token');

        try {
            return Http::timeout($timeout)
                ->acceptJson()
                ->post("https://api.telegram.org/bot{$token}/{$method}", $payload);
        } catch (ConnectionException $e) {
            throw new ConnectionException(self::redact($e->getMessage(), $token), (int) $e->getCode());
        }
    }

    /** The token, wherever it appears in $text, becomes three stars. */
    public static function redact(string $text, string $token): string
    {
        return $token === '' ? $text : str_replace($token, '***', $text);
    }
}
