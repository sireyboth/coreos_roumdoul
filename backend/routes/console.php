<?php

use App\Models\Notification;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Turns unscanned work days into absences and unanswered slots into missing scans once each day closes.
Schedule::command('attendance:close-days')->hourly();

// Birthday alerts: each company's go out on the first run from 8:00 in its timezone (never twice).
Schedule::command('birthdays:notify')->hourly();

// Clears read alerts older than 90 days (unread ones are kept).
Schedule::command('model:prune', ['--model' => [Notification::class]])->daily();
