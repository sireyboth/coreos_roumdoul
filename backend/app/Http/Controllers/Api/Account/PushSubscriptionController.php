<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\Push\PushSender;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Turning push notifications on and off for the device the request comes
 * from. A device belongs to whoever turned it on last: signing in as
 * someone else on a shared phone moves it to them, so alerts never reach
 * the previous person.
 */
class PushSubscriptionController extends Controller
{
    /** The public key the browser needs to subscribe; enabled false when push isn't set up on this server. */
    public function key(PushSender $sender)
    {
        return [
            'enabled' => $sender->enabled(),
            'public_key' => $sender->enabled() ? config('services.webpush.public_key') : null,
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url:https', 'max:2000'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'content_encoding' => ['nullable', 'in:aes128gcm,aesgcm'],
        ]);

        PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => PushSubscription::hashEndpoint($data['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['content_encoding'] ?? 'aes128gcm',
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ],
        );

        return response()->noContent();
    }

    /** Turning it off on this device (or signing out of it). Only ever removes the caller's own. */
    public function destroy(Request $request)
    {
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:2000']]);

        PushSubscription::query()
            ->where('user_id', $request->user()->id)
            ->where('endpoint_hash', PushSubscription::hashEndpoint($data['endpoint']))
            ->delete();

        return response()->noContent();
    }
}
