<?php

namespace App\Console\Commands\Attendance;

use App\Services\AttendanceService;
use Illuminate\Console\Command;

class CloseStaleSessionsCommand extends Command
{
    protected $signature = 'attendance:close-stale';

    protected $description = 'Mark shifts that were never checked out of as "missing_checkout" so managers can correct them';

    public function handle(AttendanceService $attendance): int
    {
        $count = $attendance->closeStaleSessions();

        $this->info("Marked {$count} shift(s) as missing a check-out.");

        return self::SUCCESS;
    }
}
