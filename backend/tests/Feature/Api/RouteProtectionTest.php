<?php

namespace Tests\Feature\Api;

use App\Http\Middleware\EnsureCompanyIsActive;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Guards the route files in routes/api/: a route moved out of its group, or a
 * new module file loaded in the wrong place, must not end up open to anyone.
 */
class RouteProtectionTest extends TestCase
{
    /** Reachable without signing in, on purpose. Anything new here needs a reason. */
    private const PUBLIC = [
        'GET api/health',
        'POST api/auth/register',
        'POST api/auth/login',
    ];

    /** Opened by <img> or a new tab, so a short-lived signed link stands in for the token. */
    private const SIGNED = [
        'GET api/employees/{employee}/photo',
        'GET api/attachments/{attachment}',
    ];

    public function test_every_api_route_needs_a_sign_in_or_a_signed_link(): void
    {
        $open = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/')) {
                continue;
            }

            $middleware = $route->gatherMiddleware();
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $key = "{$method} {$route->uri()}";

                if (in_array($key, self::PUBLIC, true)) {
                    continue;
                }
                if (in_array($key, self::SIGNED, true)) {
                    $this->assertContains('signed:relative', $middleware, "{$key} must be a signed link.");

                    continue;
                }
                if (! in_array('auth:sanctum', $middleware, true)) {
                    $open[] = $key;
                }
            }
        }

        $this->assertSame([], $open, 'These API routes are open without sign-in.');
    }

    public function test_company_routes_check_the_company_is_active(): void
    {
        // Only the few that must work for a paused company (to see why and log out) skip it.
        $allowed = ['GET api/user', 'GET api/me', 'POST api/auth/logout'];
        $missing = [];

        foreach (Route::getRoutes() as $route) {
            $middleware = $route->gatherMiddleware();
            if (! str_starts_with($route->uri(), 'api/') || ! in_array('auth:sanctum', $middleware, true)) {
                continue;
            }

            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $key = "{$method} {$route->uri()}";
                if (! in_array($key, $allowed, true) && ! in_array(EnsureCompanyIsActive::class, $middleware, true)) {
                    $missing[] = $key;
                }
            }
        }

        $this->assertSame([], $missing, 'These routes skip the active-company check.');
    }
}
