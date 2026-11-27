<?php

namespace App\Console\Commands\Telegram;

use App\Services\Telegram\TelegramBot;
use App\Services\Telegram\TelegramConnector;
use Illuminate\Console\Command;

/**
 * Local development without a public address: instead of Telegram calling
 * our webhook, this asks Telegram for new updates (long polling) and hands
 * each one to the same TelegramConnector the webhook uses. Runs until Ctrl+C.
 *
 * Not for servers — there, use `php artisan telegram:webhook`. Starting this
 * removes the webhook, because Telegram allows only one of the two at a time.
 */
class PollCommand extends Command
{
    protected $signature = 'telegram:poll {--once : handle one batch of updates, then stop}';

    protected $description = 'Receive Telegram bot updates by polling (local development)';

    public function handle(TelegramBot $bot, TelegramConnector $connector): int
    {
        if (! $bot->enabled()) {
            $this->error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME first.');

            return self::FAILURE;
        }

        $bot->deleteWebhook();
        $this->info('Listening for @'.$bot->username().' … (Ctrl+C to stop)');

        $offset = 0;

        do {
            $response = $bot->getUpdates($offset, $this->option('once') ? 0 : 25);

            if (! $response->successful()) {
                if ($this->option('once')) {
                    $this->error('Telegram: '.($response->json('description') ?? $response->status()));

                    return self::FAILURE;
                }
                $this->warn('Telegram: '.($response->json('description') ?? $response->status()).' — retrying in 5 s');
                sleep(5);

                continue;
            }

            foreach ((array) $response->json('result', []) as $update) {
                $offset = (int) $update['update_id'] + 1;
                $this->line('Update '.$update['update_id'].': '.$this->describe($update));
                $connector->handle($update);
            }
        } while (! $this->option('once'));

        return self::SUCCESS;
    }

    /**
     * One line per update for the console.
     *
     * @param  array<string, mixed>  $update
     */
    private function describe(array $update): string
    {
        if (isset($update['my_chat_member'])) {
            return 'bot is now '.data_get($update, 'my_chat_member.new_chat_member.status').' in "'.data_get($update, 'my_chat_member.chat.title').'"';
        }

        return '"'.data_get($update, 'message.text', '(no text)').'" in "'.data_get($update, 'message.chat.title', 'private chat').'"';
    }
}
