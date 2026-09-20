<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The other half of the module/subscription/entitlement system built in
 * Stage 1: Company::hasModule() decided whether a company *should* see a
 * module as unlocked. This is what actually stops them from using it if
 * they don't. Every module's routes get one of these, e.g.
 * ->middleware('module:attendance').
 */
class EnsureModuleEnabled
{
    public function handle(Request $request, Closure $next, string $moduleKey): Response
    {
        $company = $request->user()?->company;

        abort_unless($company?->hasModule($moduleKey), 403, "Your plan doesn't include the \"{$moduleKey}\" module.");

        return $next($request);
    }
}
