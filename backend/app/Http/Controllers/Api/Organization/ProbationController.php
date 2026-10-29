<?php

namespace App\Http\Controllers\Api\Organization;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Employee;
use App\Services\AuditLogger;
use App\Services\Employees\ProbationNotifier;
use App\Services\NotificationService;
use App\Support\SelfApproval;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Probation, all with employees.manage: the company's default length and
 * reminder (read through /me's company), and deciding on one person — pass
 * them (Active from today) or extend it to a later date.
 */
class ProbationController extends Controller
{
    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'probation_unit' => ['required', Rule::in(Company::PROBATION_UNITS)],
            // 0 = no default: HR types each end date.
            'probation_length' => ['required', 'integer', 'min:0', $request->input('probation_unit') === 'days' ? 'max:730' : 'max:24'],
            // null = only on the day it ends.
            'probation_reminder_days' => ['nullable', 'integer', 'between:1,90'],
        ]);

        $company = $request->user()->company;
        $before = $company->only(array_keys($data));
        $company->update($data);

        AuditLogger::record('company.settings_updated', $company, $data, beforeData: $before);

        return $company->only(['id', 'probation_length', 'probation_unit', 'probation_reminder_days']);
    }

    /** They passed: Active from today. Passed early, the end date becomes today, so the record shows when it really ended. */
    public function pass(Request $request, Employee $employee)
    {
        $this->assertOnProbation($request, $employee);

        $today = $this->today($request);
        $employee->update([
            'employment_status' => 'active',
            'probation_end_date' => $employee->probation_end_date && $employee->probation_end_date->toDateString() <= $today
                ? $employee->probation_end_date
                : $today,
        ]);
        $this->closeAlerts($request, $employee, 'passed');

        return $this->shown($employee);
    }

    /** More time: a later end date, and the reminders start again for it. */
    public function extend(Request $request, Employee $employee)
    {
        $this->assertOnProbation($request, $employee);

        $after = $employee->probation_end_date?->toDateString() ?? $employee->hire_date?->toDateString();
        $data = $request->validate([
            'probation_end_date' => ['required', 'date', ...($after ? ["after:{$after}"] : [])],
        ]);

        $employee->update(['probation_end_date' => $data['probation_end_date']]);
        $this->closeAlerts($request, $employee, 'extended');

        return $this->shown($employee);
    }

    private function assertOnProbation(Request $request, Employee $employee): void
    {
        if ($employee->employment_status !== 'probation') {
            throw ValidationException::withMessages(['employment_status' => [__(':name is not on probation.', ['name' => $employee->name])]]);
        }

        SelfApproval::assertNotSelf($request->user(), $employee, 'employment_status', 'decide the probation of');
    }

    private function closeAlerts(Request $request, Employee $employee, string $resolution): void
    {
        foreach ([ProbationNotifier::ENDING, ProbationNotifier::ENDED] as $type) {
            NotificationService::resolve($employee, $type, $resolution, $request->user());
        }
    }

    private function today(Request $request): string
    {
        return CarbonImmutable::now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();
    }

    private function shown(Employee $employee): Employee
    {
        return $employee->fresh(['branch', 'department', 'team', 'manager'])->makeVisible(['probation_end_date']);
    }
}
