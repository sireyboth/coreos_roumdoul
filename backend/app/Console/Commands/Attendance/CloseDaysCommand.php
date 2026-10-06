<?php

namespace App\Console\Commands\Attendance;

use App\Models\Company;
use App\Services\Attendance\AttendanceCatchUp;
use Illuminate\Console\Command;

/**
 * Brings recent days up to date for everyone. Run hourly when a scheduler is
 * available: it's what turns a work day nobody scanned into "absent", and a
 * slot nobody answered into "missing", once the day closes. Without cron the
 * same catch-up runs from API traffic (CatchUpAttendance middleware).
 */
class CloseDaysCommand extends Command
{
    protected $signature = 'attendance:close-days';

    protected $description = 'Recalculate recent days for every employee, so absences and missing scans are recorded';

    public function handle(AttendanceCatchUp $catchUp): int
    {
        $count = 0;

        Company::query()->whereNotIn('status', ['suspended', 'cancelled'])->each(function (Company $company) use ($catchUp, &$count) {
            $count += $catchUp->run($company);
        });

        $this->info("Brought {$count} employee(s) up to date.");

        return self::SUCCESS;
    }
}
