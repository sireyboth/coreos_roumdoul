<?php

namespace App\Console\Commands\Birthdays;

use App\Models\Company;
use App\Services\BirthdayNotifier;
use Illuminate\Console\Command;

/**
 * Sends today's birthday alerts. Run hourly: each company's alerts go out on
 * the first run from 8:00 in its own timezone, and never twice.
 */
class NotifyCommand extends Command
{
    protected $signature = 'birthdays:notify';

    protected $description = "Send today's birthday alerts to the birthday person and their branch";

    public function handle(BirthdayNotifier $notifier): int
    {
        $count = 0;

        Company::query()->whereNotIn('status', ['suspended', 'cancelled'])->each(function (Company $company) use ($notifier, &$count) {
            $count += $notifier->run($company);
        });

        $this->info("Sent {$count} birthday alert(s).");

        return self::SUCCESS;
    }
}
