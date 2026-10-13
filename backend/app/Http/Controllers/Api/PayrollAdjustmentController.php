<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PayComponent;
use App\Models\PayrollAdjustment;
use App\Models\PayRun;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * One-off amounts for a month: bonuses, penalties, back pay, corrections.
 * The escape hatch for anything the rules don't cover — typed in, or
 * imported from a spreadsheet. Locked once that month's run is approved.
 */
class PayrollAdjustmentController extends Controller
{
    private const MONTH = ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'];

    public function index(Request $request)
    {
        $request->validate(['month' => self::MONTH]);

        return PayrollAdjustment::query()
            ->with(['employee' => fn ($q) => $q->withoutGlobalScope('branch_access'), 'createdBy:id,name'])
            ->where('month', $request->input('month'))
            ->orderBy('id')
            ->get()
            ->map(fn (PayrollAdjustment $a) => $this->present($a));
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $this->assertMonthOpen($data['month']);
        Employee::query()->findOrFail($data['employee_id']);

        $adjustment = PayrollAdjustment::query()->create([...$data, 'source' => 'manual', 'created_by' => $request->user()->id]);

        return response()->json($this->present($adjustment->load(['employee', 'createdBy:id,name'])), 201);
    }

    /**
     * The same amount for many people at once (a festival bonus for everyone,
     * an allowance for one branch): one adjustment row per person, so each
     * can still be removed on its own.
     */
    public function bulk(Request $request)
    {
        $data = $request->validate([
            ...collect($this->rules())->except('employee_id')->all(),
            'employee_ids' => ['required', 'array', 'min:1', 'max:2000'],
            'employee_ids.*' => ['integer', 'distinct'],
        ]);
        $this->assertMonthOpen($data['month']);

        // Only people the caller can see; anyone else in the list is an error, not silently skipped.
        $ids = Employee::query()->whereIn('id', $data['employee_ids'])->pluck('id');
        if ($ids->count() !== count($data['employee_ids'])) {
            throw ValidationException::withMessages(['employee_ids' => ['Some of these employees no longer exist or are outside your branches.']]);
        }

        DB::transaction(fn () => $ids->each(fn (int $id) => PayrollAdjustment::query()->create([
            ...collect($data)->except('employee_ids')->all(),
            'employee_id' => $id,
            'source' => 'manual',
            'created_by' => $request->user()->id,
        ])));

        return response()->json(['created' => $ids->count()], 201);
    }

    public function update(Request $request, PayrollAdjustment $adjustment)
    {
        $this->assertMonthOpen($adjustment->month);
        $data = $request->validate(collect($this->rules())->except(['employee_id', 'month'])->map(fn ($r) => ['sometimes', ...$r])->all());
        $adjustment->update($data);

        return $this->present($adjustment->fresh(['employee', 'createdBy:id,name']));
    }

    public function destroy(PayrollAdjustment $adjustment)
    {
        $this->assertMonthOpen($adjustment->month);
        $adjustment->delete();

        return response()->noContent();
    }

    /**
     * Many at once, from a spreadsheet: one row per amount, matched to people
     * by employee ID. Rows that can't be matched are reported, not guessed.
     */
    public function import(Request $request)
    {
        $data = $request->validate([
            'month' => self::MONTH,
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.employee_code' => ['required', 'string'],
            'rows.*.kind' => ['required', Rule::in(PayComponent::KINDS)],
            'rows.*.name' => ['required', 'string', 'max:100'],
            'rows.*.amount' => ['required', 'numeric', 'gt:0'],
            'rows.*.taxable' => ['nullable', 'boolean'],
            'rows.*.reason' => ['nullable', 'string', 'max:255'],
        ]);
        $this->assertMonthOpen($data['month']);

        $employees = Employee::query()->whereIn('employee_code', collect($data['rows'])->pluck('employee_code'))->pluck('id', 'employee_code');
        $created = 0;
        $errors = [];

        foreach ($data['rows'] as $i => $row) {
            $employeeId = $employees[$row['employee_code']] ?? null;
            if (! $employeeId) {
                $errors[] = ['row' => $i + 1, 'message' => "No employee with ID {$row['employee_code']}."];

                continue;
            }

            PayrollAdjustment::query()->create([
                'employee_id' => $employeeId, 'month' => $data['month'], 'kind' => $row['kind'], 'name' => $row['name'],
                'amount' => $row['amount'], 'taxable' => $row['taxable'] ?? true, 'reason' => $row['reason'] ?? null,
                'source' => 'import', 'created_by' => $request->user()->id,
            ]);
            $created++;
        }

        return ['created' => $created, 'errors' => $errors];
    }

    private function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer'],
            'month' => self::MONTH,
            'kind' => ['required', Rule::in(PayComponent::KINDS)],
            'name' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999'],
            'taxable' => ['boolean'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    private function assertMonthOpen(string $month): void
    {
        if (PayRun::query()->where('month', $month)->whereIn('status', ['approved', 'paid'])->exists()) {
            throw ValidationException::withMessages(['month' => ['Payroll for this month is already approved. Add the adjustment to a later month.']]);
        }
    }

    private function present(PayrollAdjustment $a): array
    {
        return [
            ...$a->only(['id', 'month', 'kind', 'name', 'amount', 'taxable', 'reason', 'source', 'created_at']),
            'employee' => $a->employee ? ['id' => $a->employee->id, 'name' => $a->employee->name, 'employee_code' => $a->employee->employee_code] : null,
            'created_by' => $a->createdBy?->only(['id', 'name']),
        ];
    }
}
