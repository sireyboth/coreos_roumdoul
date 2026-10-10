<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayRun;
use App\Models\Payslip;
use App\Services\Payroll\PayRunService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Monthly pay runs and their payslips. */
class PayRunController extends Controller
{
    public function __construct(private readonly PayRunService $runs) {}

    public function index()
    {
        return PayRun::query()->with(['approvedBy:id,name', 'paidBy:id,name'])->orderByDesc('month')->get()
            ->map(fn (PayRun $run) => $this->summary($run));
    }

    public function store(Request $request)
    {
        $data = $request->validate(['month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/']]);
        $run = $this->runs->create($request->user()->company, $data['month'], $request->user());

        return response()->json($this->detail($run), 201);
    }

    public function show(PayRun $run)
    {
        return $this->detail($run);
    }

    public function calculate(Request $request, PayRun $run)
    {
        return $this->detail($this->runs->calculate($run, $request->user()));
    }

    public function approve(Request $request, PayRun $run)
    {
        return $this->detail($this->runs->approve($run, $request->user()));
    }

    public function markPaid(Request $request, PayRun $run)
    {
        return $this->detail($this->runs->markPaid($run, $request->user()));
    }

    public function destroy(PayRun $run)
    {
        $this->runs->delete($run);

        return response()->noContent();
    }

    public function payslip(Payslip $payslip)
    {
        $payslip->load(['lines', 'employee' => fn ($q) => $q->withoutGlobalScope('branch_access'), 'payRun:id,month,status']);

        return [
            ...$payslip->only(['id', 'pay_run_id', 'currency', 'pay_type', 'base_salary', 'daily_rate', 'hourly_rate', 'exchange_rate', 'gross', 'nssf_employee', 'tax', 'net', 'employer_cost', 'inputs', 'warnings']),
            'month' => $payslip->payRun->month,
            'status' => $payslip->payRun->status,
            'employee' => $this->employee($payslip),
            'lines' => $payslip->lines->map->only(['id', 'code', 'name', 'kind', 'amount', 'explanation', 'details']),
        ];
    }

    /** One row per payslip, for the bank or the accountant. */
    public function export(PayRun $run): StreamedResponse
    {
        $payslips = $run->payslips()->with(['employee' => fn ($q) => $q->withoutGlobalScope('branch_access')->with('payProfile')])->get();

        return response()->streamDownload(function () use ($payslips) {
            $out = fopen('php://output', 'w');
            // The BOM makes Excel read the file as UTF-8, so Khmer names stay readable.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Employee ID', 'Employee', 'Currency', 'Base salary', 'Gross', 'NSSF (employee)', 'Tax on salary', 'Net pay', 'Employer cost', 'Payment method', 'Bank', 'Account number', 'Account name']);

            foreach ($payslips as $p) {
                $e = $p->employee;
                fputcsv($out, [
                    $e?->employee_code, $e?->name, $p->currency, $p->base_salary, $p->gross, $p->nssf_employee, $p->tax, $p->net, $p->employer_cost,
                    $e?->payProfile?->payment_method ?? 'bank', $e?->bank_name, $e?->bank_account_number, $e?->payProfile?->bank_account_name,
                ]);
            }

            fclose($out);
        }, "payroll-{$run->month}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function summary(PayRun $run): array
    {
        return [
            ...$run->only(['id', 'month', 'status', 'totals', 'warnings', 'calculated_at', 'approved_at', 'paid_at']),
            'approved_by' => $run->approvedBy?->only(['id', 'name']),
            'paid_by' => $run->paidBy?->only(['id', 'name']),
        ];
    }

    private function detail(PayRun $run): array
    {
        $run->load(['approvedBy:id,name', 'paidBy:id,name', 'payslips.employee' => fn ($q) => $q->withoutGlobalScope('branch_access')->with('branch')]);

        return [
            ...$this->summary($run),
            'policy_snapshot' => $run->policy_snapshot,
            'payslips' => $run->payslips
                ->sortBy(fn (Payslip $p) => [$p->employee?->sort_order ?? PHP_INT_MAX, $p->employee?->name])
                ->values()
                ->map(fn (Payslip $p) => [
                    ...$p->only(['id', 'currency', 'pay_type', 'base_salary', 'gross', 'nssf_employee', 'tax', 'net', 'employer_cost', 'warnings']),
                    'employee' => $this->employee($p),
                ]),
        ];
    }

    private function employee(Payslip $payslip): ?array
    {
        $e = $payslip->employee;

        return $e ? ['id' => $e->id, 'name' => $e->name, 'employee_code' => $e->employee_code, 'branch' => $e->branch?->name] : null;
    }
}
