<?php

namespace App\Http\Controllers\Api\Telegram;

use App\Http\Controllers\Controller;
use App\Services\Telegram\TelegramConnector;
use Illuminate\Http\Request;

/**
 * Telegram's webhook — the one public route that isn't a sign-in. Only
 * Telegram knows the secret it sends back in X-Telegram-Bot-Api-Secret-Token
 * (set by `php artisan telegram:webhook`); anything else gets a 404, as if
 * the route weren't there. Always answers 200 to Telegram, or it retries.
 */
class TelegramWebhookController extends Controller
{
    public function __invoke(Request $request, TelegramConnector $connector)
    {
        $secret = (string) config('services.telegram.webhook_secret');

        abort_if($secret === '' || ! hash_equals($secret, (string) $request->header('X-Telegram-Bot-Api-Secret-Token')), 404);

        $connector->handle($request->all());

        return response()->json(['ok' => true]);
    }
}
