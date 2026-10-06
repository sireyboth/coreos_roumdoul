<?php

namespace App\Services\Attendance;

use App\Models\Company;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * Brings a company's recent days up to date for everyone: turns a work day
 * nobody scanned into "absent", an unanswered slot into "missing", and fills
 * in automatic-attendance slots as their times pass. Nothing else touches
 * those days, since no scan arrives for them.
 *
 * Runs from the hourly attendance:close-days command when a scheduler is set
 * up, and on its own from ordinary API traffic (CatchUpAttendance middleware)
 * when it isn't — so it works on hosts without cron.
 */
class AttendanceCatchUp
{
    /** How long a company is considered up to date after a catch-up. */
    public const INTERVAL_MINUTES = 15;

    /** How far back a catch-up reaches after a long quiet spell. */
    private const MAX_DAYS_BACK = 31;

    public function __construct(private readonly AttendanceRecorder $recorder) {}

    /** Catches the company up unless that was done in the last few minutes. */
    public function runIfDue(Company $company): void
    {
        if (Cache::add($this->dueKey($company), true, now()->addMinutes(self::INTERVAL_MINUTES))) {
            $this->run($company);
        }
    }

    /**
     * Recalculates every current employee from the last day caught up (at
     * least yesterday) through today. Returns how many employees were touched.
     */
    public function run(Company $company): int
    {
        $today = CarbonImmutable::now($company->timezone ?: config('attendance.default_timezone'))->startOfDay();
        $last = Cache::get($this->lastKey($company));

        $from = $today->subDay();
        if ($last && $last < $from->toDateString()) {
            $from = max(CarbonImmutable::parse($last, $today->timezone), $today->subDays(self::MAX_DAYS_BACK));
        }

        $count = 0;
        Employee::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereNotIn('employment_status', Employee::LEFT_STATUSES)
            ->each(function (Employee $employee) use ($company, $from, $today, &$count) {
                $employee->setRelation('company', $company);
                $this->recorder->recalculateRange($employee, $from->toDateString(), $today->toDateString());
                $count++;
            });

        Cache::forever($this->lastKey($company), $today->toDateString());

        return $count;
    }

    private function dueKey(Company $company): string
    {
        return "attendance:catch-up-due:{$company->id}";
    }

    private function lastKey(Company $company): string
    {
        return "attendance:caught-up-to:{$company->id}";
    }
}
