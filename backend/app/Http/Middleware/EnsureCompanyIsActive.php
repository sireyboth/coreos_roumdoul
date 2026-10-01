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

        // A membership whose company is gone: it was deleted (soft-deleted, e.g.
        // from the admin panel) while its people were still signed in. A user
        // with no membership at all isn't affected — only their own profile is
        // reachable, and nothing there needs a company.
        if ($request->user()?->company_id !== null && ! $company) {
            return response()->json([
                'message' => "This company's account no longer exists. Contact support.",
                'code' => 'company_deleted',
            ], 403);
        }

        if (in_array($company?->status, self::BLOCKED_STATUSES, true)) {
            return response()->json([
                'message' => "This company's account has been {$company->status}. Contact support.",
                'code' => "company_{$company->status}",
            ], 403);
        }

        if ($company?->isTrialExpired()) {
            return response()->json([
                'message' => 'Your trial has ended. Please upgrade your plan to continue.',
                'code' => 'trial_expired',
            ], 403);
        }

        return $next($request);
    }
}
