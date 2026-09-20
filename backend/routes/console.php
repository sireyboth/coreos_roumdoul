<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// A forgotten check-out is flagged for a manager to fix, not left "open" forever.
Schedule::command('attendance:close-stale')->hourly();
