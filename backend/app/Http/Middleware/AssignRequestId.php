<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives every request one ID, so a problem a client reports can be found in
 * the logs. The ID goes on every log line written during the request, comes
 * back in the X-Request-Id header, and is added to every API error body.
 *
 * A caller (the web app, the phone app, a proxy) may send its own X-Request-Id;
 * it is kept only when it looks like an ID, so nothing odd lands in the logs.
 */
class AssignRequestId
{
    public const HEADER = 'X-Request-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $incoming = (string) $request->header(self::HEADER);
        $id = preg_match('/^[A-Za-z0-9-]{8,64}$/', $incoming) ? $incoming : (string) Str::uuid();

        $request->attributes->set('request_id', $id);
        Log::withContext(['request_id' => $id]);

        $response = $next($request);
        $response->headers->set(self::HEADER, $id);

        return $response;
    }
}
