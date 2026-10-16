<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PayComponent;
use App\Models\PayrollAdjustment;
use App\Services\Payroll\PayGroupService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * One-off amounts: bonuses, penalties, back pay, corrections. The escape
 * hatch for anything the rules don't cover — typed in, or imported from a
 * spreadsheet. Each has a date and lands in the pay run whose period holds
 * it (whatever the person's pay group); locked once that run is approved.
 */
class PayrollAdjustmentController extends Controller
{
    private const MONTH = ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'];

    private const DATE = ['required', 'date_format:Y-m-d'];

    public function __construct(private readonly PayGroupService $groups) {}

    /** The adjustments dated in a month. */
    public function index(Request $request)
    {
        $request->validate(['month' => self::MONTH]);
        $start = CarbonImmutable::parse($request->input('month').'-01');

        return PayrollAdjustment::query()
            ->with(['employee' => fn ($q) => $q->withoutGlobalScope('branch_access'), 'createdBy:id,name'])
            ->whereDate('date', '>=', $start->toDateString())->whereDate('date', '<=', $start->endOfMonth()->toDateString())
            ->orderBy('date')->orderBy('id')
            ->get()
            ->map(fn (PayrollAdjustment $a) => $this->present($a));
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $this->assertOpen(collect([$employee]), $data['date']);

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

        // Only people the caller can see; anyone else in the list is an error, not silently skipped.
        $employees = Employee::query()->whereIn('id', $data['employee_ids'])->get();
        if ($employees->count() !== count($data['employee_ids'])) {
            throw ValidationException::withMessages(['employee_ids' => ['Some of these employees no longer exist or are outside your branches.']]);
        }
        $this->assertOpen($employees, $data['date']);

        DB::transaction(fn () => $employees->each(fn (Employee $employee) => PayrollAdjustment::query()->create([
            ...collect($data)->except('employee_ids')->all(),
            'employee_id' => $employee->id,
            'source' => 'manual',
            'created_by' => $request->user()->id,
        ])));

        return response()->json(['created' => $employees->count()], 201);
    }

    public function update(Request $request, PayrollAdjustment $adjustment)
    {
        $this->assertOpen(collect([$adjustment->employee]), $adjustment->date->toDateString());
        $data = $request->validate(collect($this->rules())->except(['employee_id'])->map(fn ($r) => ['sometimes', ...$r])->all());
        if (isset($data['date'])) {
            $this->assertOpen(collect([$adjustment->employee]), $data['date']);
        }
        $adjustment->update($data);

        return $this->present($adjustment->fresh(['employee', 'createdBy:id,name']));
    }

    public function destroy(PayrollAdjustment $adjustment)
    {
        $this->assertOpen(collect([$adjustment->employee]), $adjustment->date->toDateString());
        $adjustment->delete();

        return response()->noContent();
    }

    /**
     * Many at once, from a spreadsheet: one row per amount, matched to people
     * by employee ID. Rows that can't be matched are reported, not guessed.
     * A row's own date wins over the one for the whole import.
     */
    public function import(Request $request)
    {
        $data = $request->validate([
            'date' => self::DATE,
            'rows' => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.employee_code' => ['required', 'string'],
            'rows.*.date' => ['nullable', 'date_format:Y-m-d'],
            'rows.*.kind' => ['required', Rule::in(PayComponent::KINDS)],
            'rows.*.name' => ['required', 'string', 'max:100'],
            'rows.*.amount' => ['required', 'numeric', 'gt:0'],
            'rows.*.taxable' => ['nullable', 'boolean'],
            'rows.*.reason' => ['nullable', 'string', 'max:255'],
        ]);

        $employees = Employee::query()->whereIn('employee_code', collect($data['rows'])->pluck('employee_code'))->get()->keyBy('employee_code');
        $created = 0;
        $errors = [];

        foreach ($data['rows'] as $i => $row) {
            $employee = $employees[$row['employee_code']] ?? null;
            $date = $row['date'] ?? $data['date'];
            if (! $employee) {
                $errors[] = ['row' => $i + 1, 'message' => "No employee with ID {$row['employee_code']}."];

                continue;
            }
            if ($this->groups->paidOn([$employee->id], $date)->isNotEmpty()) {
                $errors[] = ['row' => $i + 1, 'message' => "{$employee->name} is already paid for {$date}. Use a later date."];

                continue;
            }

            PayrollAdjustment::query()->create([
                'employee_id' => $employee->id, 'date' => $date, 'kind' => $row['kind'], 'name' => $row['name'],
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
            'date' => self::DATE,
            'kind' => ['required', Rule::in(PayComponent::KINDS)],
            'name' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999'],
            'taxable' => ['boolean'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @param  Collection<int, Employee|null>  $employees */
    private function assertOpen(Collection $employees, string $date): void
    {
        $paid = $this->groups->paidOn($employees->filter()->pluck('id'), $date);
        if ($paid->isEmpty()) {
            return;
        }

        $names = $employees->filter()->whereIn('id', $paid)->take(5)->map(fn (Employee $e) => $e->name)->join(', ');
        throw ValidationException::withMessages(['date' => [
            "Pay for {$date} is already approved for {$names}".($paid->count() > 5 ? ' and others' : '').'. Pick a date in a later pay period.',
        ]]);
    }

    private function present(PayrollAdjustment $a): array
    {
        return [
            ...$a->only(['id', 'kind', 'name', 'amount', 'taxable', 'reason', 'source', 'created_at']),
            'date' => $a->date->toDateString(),
            'employee' => $a->employee ? ['id' => $a->employee->id, 'name' => $a->employee->name, 'employee_code' => $a->employee->employee_code] : null,
            'created_by' => $a->createdBy?->only(['id', 'name']),
        ];
    }
}
