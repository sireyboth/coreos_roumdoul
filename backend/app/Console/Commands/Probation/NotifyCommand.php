<?php

namespace App\Console\Commands\Probation;

use App\Models\Company;
use App\Services\Employees\ProbationNotifier;
use Illuminate\Console\Command;

/**
 * Tells HR about probations ending soon or already over. Run hourly: each
 * company's alerts go out on the first run from 8:00 in its own timezone,
 * and never twice.
 */
class NotifyCommand extends Command
{
    protected $signature = 'probation:notify';

    protected $description = 'Remind HR about probations that are ending or have ended';

    public function handle(ProbationNotifier $notifier): int
    {
        $count = 0;

        Company::query()->whereNotIn('status', ['suspended', 'cancelled'])->each(function (Company $company) use ($notifier, &$count) {
            $count += $notifier->run($company);
        });

        $this->info("Sent {$count} probation alert(s).");

        return self::SUCCESS;
    }
}
