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

];
