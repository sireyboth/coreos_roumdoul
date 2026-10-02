<?php

namespace App\Console\Commands\Attendance;

use App\Models\Company;
use App\Models\Employee;
use App\Services\Attendance\AttendanceRecorder;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

/**
 * Brings yesterday and today up to date for everyone. Run hourly: it's what
 * turns a work day nobody scanned into "absent", and a slot nobody answered
 * into "missing", once the day closes — nothing else would touch those days.
 */
class CloseDaysCommand extends Command
{
    protected $signature = 'attendance:close-days';

    protected $description = 'Recalculate yesterday and today for every employee, so absences and missing scans are recorded';

    public function handle(AttendanceRecorder $recorder): int
    {
        $count = 0;

        Company::query()->whereNotIn('status', ['suspended', 'cancelled'])->each(function (Company $company) use ($recorder, &$count) {
            $today = CarbonImmutable::now($company->timezone ?: config('attendance.default_timezone'));

            Employee::query()->withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->whereNotIn('employment_status', Employee::LEFT_STATUSES)
                ->each(function (Employee $employee) use ($recorder, $company, $today, &$count) {
                    $employee->setRelation('company', $company);
                    $recorder->recalculateRange($employee, $today->subDay()->toDateString(), $today->toDateString());
                    $count++;
                });
        });

        $this->info("Brought {$count} employee(s) up to date.");

        return self::SUCCESS;
    }
}
