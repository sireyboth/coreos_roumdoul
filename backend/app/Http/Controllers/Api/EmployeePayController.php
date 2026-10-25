<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeePayGroup;
use App\Models\EmployeePayItem;
use App\Models\EmployeePayProfile;
use App\Models\EmployeeSalary;
use App\Models\PayComponent;
use App\Models\PayGroup;
use App\Models\Payslip;
use App\Services\Payroll\EmployeeSalaryService;
use App\Services\Payroll\PayGroupService;
use App\Services\Payroll\PayrollSetup;
use App\Support\SelfApproval;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * One employee's pay setup: pay group, salary history, tax and NSSF profile,
 * and recurring allowances and deductions. salary.view to see, salary.manage to change.
 */
class EmployeePayController extends Controller
{
    public function __construct(private readonly EmployeeSalaryService $salaries) {}

    public function show(Request $request, Employee $employee, PayrollSetup $setup, PayGroupService $groups)
    {
        $company = $request->user()->company;
        $setup->ensure($company);
        $default = $setup->defaultGroup($company);
        $today = now($company->timezone ?: config('attendance.default_timezone'))->toDateString();

        return [
            'pay_group' => PayGroup::query()->find($groups->groupIdOn($employee, $today, $default->id), ['id', 'name', 'schedule']),
            'pay_groups' => $employee->payGroups()->with(['payGroup:id,name', 'createdBy:id,name'])->get()->reverse()->values(),
            'paid_through' => $groups->paidThrough($employee),
            'salaries' => $employee->salaries()->with('createdBy:id,name')->get()->reverse()->values(),
            'profile' => $employee->payProfile ?? new EmployeePayProfile([...EmployeePayProfile::DEFAULTS, 'employee_id' => $employee->id]),
            'items' => $employee->payItems()->with('component:id,code,name,kind')->orderByDesc('effective_from')->get(),
            'item_components' => $this->itemComponents(),
        ];
    }

    /**
     * Everyone's pay setup as it stands today, in one go — for the employee
     * Excel export, which writes one row per person.
     */
    public function index(Request $request, PayrollSetup $setup)
    {
        $company = $request->user()->company;
        $setup->ensure($company);
        $default = $setup->defaultGroup($company);
        $today = now($company->timezone ?: config('attendance.default_timezone'))->toDateString();
        $inForce = fn ($row) => $row->effective_from->toDateString() <= $today
            && ($row->effective_to === null || $row->effective_to->toDateString() >= $today);

        $employees = Employee::query()->with(['salaries', 'payGroups.payGroup:id,name', 'payProfile', 'payItems'])->get(['id', 'company_id']);
        $paidThrough = Payslip::query()->withoutGlobalScopes()
            ->join('pay_runs', 'pay_runs.id', '=', 'payslips.pay_run_id')
            ->whereIn('payslips.employee_id', $employees->modelKeys())
            ->whereIn('pay_runs.status', ['approved', 'paid'])
            ->groupBy('payslips.employee_id')
            ->selectRaw('payslips.employee_id, max(pay_runs.period_end) as paid_through')
            ->pluck('paid_through', 'employee_id');

        return [
            'item_components' => $this->itemComponents(),
            'employees' => $employees->map(function (Employee $employee) use ($inForce, $default, $paidThrough) {
                // Before their first group row everyone is in the default group.
                $group = $employee->payGroups->first($inForce)?->payGroup ?? $default;
                $salary = $employee->salaries->first($inForce) ?? $employee->salaries->last();

                return [
                    'employee_id' => $employee->id,
                    'pay_group' => ['id' => $group->id, 'name' => $group->name],
                    'paid_through' => isset($paidThrough[$employee->id]) ? substr((string) $paidThrough[$employee->id], 0, 10) : null,
                    'salary' => $salary ? collect($salary->toArray())->only(['amount', 'currency', 'pay_type', 'effective_from']) : null,
                    'profile' => $employee->payProfile ?? new EmployeePayProfile(EmployeePayProfile::DEFAULTS),
                    'items' => $employee->payItems->filter($inForce)->values(),
                ];
            }),
        ];
    }

    /** The allowances and deductions that can be set per person, for people who set pay but not payroll. */
    public function itemOptions()
    {
        return $this->itemComponents();
    }

    private function itemComponents()
    {
        return PayComponent::query()->where('method', 'employee_item')->orderBy('sort_order')->get(['id', 'code', 'name', 'kind', 'is_active']);
    }

    public function storeSalary(Request $request, Employee $employee)
    {
        $this->assertNotOwn($request, $employee);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999'],
            'currency' => ['required', Rule::in(['USD', 'KHR'])],
            'pay_type' => ['required', Rule::in(EmployeeSalary::PAY_TYPES)],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'reason' => ['required', Rule::in(EmployeeSalary::REASONS)],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $salary = $this->salaries->record(
            $employee, (float) $data['amount'], $data['currency'], $data['pay_type'], $data['effective_from'],
            $data['reason'], $data['note'] ?? null, $request->user(),
        );

        return response()->json($salary->load('createdBy:id,name'), 201);
    }

    public function destroySalary(Request $request, Employee $employee, EmployeeSalary $salary)
    {
        $this->assertNotOwn($request, $employee);
        abort_unless($salary->employee_id === $employee->id, 404);
        $this->salaries->remove($salary);

        return response()->noContent();
    }

    /** Moves the employee to another pay group from a date (salary.manage). */
    public function storePayGroup(Request $request, Employee $employee, PayGroupService $groups)
    {
        $this->assertNotOwn($request, $employee);
        $data = $request->validate([
            'pay_group_id' => ['required', 'integer'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
        ]);
        $group = PayGroup::query()->findOrFail($data['pay_group_id']);

        $row = $groups->assign($employee, $group, $data['effective_from'], $request->user());

        return response()->json($row->load(['payGroup:id,name', 'createdBy:id,name']), 201);
    }

    public function destroyPayGroup(Request $request, Employee $employee, EmployeePayGroup $assignment, PayGroupService $groups)
    {
        $this->assertNotOwn($request, $employee);
        abort_unless($assignment->employee_id === $employee->id, 404);
        $groups->remove($assignment);

        return response()->noContent();
    }

    public function updateProfile(Request $request, Employee $employee)
    {
        $this->assertNotOwn($request, $employee);
        $data = $request->validate([
            'tax_resident' => ['sometimes', 'boolean'],
            'spouse_dependent' => ['sometimes', 'boolean'],
            'child_dependents' => ['sometimes', 'integer', 'min:0', 'max:20'],
            'nssf_enrolled' => ['sometimes', 'boolean'],
            'payment_method' => ['sometimes', Rule::in(EmployeePayProfile::PAYMENT_METHODS)],
            'bank_account_name' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $profile = EmployeePayProfile::query()->firstOrNew(['employee_id' => $employee->id], [...EmployeePayProfile::DEFAULTS, 'company_id' => $employee->company_id]);
        $profile->fill($data)->save();

        return $profile->fresh();
    }

    public function storeItem(Request $request, Employee $employee)
    {
        $this->assertNotOwn($request, $employee);
        $data = $request->validate($this->itemRules());
        $this->assertItemComponent($data['pay_component_id']);

        $item = EmployeePayItem::query()->create([...$data, 'company_id' => $employee->company_id, 'employee_id' => $employee->id]);

        return response()->json($item->load('component:id,code,name,kind'), 201);
    }

    public function updateItem(Request $request, Employee $employee, EmployeePayItem $item)
    {
        $this->assertNotOwn($request, $employee);
        abort_unless($item->employee_id === $employee->id, 404);
        $data = $request->validate(collect($this->itemRules())->except('pay_component_id')->map(fn ($r) => ['sometimes', ...$r])->all());
        $item->update($data);

        return $item->fresh('component:id,code,name,kind');
    }

    public function destroyItem(Request $request, Employee $employee, EmployeePayItem $item)
    {
        $this->assertNotOwn($request, $employee);
        abort_unless($item->employee_id === $employee->id, 404);
        $item->delete();

        return response()->noContent();
    }

    /** Nobody sets their own pay, unless the company allows it (see SelfApproval). */
    private function assertNotOwn(Request $request, Employee $employee): void
    {
        SelfApproval::assertNotSelf($request->user(), $employee, 'employee_id', 'change the pay of');
    }

    private function itemRules(): array
    {
        return [
            'pay_component_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'effective_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    private function assertItemComponent(int $id): void
    {
        if (! PayComponent::query()->whereKey($id)->where('method', 'employee_item')->exists()) {
            throw ValidationException::withMessages(['pay_component_id' => ['Pick an allowance or deduction set up in payroll settings.']]);
        }
    }
}
