<?php

namespace App\Console\Commands\Attendance;

use App\Models\Company;
use App\Services\Attendance\LateWarningNotifier;
use Illuminate\Console\Command;

/**
 * Warns employees and HR about repeated lateness. Run hourly: only companies
 * that turned warnings on, from 8:00 in their own timezone, and each warning
 * only once (see LateWarningNotifier).
 */
class LateWarningsCommand extends Command
{
    protected $signature = 'attendance:late-warnings';

    protected $description = 'Warn employees and HR when someone is late too often this month';

    public function handle(LateWarningNotifier $notifier): int
    {
        $count = 0;

        Company::query()
            ->whereNotIn('status', ['suspended', 'cancelled'])
            ->whereNotNull('late_warning_limit')
            ->each(function (Company $company) use ($notifier, &$count) {
                $count += $notifier->run($company);
            });

        $this->info("Sent {$count} late warning(s).");

        return self::SUCCESS;
    }
}
