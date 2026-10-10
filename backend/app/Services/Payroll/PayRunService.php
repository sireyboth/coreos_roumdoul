<?php

namespace App\Services\Payroll;

use App\Models\Company;
use App\Models\PayrollAdjustment;
use App\Models\PayRun;
use App\Models\Payslip;
use App\Models\PayslipLine;
use App\Models\User;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\MonthlyAttendance;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A month's pay run: draft → calculated → approved → paid.
 *
 * Calculating replaces every payslip, as often as needed. Approving needs
 * the month's attendance locked (so the numbers can't move underneath it),
 * recalculates one last time, and refuses while any payslip has a blocking
 * warning. After that nothing changes: fixes go into a later month as adjustments.
 */
class PayRunService
{
    public function __construct(
        private readonly PayrollCalculator $calculator,
        private readonly AttendanceRecorder $recorder,
    ) {}

    public function create(Company $company, string $month, User $by): PayRun
    {
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        if ($month > now($timezone)->format('Y-m')) {
            throw ValidationException::withMessages(['month' => ['Payroll can\'t be run for a month that hasn\'t started.']]);
        }
        if (PayRun::query()->withoutGlobalScopes()->where('company_id', $company->id)->where('month', $month)->exists()) {
            throw ValidationException::withMessages(['month' => ['There is already a pay run for '.CarbonImmutable::parse("{$month}-01")->format('F Y').'.']]);
        }

        $run = PayRun::query()->create(['company_id' => $company->id, 'month' => $month, 'status' => 'draft']);

        return $this->calculate($run, $by);
    }

    public function calculate(PayRun $run, User $by): PayRun
    {
        $this->assertEditable($run);

        $company = $run->company;
        $ctx = $this->calculator->context($company, $run->month);
        $employees = $this->calculator->employees($company, $run->month);
        $attendance = MonthlyAttendance::for($company, $employees, $ctx['start']);
        $adjustments = PayrollAdjustment::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)->where('month', $run->month)
            ->orderBy('id')->get()->groupBy('employee_id');

        $results = $employees->map(fn ($employee) => [
            'employee' => $employee,
            'result' => $this->calculator->calculate($ctx, $employee, $attendance->get($employee->id), $adjustments->get($employee->id, collect())),
        ]);

        $skipped = $results->filter(fn ($r) => isset($r['result']['skipped']));
        $payslips = $results->reject(fn ($r) => isset($r['result']['skipped']))->pluck('result');

        $warnings = [];
        if ($skipped->isNotEmpty()) {
            $warnings[] = [
                'code' => 'no_salary', 'blocking' => false,
                'message' => $skipped->count().' '.($skipped->count() === 1 ? 'employee has' : 'employees have').' no salary for this month and '.($skipped->count() === 1 ? 'is' : 'are').' left out: '
                    .$skipped->take(10)->map(fn ($r) => $r['employee']->name)->join(', ').($skipped->count() > 10 ? '…' : '').'.',
                'employee_ids' => $skipped->map(fn ($r) => $r['employee']->id)->values()->all(),
            ];
        }
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $this->recorder->forgetLocks();
        if ($ctx['end']->toDateString() >= now($timezone)->toDateString()) {
            $warnings[] = ['code' => 'month_not_over', 'blocking' => true, 'message' => 'The month isn\'t over yet, so these numbers are a preview.'];
        } elseif (! $this->recorder->isLocked($company->id, $ctx['start']->toDateString())) {
            $warnings[] = ['code' => 'attendance_unlocked', 'blocking' => true, 'message' => 'Attendance for this month isn\'t locked yet. Lock it in Attendance before approving, so the numbers can\'t change.'];
        }

        DB::transaction(function () use ($run, $payslips, $warnings, $ctx, $by) {
            $run->payslips()->delete();

            foreach ($payslips as $result) {
                $payslip = Payslip::query()->create([
                    ...collect($result)->except('lines')->all(),
                    'company_id' => $run->company_id,
                    'pay_run_id' => $run->id,
                ]);

                PayslipLine::query()->insert(array_map(fn ($line) => [
                    ...$line,
                    'payslip_id' => $payslip->id,
                    'details' => $line['details'] === null ? null : json_encode($line['details']),
                ], $result['lines']));
            }

            $run->update([
                'status' => 'calculated',
                'warnings' => $warnings,
                'totals' => $this->totals($payslips->all()),
                'policy_snapshot' => [
                    'policy' => $ctx['policy']->only(['rate_basis', 'rate_basis_days', 'hours_per_day', 'missing_scan_policy', 'daily_paid_holidays', 'khr_rounding', 'fallback_exchange_rate']),
                    'components' => $ctx['components']->map->only(['code', 'name', 'kind', 'method', 'template', 'params', 'taxable', 'nssf_insurable'])->values()->all(),
                    'exchange_rate' => $ctx['exchange_rate'],
                    'exchange_rate_source' => $ctx['exchange_rate_source'],
                    'tax' => $ctx['tax'],
                    'nssf' => $ctx['nssf'],
                ],
                'calculated_at' => now(),
                'calculated_by' => $by->id,
            ]);
        });

        return $run->fresh();
    }

    public function approve(PayRun $run, User $by): PayRun
    {
        if ($run->status !== 'calculated') {
            throw ValidationException::withMessages(['status' => ['Only a calculated pay run can be approved.']]);
        }

        // Once more against the final (locked) attendance, so what is approved is exactly what was checked.
        $run = $this->calculate($run, $by);

        $blocking = collect($run->warnings)->where('blocking', true);
        $payslipBlocking = $run->payslips()->get()->filter(fn (Payslip $p) => collect($p->warnings)->contains('blocking', true));

        if ($blocking->isNotEmpty() || $payslipBlocking->isNotEmpty()) {
            throw ValidationException::withMessages(['status' => [
                $blocking->pluck('message')->first()
                    ?? $payslipBlocking->count().' '.($payslipBlocking->count() === 1 ? 'payslip has' : 'payslips have').' a problem to fix before approving.',
            ]]);
        }

        $run->update(['status' => 'approved', 'approved_at' => now(), 'approved_by' => $by->id]);
        AuditLogger::record('pay_run.approved', $run, ['month' => $run->month, 'totals' => $run->totals]);

        return $run->fresh();
    }

    public function markPaid(PayRun $run, User $by): PayRun
    {
        if ($run->status !== 'approved') {
            throw ValidationException::withMessages(['status' => ['Only an approved pay run can be marked as paid.']]);
        }

        $run->update(['status' => 'paid', 'paid_at' => now(), 'paid_by' => $by->id]);

        return $run->fresh();
    }

    public function delete(PayRun $run): void
    {
        $this->assertEditable($run);
        $run->delete();
    }

    private function assertEditable(PayRun $run): void
    {
        if ($run->isLocked()) {
            throw ValidationException::withMessages(['status' => ['This pay run is approved and can no longer change. Add an adjustment to a later month instead.']]);
        }
    }

    /**
     * Sums per currency (USD and KHR salaries are never added together).
     *
     * @param  array<int, array<string, mixed>>  $payslips
     * @return array<string, array<string, float|int>>
     */
    private function totals(array $payslips): array
    {
        return collect($payslips)->groupBy('currency')->map(fn ($group, $currency) => [
            'employees' => $group->count(),
            'gross' => Money::round($group->sum('gross'), $currency),
            'nssf_employee' => Money::round($group->sum('nssf_employee'), $currency),
            'tax' => Money::round($group->sum('tax'), $currency),
            'net' => Money::round($group->sum('net'), $currency),
            'employer_cost' => Money::round($group->sum('employer_cost'), $currency),
        ])->all();
    }
}
