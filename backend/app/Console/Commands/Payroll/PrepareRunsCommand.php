<?php

namespace App\Console\Commands\Payroll;

use App\Services\Payroll\PayRunService;
use Illuminate\Console\Command;

/**
 * Prepares the pay run for each "calculate automatically" pay group once its
 * period is over: created and calculated, never approved — someone still
 * checks and approves it.
 */
class PrepareRunsCommand extends Command
{
    protected $signature = 'payroll:prepare-runs';

    protected $description = 'Create and calculate the pay run of every automatic pay group whose period just ended';

    public function handle(PayRunService $runs): int
    {
        $created = $runs->prepareDue();

        $this->info("Prepared {$created->count()} pay run(s).");

        return self::SUCCESS;
    }
}
