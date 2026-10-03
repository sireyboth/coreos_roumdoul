<?php

namespace App\Console\Commands\Attendance;

use App\Models\AttendanceEvent;
use App\Models\Company;
use App\Models\Employee;
use App\Services\Attendance\AttendanceRecorder;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

/**
 * Recalculates attendance days from the raw scans over a date range. Run it
 * once after upgrading to work schedules (it turns existing check-ins into
 * day records), or after a bulk change of schedules. Locked months are left
 * alone. Safe to run more than once.
 */
class RebuildCommand extends Command
{
    protected $signature = 'attendance:rebuild
        {--from= : First date (YYYY-MM-DD); defaults to each company\'s first scan}
        {--to= : Last date (YYYY-MM-DD); defaults to today}
        {--company= : Only this company id}';

    protected $description = 'Recalculate attendance days from the recorded scans';

    public function handle(AttendanceRecorder $recorder): int
    {
        $companies = Company::query()->when($this->option('company'), fn ($q, $id) => $q->whereKey($id))->get();

        foreach ($companies as $company) {
            $today = CarbonImmutable::now($company->timezone ?: config('attendance.default_timezone'))->toDateString();
            $firstScan = AttendanceEvent::query()->withoutGlobalScopes()->whereNull('deleted_at')->where('company_id', $company->id)->min('event_time');
            $from = $this->option('from') ?: ($firstScan ? CarbonImmutable::parse($firstScan)->toDateString() : $today);
            $to = min($this->option('to') ?: $today, $today);

            if ($from > $to) {
                continue;
            }

            $employees = Employee::query()->withoutGlobalScopes()->where('company_id', $company->id)->get();
            $this->line("{$company->name}: {$employees->count()} employee(s), {$from} to {$to}");

            $bar = $this->output->createProgressBar($employees->count());
            foreach ($employees as $employee) {
                $employee->setRelation('company', $company);
                // A month at a time keeps each pass's scan query small.
                for ($month = CarbonImmutable::parse($from)->startOfMonth(); $month->toDateString() <= $to; $month = $month->addMonth()) {
                    $recorder->recalculateRange($employee, max($from, $month->toDateString()), min($to, $month->endOfMonth()->toDateString()));
                }
                $bar->advance();
            }
            $bar->finish();
            $this->newLine();
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}
