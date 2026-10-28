<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PayComponent;
use App\Models\PayGroup;
use App\Models\PayrollAdjustment;
use App\Models\PayrollPolicy;
use App\Services\Payroll\PayGroupService;
use App\Services\Payroll\PayrollCalculator;
use App\Services\Payroll\PayrollSetup;
use App\Services\Payroll\PayRunService;
use App\Services\Payroll\PayTemplates;
use App\Support\PayrollDefaults;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A company's payroll rules: the policy, the pay components and their
 * templates, one-click presets, and a live preview of any rule on a real
 * employee's month before it is saved.
 */
class PayrollSettingsController extends Controller
{
    public function __construct(private readonly PayrollSetup $setup) {}

    public function show(Request $request)
    {
        $company = $request->user()->company;
        $policy = $this->setup->ensure($company);

        return [
            'policy' => $policy,
            'components' => PayComponent::query()->withCount('employeeItems')->orderBy('sort_order')->orderBy('id')->get(),
            'presets' => collect(PayrollDefaults::presets())->map(fn ($p, $key) => ['key' => $key, 'name' => $p['name'], 'description' => $p['description']])->values(),
            'templates' => PayTemplates::TEMPLATES,
        ];
    }

    public function updatePolicy(Request $request)
    {
        $data = $request->validate([
            'rate_basis' => ['sometimes', Rule::in(PayrollPolicy::RATE_BASES)],
            'rate_basis_days' => ['sometimes', 'integer', 'min:1', 'max:31'],
            'hours_per_day' => ['sometimes', 'numeric', 'min:1', 'max:24'],
            'missing_scan_policy' => ['sometimes', Rule::in(PayrollPolicy::MISSING_SCAN_POLICIES)],
            'daily_paid_holidays' => ['sometimes', 'boolean'],
            'enforce_overtime_minimums' => ['sometimes', 'boolean'],
            'khr_rounding' => ['sometimes', 'integer', Rule::in([1, 100, 500, 1000])],
            'fallback_exchange_rate' => ['sometimes', 'nullable', 'numeric', 'min:1000', 'max:10000'],
            // What the bank files ask about the company itself — see frontend lib/bank-export.ts.
            'bank_exports' => ['sometimes', 'nullable', 'array:chipmong'],
            'bank_exports.chipmong' => ['sometimes', 'array:company_code,debit_account'],
            'bank_exports.chipmong.*' => ['nullable', 'string', 'max:50'],
        ]);

        $policy = $this->setup->ensure($request->user()->company);
        $policy->update($data);

        return $policy->fresh();
    }

    public function applyPreset(Request $request)
    {
        $data = $request->validate(['preset' => ['required', Rule::in(array_keys(PayrollDefaults::presets()))]]);
        $this->setup->applyPreset($request->user()->company, $data['preset']);

        return $this->show($request);
    }

    public function storeComponent(Request $request)
    {
        $policy = $this->setup->ensure($request->user()->company);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:32', 'regex:/^[A-Z0-9_]+$/'],
            'kind' => ['required', Rule::in(PayComponent::KINDS)],
            'method' => ['required', Rule::in(['employee_item', 'template'])],
            'template' => ['required_if:method,template', 'nullable', Rule::in(PayTemplates::TEMPLATES)],
            'params' => ['nullable', 'array'],
            'taxable' => ['boolean'],
            'nssf_insurable' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);

        $data['code'] = $this->uniqueCode($data['code'] ?? Str::upper(Str::snake(Str::ascii($data['name']))));
        $data['params'] = $data['method'] === 'template' ? PayTemplates::normalise($data['template'], $data['params'] ?? [], $policy->enforce_overtime_minimums) : null;
        if ($data['method'] !== 'template') {
            $data['template'] = null;
        }

        return response()->json(PayComponent::query()->create([...$data, 'sort_order' => $data['sort_order'] ?? 100, 'is_system' => false]), 201);
    }

    public function updateComponent(Request $request, PayComponent $component)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'params' => ['sometimes', 'array'],
            'taxable' => ['sometimes', 'boolean'],
            'nssf_insurable' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);

        if ($component->method === 'base') {
            // The salary itself: only its label can change.
            $data = array_intersect_key($data, ['name' => true]);
        }
        if (array_key_exists('params', $data)) {
            $enforce = $this->setup->ensure($request->user()->company)->enforce_overtime_minimums;
            $data['params'] = $component->method === 'template' ? PayTemplates::normalise($component->template, $data['params'], $enforce) : null;
        }

        $component->update($data);

        return $component->fresh();
    }

    public function destroyComponent(PayComponent $component)
    {
        if ($component->is_system) {
            throw ValidationException::withMessages(['component' => [__('Built-in components can be switched off, not deleted.')]]);
        }
        if (($count = $component->employeeItems()->count()) > 0) {
            throw ValidationException::withMessages(['component' => [$count === 1
                ? __(':n employee has this item. Remove it from them first, or switch the component off.', ['n' => $count])
                : __(':n employees have this item. Remove it from them first, or switch the component off.', ['n' => $count])]]);
        }

        $component->delete();

        return response()->noContent();
    }

    /**
     * One employee's payslip for the pay period that ends the month (or holds
     * today, for this month) with the current rules — or with one component's
     * unsaved params swapped in, so a rule can be tried before saving. With
     * pay_group_id, the group's rules are used (to try a group's own rule).
     */
    public function preview(Request $request, PayrollCalculator $calculator, PayGroupService $groups)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer'],
            'month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'pay_group_id' => ['nullable', 'integer'],
            'component_id' => ['nullable', 'integer'],
            'params' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $company = $request->user()->company;
        $this->setup->ensure($company);
        $employee = Employee::query()->with(['salaries', 'payProfile', 'payItems', 'payGroups'])->findOrFail($data['employee_id']);

        $monthEnd = CarbonImmutable::parse("{$data['month']}-01")->endOfMonth()->startOfDay();
        $date = $monthEnd->min(CarbonImmutable::parse(now($company->timezone ?: config('attendance.default_timezone'))->toDateString()));
        $group = ! empty($data['pay_group_id'])
            ? PayGroup::query()->findOrFail($data['pay_group_id'])
            : PayGroup::query()->findOrFail($groups->groupIdOn($employee, $date->toDateString(), $this->setup->defaultGroup($company)->id));
        [$start, $end] = $group->periodFor($date) ?? [$monthEnd->startOfMonth(), $monthEnd];
        $ctx = $calculator->context($company, $group, $start, $end);

        if (! empty($data['component_id'])) {
            $draft = ($ctx['components']->firstWhere('id', $data['component_id']) ?? PayComponent::query()->findOrFail($data['component_id']))->replicate();
            $draft->id = $data['component_id'];
            if (isset($data['params']) && $draft->method === 'template') {
                $draft->params = PayTemplates::normalise($draft->template, $data['params'], $ctx['policy']->enforce_overtime_minimums);
            }
            $active = $data['is_active'] ?? true;
            $ctx['components'] = $ctx['components']->reject(fn (PayComponent $c) => $c->id === $draft->id)
                ->when($active, fn ($c) => $c->push($draft))
                ->sortBy([['sort_order', 'asc'], ['id', 'asc']])->values();
        }

        $attendance = $calculator->attendance($ctx, collect([$employee]))->get($employee->id);
        $adjustments = PayrollAdjustment::query()->where('employee_id', $employee->id)
            ->whereDate('date', '>=', $start->toDateString())->whereDate('date', '<=', $end->toDateString())->get();
        $result = $calculator->calculate($ctx, $employee, $attendance, $adjustments);

        if (isset($result['skipped'])) {
            throw ValidationException::withMessages(['employee_id' => [__(':name has no salary for this period.', ['name' => $employee->name])]]);
        }

        return [
            ...$result,
            'employee' => ['id' => $employee->id, 'name' => $employee->name, 'employee_code' => $employee->employee_code],
            'pay_group' => $group->only(['id', 'name']),
            'period_start' => $start->toDateString(),
            'period_end' => $end->toDateString(),
            'period_label' => PayRunService::periodLabel($start, $end),
        ];
    }

    private function uniqueCode(string $code): string
    {
        $code = Str::limit(trim(preg_replace('/[^A-Z0-9_]+/', '_', strtoupper($code)), '_') ?: 'ITEM', 28, '');
        $candidate = $code;
        for ($i = 2; PayComponent::query()->where('code', $candidate)->exists(); $i++) {
            $candidate = "{$code}_{$i}";
        }

        return $candidate;
    }
}
