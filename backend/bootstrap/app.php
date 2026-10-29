<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnsureMembershipPermission;
use App\Http\Middleware\EnsureModuleEnabled;
use App\Http\Middleware\SetLocaleFromRequest;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // The same API again under /api/v1, named v1.*: new clients (the mobile app) use v1;
        // /api stays for the web app and older clients. A future v2 gets its own files.
        then: function () {
            Route::middleware('api')->prefix('api/v1')->name('v1.')->group(base_path('routes/api.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Before everything else, so even auth and company-status errors are translated.
        $middleware->prepend(SetLocaleFromRequest::class);
        // First of all, so every log line and error of the request carries its ID.
        $middleware->prepend(AssignRequestId::class);

        $middleware->alias([
            'company_permission' => EnsureMembershipPermission::class,
            'module' => EnsureModuleEnabled::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Logged errors say who hit them. Never let this lookup itself fail.
        $exceptions->context(function (): array {
            try {
                $user = Auth::user();
            } catch (Throwable) {
                return [];
            }

            return $user ? ['user_id' => $user->id, 'company_id' => $user->company_id] : [];
        });

        // One error shape for every client: Laravel's `message` (+ `errors` on 422),
        // plus a `code` the app can branch on and the `request_id` to search the logs.
        // A `code` already set (trial_expired, plan_limit_reached, …) is kept as is.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if (! $request->is('api/*') || ! $response instanceof JsonResponse) {
                return $response;
            }

            $data = $response->getData(true);
            if (! is_array($data)) {
                return $response;
            }

            $status = $response->getStatusCode();
            $data['code'] ??= match (true) {
                $status === 401 => 'unauthenticated',
                $status === 403 => 'forbidden',
                $status === 404 => 'not_found',
                $status === 422 => 'validation_failed',
                $status === 429 => 'too_many_requests',
                $status >= 500 => 'server_error',
                default => 'request_failed',
            };
            $data['request_id'] ??= $request->attributes->get('request_id');

            return $response->setData($data);
        });
    })->create();
