<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Employee;
use App\Services\Attendance\AttendanceNotifier;
use Carbon\CarbonImmutable;

/**
 * Tells HR (employees.manage for the person's branch) when someone's
 * probation is about to end, so they decide in time: pass them or extend it.
 * From SEND_FROM_HOUR in the company's timezone:
 *
 *  - ending  → once, from probation_reminder_days before the end date
 *  - ended   → once, from the end date while they are still on probation
 *
 * The dedupe key holds the end date, so extending probation brings both
 * alerts back for the new date. Passing someone closes their alerts (see
 * ProbationController).
 */
class ProbationNotifier
{
    public const ENDING = 'probation_ending';

    public const ENDED = 'probation_ended';

    public const SEND_FROM_HOUR = 8;

    public function __construct(private readonly AttendanceNotifier $directory) {}

    /** Sends the alerts due today for $company. Returns how many alerts were sent. */
    public function run(Company $company, ?CarbonImmutable $now = null): int
    {
        $now = ($now ?? CarbonImmutable::now())->setTimezone($company->timezone ?: config('attendance.default_timezone'));

        if ($now->hour < self::SEND_FROM_HOUR) {
            return 0;
        }

        $today = $now->toDateString();
        $remindFrom = $now->addDays($company->probation_reminder_days ?? 0)->toDateString();

        $employees = Employee::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('employment_status', 'probation')
            ->whereNotNull('probation_end_date')
            ->whereDate('probation_end_date', '<=', $remindFrom)
            ->with('currentAssignment:id,employee_id,branch_id')
            ->get();

        $sent = 0;

        foreach ($employees as $employee) {
            $end = $employee->probation_end_date->toDateString();
            $ended = $end <= $today;
            $type = $ended ? self::ENDED : self::ENDING;
            $date = $employee->probation_end_date->format('j M Y');
            $title = $ended
                ? "{$employee->name}'s probation has ended"
                : "{$employee->name}'s probation ends on {$date}";
            $body = $ended
                ? "It ended on {$date}. Open their profile to pass them or extend probation."
                : 'Decide before then: pass them or extend probation.';

            foreach ($this->directory->managersFor($employee, permission: 'employees.manage') as $hr) {
                if ($hr->id === $employee->user_id) {
                    continue;
                }

                NotificationService::send(
                    $hr, $type, $title, $body,
                    data: ['employee_id' => $employee->id, 'employee_name' => $employee->name, 'probation_end_date' => $end],
                    subject: $employee,
                    link: "/dashboard/employees/{$employee->id}",
                    dedupeKey: "{$type}:{$employee->id}:{$hr->id}:{$end}",
                );
                $sent++;
            }
        }

        return $sent;
    }
}
