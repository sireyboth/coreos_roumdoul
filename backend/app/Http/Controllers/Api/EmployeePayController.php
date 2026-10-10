<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeePayItem;
use App\Models\EmployeePayProfile;
use App\Models\EmployeeSalary;
use App\Models\PayComponent;
use App\Services\Payroll\EmployeeSalaryService;
use App\Services\Payroll\PayrollSetup;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * One employee's pay setup: salary history, tax and NSSF profile, and
 * recurring allowances and deductions. salary.view to see, salary.manage to change.
 */
class EmployeePayController extends Controller
{
    public function __construct(private readonly EmployeeSalaryService $salaries) {}

    public function show(Request $request, Employee $employee, PayrollSetup $setup)
    {
        $setup->ensure($request->user()->company);

        return [
            'salaries' => $employee->salaries()->with('createdBy:id,name')->get()->reverse()->values(),
            'profile' => $employee->payProfile ?? new EmployeePayProfile([...EmployeePayProfile::DEFAULTS, 'employee_id' => $employee->id]),
            'items' => $employee->payItems()->with('component:id,code,name,kind')->orderByDesc('effective_from')->get(),
            'item_components' => PayComponent::query()->where('method', 'employee_item')->orderBy('sort_order')->get(['id', 'code', 'name', 'kind', 'is_active']),
        ];
    }

    public function storeSalary(Request $request, Employee $employee)
    {
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

    public function destroySalary(Employee $employee, EmployeeSalary $salary)
    {
        abort_unless($salary->employee_id === $employee->id, 404);
        $this->salaries->remove($salary);

        return response()->noContent();
    }

    public function updateProfile(Request $request, Employee $employee)
    {
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
        $data = $request->validate($this->itemRules());
        $this->assertItemComponent($data['pay_component_id']);

        $item = EmployeePayItem::query()->create([...$data, 'company_id' => $employee->company_id, 'employee_id' => $employee->id]);

        return response()->json($item->load('component:id,code,name,kind'), 201);
    }

    public function updateItem(Request $request, Employee $employee, EmployeePayItem $item)
    {
        abort_unless($item->employee_id === $employee->id, 404);
        $data = $request->validate(collect($this->itemRules())->except('pay_component_id')->map(fn ($r) => ['sometimes', ...$r])->all());
        $item->update($data);

        return $item->fresh('component:id,code,name,kind');
    }

    public function destroyItem(Employee $employee, EmployeePayItem $item)
    {
        abort_unless($item->employee_id === $employee->id, 404);
        $item->delete();

        return response()->noContent();
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
