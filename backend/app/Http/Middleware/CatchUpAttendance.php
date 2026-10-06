<?php

namespace App\Http\Middleware;

use App\Services\Attendance\AttendanceCatchUp;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps attendance current without a cron job: at most every few minutes per
 * company, a request from one of its people triggers a catch-up — after the
 * response has been sent, so nobody waits for it.
 */
class CatchUpAttendance
{
    public function __construct(private readonly AttendanceCatchUp $catchUp) {}

    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $company = $request->user()?->company;

        if (! config('attendance.catch_up_on_requests') || ! $company ||in_array($company->status, ['suspended', 'cancelled'], true)) {
            return;
        }

        try {
            $this->catchUp->runIfDue($company);
        } catch (\Throwable $e) {
            report($e); // never let background upkeep break a request
        }
    }
}
