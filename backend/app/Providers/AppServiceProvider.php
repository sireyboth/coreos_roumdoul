<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Sign-in attempts. Employee IDs are easy to guess (E-001, E-002...), so
        // guessing passwords must be slow: a few tries a minute per person+device,
        // and a looser cap per device so one office isn't locked out by shared wifi.
        RateLimiter::for('login', function (Request $request) {
            $who = mb_strtolower(trim((string) ($request->input('email') ?: $request->input('company').'|'.$request->input('employee_id'))));
            $tooMany = fn (Request $request, array $headers) => response()->json(
                ['message' => 'Too many sign-in attempts. Please wait a minute and try again.'],
                429,
                $headers,
            );

            return [
                Limit::perMinute(8)->by($who.'|'.$request->ip())->response($tooMany),
                Limit::perMinute(60)->by($request->ip())->response($tooMany),
            ];
        });
    }
}
