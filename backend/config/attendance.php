<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Missing check-out cutoff
    |--------------------------------------------------------------------------
    |
    | A shift still open this many hours after its check-in is treated as
    | forgotten: it's marked "missing_checkout" instead of blocking the
    | employee's next check-in. Long enough to cover a normal overnight
    | shift, short enough that a forgotten check-out doesn't linger.
    |
    */

    'stale_after_hours' => (int) env('ATTENDANCE_STALE_AFTER_HOURS', 16),

    /*
    |--------------------------------------------------------------------------
    | Require a scheduled shift to check in
    |--------------------------------------------------------------------------
    |
    | When on, an employee with no roster entry for today can't check in —
    | lateness and worked hours have no meaning without a shift. Turn it off
    | (ATTENDANCE_REQUIRE_SCHEDULE=false) while a company is still building
    | its first roster, otherwise nobody could check in until it exists.
    |
    */

    'require_schedule' => (bool) env('ATTENDANCE_REQUIRE_SCHEDULE', true),

    // Used when a company has no timezone set.
    'default_timezone' => 'Asia/Phnom_Penh',

    /*
    |--------------------------------------------------------------------------
    | Matching scans to a work schedule's slots
    |--------------------------------------------------------------------------
    |
    | duplicate_scan_minutes: two scans this close together are one (a double
    | tap on the scanner). max_match_minutes: a scan further than this from
    | a slot can't be that slot's scan. A slot with no scan is "pending"
    | until missing_after_minutes past its time, then "missing". A day is
    | final (closed) close_after_minutes after its last slot — that's when
    | unanswered slots and absences become definite.
    |
    */

    'duplicate_scan_minutes' => (int) env('ATTENDANCE_DUPLICATE_SCAN_MINUTES', 2),
    'max_match_minutes' => (int) env('ATTENDANCE_MAX_MATCH_MINUTES', 360),
    'missing_after_minutes' => (int) env('ATTENDANCE_MISSING_AFTER_MINUTES', 120),
    'close_after_minutes' => (int) env('ATTENDANCE_CLOSE_AFTER_MINUTES', 240),

    /*
    |--------------------------------------------------------------------------
    | Catch up from API traffic
    |--------------------------------------------------------------------------
    |
    | Absences, missing scans and automatic-attendance slots only appear when
    | a day is recalculated, and nothing scans on those days. The hourly
    | attendance:close-days command does it where cron exists; with this on,
    | ordinary requests also do it (at most every 15 minutes per company,
    | after the response is sent), so hosts without cron stay current.
    |
    */

    'catch_up_on_requests' => (bool) env('ATTENDANCE_CATCH_UP_ON_REQUESTS', true),

    // Hours counted as night work (for payroll), on the company's clock.
    'night_start' => env('ATTENDANCE_NIGHT_START', '22:00'),
    'night_end' => env('ATTENDANCE_NIGHT_END', '05:00'),

];
