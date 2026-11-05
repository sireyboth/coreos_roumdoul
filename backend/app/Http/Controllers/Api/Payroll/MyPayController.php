<?php

namespace App\Http\Controllers\Api\Payroll;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PayRun;
use App\Models\Payslip;
use App\Services\Payroll\EmployeeSalaryService;
use App\Services\Payroll\PayRunService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/**
 * Your own pay, for the profile page: the salary in force today and the
 * payslips of approved or paid runs. No salary or payroll permission needed —
 * it only ever reads the caller's own employee record, never one picked by id.
 * Runs still being prepared stay hidden: their amounts can still change.
 */
class MyPayController extends Controller
{
    private const RELEASED = ['approved', 'paid'];

    public function show(Request $request, EmployeeSalaryService $salaries)
    {
        $employee = $this->ownEmployee($request);
        $today = now($employee->company()->value('timezone') ?: config('attendance.default_timezone'))->toDateString();
        $current = $salaries->inForce($employee, $today);

        // Newest period first.
        $payslips = $this->released($employee)
            ->with('payRun.payGroup:id,name')
            ->orderByDesc(PayRun::query()->select('period_end')->whereColumn('pay_runs.id', 'payslips.pay_run_id'))
            ->orderByDesc('id')
            ->get();

        return [
            // toArray() applies the casts, so effective_from comes out as Y-m-d.
            'salary' => $current ? Arr::only($current->toArray(), ['amount', 'currency', 'pay_type', 'effective_from']) : null,
            'payslips' => $payslips->map(fn (Payslip $p) => [
                ...$p->only(['id', 'currency', 'gross', 'nssf_employee', 'tax', 'net']),
                ...$this->period($p),
            ]),
        ];
    }

    public function payslip(Request $request, int $payslip)
    {
        $slip = $this->released($this->ownEmployee($request))
            ->with(['lines', 'employee', 'payRun.payGroup:id,name'])
            ->findOrFail($payslip);

        // Same shape as HR's payslip, less what is the company's business: its own cost and HR's warnings.
        return [
            ...$slip->only(['id', 'pay_run_id', 'currency', 'pay_type', 'base_salary', 'daily_rate', 'hourly_rate', 'exchange_rate', 'gross', 'nssf_employee', 'tax', 'net', 'inputs']),
            ...$this->period($slip),
            'warnings' => null,
            'employee' => $slip->employee?->only(['id', 'name', 'employee_code']),
            'lines' => $slip->lines->map->only(['id', 'code', 'name', 'kind', 'amount', 'explanation']),
        ];
    }

    /** @return Builder<Payslip> */
    private function released(Employee $employee): Builder
    {
        return Payslip::query()
            ->where('employee_id', $employee->id)
            ->whereHas('payRun', fn ($q) => $q->whereIn('status', self::RELEASED));
    }

    /** The run's period and status; payRun.payGroup must be loaded. */
    private function period(Payslip $payslip): array
    {
        // toArray() applies the casts (dates as Y-m-d, paid_at as ISO time); pay_group is the loaded id and name.
        $run = Arr::only($payslip->payRun->toArray(), ['month', 'period_start', 'period_end', 'status', 'paid_at', 'pay_group']);

        return [...$run, 'period_label' => PayRunService::periodLabel($run['period_start'], $run['period_end'])];
    }

    /** Owners and admins may have no employee record — they have no pay of their own here. */
    private function ownEmployee(Request $request): Employee
    {
        // Your own record, even if your branch access would not list it.
        $employee = Employee::query()->withoutGlobalScope('branch_access')->where('user_id', $request->user()->id)->first();

        abort_if($employee === null, response()->json([
            'message' => __('Your account is not linked to an employee record, so it has no pay to show.'),
            'code' => 'no_employee_record',
        ], 404));

        return $employee;
    }
}
