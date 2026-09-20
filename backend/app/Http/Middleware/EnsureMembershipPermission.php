<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Replaces Spatie's `permission:{code},sanctum` route middleware now that
 * permissions are checked against the authenticated user's company
 * membership rather than a Spatie "team" role.
 */
class EnsureMembershipPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        abort_unless($request->user()?->hasCompanyPermission($permission), 403);

        return $next($request);
    }
}
