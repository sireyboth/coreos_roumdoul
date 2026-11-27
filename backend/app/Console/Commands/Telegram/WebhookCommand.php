<?php

namespace App\Console\Commands\Telegram;

use App\Services\Telegram\TelegramBot;
use Illuminate\Console\Command;

/**
 * Tells Telegram where to send the bot's updates. Run once per server after
 * setting TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET
 * (and again if the address changes). Telegram needs a public https address.
 */
class WebhookCommand extends Command
{
    protected $signature = 'telegram:webhook {url? : defaults to APP_URL/api/telegram/webhook}';

    protected $description = 'Register the Telegram bot webhook';

    public function handle(TelegramBot $bot): int
    {
        $secret = (string) config('services.telegram.webhook_secret');

        if (! $bot->enabled() || $secret === '') {
            $this->error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET first.');

            return self::FAILURE;
        }

        $url = $this->argument('url') ?: rtrim((string) config('app.url'), '/').'/api/telegram/webhook';
        $response = $bot->setWebhook($url, $secret);

        if (! $response->successful()) {
            $this->error('Telegram refused: '.($response->json('description') ?? $response->status()));

            return self::FAILURE;
        }

        $this->info("Webhook set: {$url}");

        return self::SUCCESS;
    }
}
