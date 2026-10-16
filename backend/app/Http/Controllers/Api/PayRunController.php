<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayComponent;
use App\Models\PayGroup;
use App\Models\PayRun;
use App\Models\Payslip;
use App\Models\PayslipLine;
use App\Services\Payroll\PayrollSetup;
use App\Services\Payroll\PayRunService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Pay runs (one pay group's period each) and their payslips. */
class PayRunController extends Controller
{
    public function __construct(private readonly PayRunService $runs) {}

    public function index(Request $request)
    {
        return PayRun::query()
            ->with(['approvedBy:id,name', 'paidBy:id,name', 'payGroup:id,name,schedule'])
            ->when($request->filled('pay_group_id'), fn ($q) => $q->where('pay_group_id', $request->integer('pay_group_id')))
            ->orderByDesc('period_end')->orderByDesc('id')
            ->get()
            ->map(fn (PayRun $run) => $this->summary($run));
    }

    /**
     * Starts a run: a group and the first day of one of its periods (a custom
     * group also gives the last day). `month` alone still means the default
     * group's period starting on the 1st of that month.
     */
    public function store(Request $request, PayrollSetup $setup)
    {
        $data = $request->validate([
            'pay_group_id' => ['nullable', 'integer'],
            'period_start' => ['required_without:month', 'nullable', 'date_format:Y-m-d'],
            'period_end' => ['nullable', 'date_format:Y-m-d'],
            'month' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
        ]);

        $company = $request->user()->company;
        $setup->ensure($company);
        $group = isset($data['pay_group_id']) ? PayGroup::query()->findOrFail($data['pay_group_id']) : $setup->defaultGroup($company);

        $run = $this->runs->create($company, $group, $data['period_start'] ?? "{$data['month']}-01", $data['period_end'] ?? null, $request->user());

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

    /** One person only, after a fix to their attendance or pay. */
    public function calculateEmployee(Request $request, PayRun $run, int $employee)
    {
        return $this->detail($this->runs->calculateEmployee($run, $employee, $request->user()));
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
        $payslip->load(['lines', 'employee' => fn ($q) => $q->withoutGlobalScope('branch_access'), 'payRun.payGroup:id,name']);
        $run = $payslip->payRun;

        return [
            ...$payslip->only(['id', 'pay_run_id', 'currency', 'pay_type', 'base_salary', 'daily_rate', 'hourly_rate', 'exchange_rate', 'gross', 'nssf_employee', 'tax', 'net', 'employer_cost', 'inputs', 'warnings']),
            'month' => $run->month,
            'period_start' => $run->period_start->toDateString(),
            'period_end' => $run->period_end->toDateString(),
            'period_label' => PayRunService::periodLabel($run->period_start, $run->period_end),
            'pay_group' => $run->payGroup?->only(['id', 'name']),
            'status' => $run->status,
            'employee' => $this->employee($payslip),
            'lines' => $payslip->lines->map->only(['id', 'code', 'name', 'kind', 'amount', 'explanation', 'details']),
        ];
    }

    /** One row per payslip, for the bank or the accountant. */
    public function export(PayRun $run): StreamedResponse
    {
        $payslips = $run->payslips()->with(['employee' => fn ($q) => $q->withoutGlobalScope('branch_access')->with('payProfile')])->get();

        return response()->streamDownload(function () use ($payslips, $run) {
            $out = fopen('php://output', 'w');
            // The BOM makes Excel read the file as UTF-8, so Khmer names stay readable.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Employee ID', 'Employee', 'Period start', 'Period end', 'Currency', 'Base salary', 'Gross', 'NSSF (employee)', 'Tax on salary', 'Net pay', 'Employer cost', 'Payment method', 'Bank', 'Account number', 'Account name']);

            foreach ($payslips as $p) {
                $e = $p->employee;
                fputcsv($out, [
                    $e?->employee_code, $e?->name, $run->period_start->toDateString(), $run->period_end->toDateString(),
                    $p->currency, $p->base_salary, $p->gross, $p->nssf_employee, $p->tax, $p->net, $p->employer_cost,
                    $e?->payProfile?->payment_method ?? 'bank', $e?->bank_name, $e?->bank_account_number, $e?->payProfile?->bank_account_name,
                ]);
            }

            fclose($out);
        }, $this->filename($run), ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Everything the printed payroll report needs: each payslip with its lines
     * and where the person sits, plus how they are paid.
     */
    public function report(PayRun $run)
    {
        $run->load([
            'approvedBy:id,name', 'paidBy:id,name', 'payGroup:id,name,schedule',
            'payslips.lines',
            'payslips.employee' => fn ($q) => $q->withoutGlobalScope('branch_access')->with(['branch', 'department', 'payProfile']),
        ]);
        // The salary line is told apart by its component, not its code: companies rename codes.
        $baseIds = PayComponent::query()->where('method', 'base')->pluck('id')->all();

        return [
            ...$this->summary($run),
            'payslips' => $run->payslips
                ->sortBy(fn (Payslip $p) => [$p->employee?->sort_order ?? PHP_INT_MAX, $p->employee?->name])
                ->values()
                ->map(function (Payslip $p) use ($baseIds) {
                    $e = $p->employee;

                    return [
                        ...$p->only(['id', 'currency', 'pay_type', 'base_salary', 'gross', 'nssf_employee', 'tax', 'net', 'employer_cost', 'warnings']),
                        'employee' => $e ? [
                            ...$this->employee($p),
                            'department' => $e->department?->name,
                            'job_title' => $e->job_title,
                            'payment_method' => $e->payProfile?->payment_method ?? 'bank',
                            'bank_name' => $e->bank_name,
                            'bank_account_number' => $e->bank_account_number,
                            'bank_account_name' => $e->payProfile?->bank_account_name,
                        ] : null,
                        'lines' => $p->lines->sortBy('sort_order')->values()->map(fn (PayslipLine $l) => [
                            ...$l->only(['code', 'name', 'kind', 'amount']),
                            'is_base' => in_array($l->pay_component_id, $baseIds, true),
                        ]),
                    ];
                }),
        ];
    }

    private function filename(PayRun $run): string
    {
        return 'payroll-'.Str::slug($run->payGroup?->name ?? 'run').'-'.$run->period_start->toDateString().'.csv';
    }

    private function summary(PayRun $run): array
    {
        return [
            ...$run->only(['id', 'month', 'status', 'totals', 'warnings', 'calculated_at', 'approved_at', 'paid_at']),
            'period_start' => $run->period_start->toDateString(),
            'period_end' => $run->period_end->toDateString(),
            'period_label' => PayRunService::periodLabel($run->period_start, $run->period_end),
            'pay_group' => $run->payGroup?->only(['id', 'name', 'schedule']),
            'approved_by' => $run->approvedBy?->only(['id', 'name']),
            'paid_by' => $run->paidBy?->only(['id', 'name']),
        ];
    }

    private function detail(PayRun $run): array
    {
        $run->load(['approvedBy:id,name', 'paidBy:id,name', 'payGroup:id,name,schedule', 'payslips.employee' => fn ($q) => $q->withoutGlobalScope('branch_access')->with('branch')]);
        $stale = $this->runs->staleness($run);

        return [
            ...$this->summary($run),
            // Something that feeds pay changed after the last calculation: recalculate to include it.
            'is_stale' => $stale['everyone'] || $stale['employee_ids'] !== [],
            'stale_everyone' => $stale['everyone'],
            'stale_employee_ids' => $stale['employee_ids'],
            'filename' => $this->filename($run),
            'policy_snapshot' => $run->policy_snapshot,
            'payslips' => $run->payslips
                ->sortBy(fn (Payslip $p) => [$p->employee?->sort_order ?? PHP_INT_MAX, $p->employee?->name])
                ->values()
                ->map(fn (Payslip $p) => [
                    ...$p->only(['id', 'currency', 'pay_type', 'base_salary', 'gross', 'nssf_employee', 'tax', 'net', 'employer_cost', 'warnings']),
                    'is_stale' => $stale['everyone'] || in_array($p->employee_id, $stale['employee_ids'], true),
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
