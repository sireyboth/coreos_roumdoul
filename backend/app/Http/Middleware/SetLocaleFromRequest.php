<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answers in the language the app is showing. The frontend sends its chosen
 * language (km or en) as Accept-Language on every request, so validation
 * errors and every __() message come back in that language: Khmer from
 * lang/km.json and lang/km/validation.php, English from the source text.
 *
 * Anything else (a browser, a script, no header) gets the app default.
 */
class SetLocaleFromRequest
{
    private const SUPPORTED = ['en', 'km'];

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->hasHeader('Accept-Language')) {
            $locale = $request->getPreferredLanguage(self::SUPPORTED);
            if ($locale !== null) {
                app()->setLocale($locale);
            }
        }

        return $next($request);
    }
}
