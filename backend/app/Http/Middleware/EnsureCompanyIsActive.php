<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A platform admin pausing/cancelling a company (Company::status) should
 * actually cut that company off from the API, not just record the status —
 * this is the enforcement side of that field.
 */
class EnsureCompanyIsActive
{
    private const BLOCKED_STATUSES = ['suspended', 'cancelled'];

    public function handle(Request $request, Closure $next): Response
    {
        $company = $request->user()?->company;

        abort_if(
            in_array($company?->status, self::BLOCKED_STATUSES, true),
            403,
            "This company's account has been {$company?->status}. Contact support.",
        );

        abort_if(
            $company?->isTrialExpired(),
            403,
            'Your trial has ended. Please upgrade your plan to continue.',
        );

        return $next($request);
    }
}
