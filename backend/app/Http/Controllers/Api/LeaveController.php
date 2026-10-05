<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\LeaveAdjustment;
use App\Models\LeaveType;
use App\Models\RequestTypeSetting;
use App\Services\Requests\ApprovalChain;
use App\Services\Requests\LeaveBalance;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The company's leave policy (leave types) and each person's balances.
 * Everyone can read the active types and their own balance; changing a type
 * or adjusting a balance needs leave_policies.manage.
 */
class LeaveController extends Controller
{
    public function __construct(
        private readonly LeaveBalance $balances,
        private readonly ApprovalChain $chain,
    ) {}

    public function types(Request $request)
    {
        // Turned-off types only for the people who can turn them back on.
        $all = $request->boolean('all') && $request->user()->hasCompanyPermission('leave_policies.manage');

        return LeaveType::query()
            ->when(! $all, fn ($q) => $q->where('is_active', true))
            ->orderByRaw('sort_order IS NULL')->orderBy('sort_order')->orderBy('name')
            ->get();
    }

    public function storeType(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:30', 'regex:/^[a-z0-9_]+$/', Rule::unique('leave_types', 'code')->where('company_id', $request->user()->company_id)],
            ...$this->typeRules(),
        ]);

        return response()->json(LeaveType::query()->create($this->checkedType($data)), 201);
    }

    public function updateType(Request $request, LeaveType $leaveType)
    {
        // The code stays: reports and integrations rely on it.
        $data = $request->validate($this->typeRules(partial: true));
        $leaveType->update($this->checkedType([...$leaveType->only(array_keys($this->typeRules())), ...$data]));

        return $leaveType;
    }

    /**
     * Balances for one person and year: every type that keeps one. Your own,
     * or anyone's in the branches you cover.
     */
    public function balances(Request $request)
    {
        $data = $request->validate([
            'employee_id' => ['nullable', 'integer'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);
        $user = $request->user();
        $employee = $this->employeeFor($request, $data['employee_id'] ?? null);
        $year = $data['year'] ?? (int) now($employee->company?->timezone ?: config('attendance.default_timezone'))->format('Y');

        return [
            'employee' => ['id' => $employee->id, 'name' => $employee->name, 'hire_date' => $employee->hire_date?->toDateString()],
            'year' => $year,
            'balances' => LeaveType::query()->where('is_active', true)->where('requires_balance', true)
                ->orderByRaw('sort_order IS NULL')->orderBy('sort_order')->get()
                ->map(fn (LeaveType $type) => [
                    'leave_type' => ['id' => $type->id, 'code' => $type->code, 'name' => $type->name, 'name_km' => $type->name_km],
                    ...$this->balances->for($employee, $type, $year),
                ])->values(),
            'can_adjust' => $user->hasCompanyPermission('leave_policies.manage') && $this->chain->covers($user, $employee),
        ];
    }

    /** History of manual changes to one person's balances. */
    public function adjustments(Request $request)
    {
        $data = $request->validate(['employee_id' => ['required', 'integer'], 'year' => ['nullable', 'integer']]);
        $employee = $this->employeeFor($request, $data['employee_id']);

        return LeaveAdjustment::query()->with(['leaveType:id,name', 'createdBy:id,name'])
            ->where('employee_id', $employee->id)
            ->when($data['year'] ?? null, fn ($q, int $year) => $q->where('year', $year))
            ->latest()->get();
    }

    /** Adds to or takes from a balance (carry-over, a correction, days given back), always with a reason. */
    public function adjust(Request $request)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer'],
            'leave_type_id' => ['required', 'integer', Rule::exists('leave_types', 'id')->where('company_id', $request->user()->company_id)],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'days' => ['required', 'numeric', 'between:-366,366', 'not_in:0'],
            'reason' => ['required', 'string', 'max:255'],
        ]);
        $employee = $this->employeeFor($request, $data['employee_id']);

        if (! $this->chain->covers($request->user(), $employee)) {
            abort(404);
        }
        // Half days are the smallest unit anywhere else, so keep balances in halves too.
        if (fmod(abs((float) $data['days']) * 2, 1) !== 0.0) {
            throw ValidationException::withMessages(['days' => ['Use whole or half days (e.g. 1, 0.5, -2).']]);
        }

        $adjustment = LeaveAdjustment::query()->create([
            'employee_id' => $employee->id,
            'leave_type_id' => $data['leave_type_id'],
            'year' => $data['year'],
            'days' => $data['days'],
            'reason' => $data['reason'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json($adjustment->load(['leaveType:id,name', 'createdBy:id,name']), 201);
    }

    /** A request type's rules (late_early: paid or not, monthly limit, on or off). */
    public function settings(Request $request, string $type)
    {
        abort_unless(array_key_exists($type, RequestTypeSetting::DEFAULTS), 404);

        return RequestTypeSetting::forCompany($request->user()->company_id, $type)->only(['type', 'is_active', 'pay_percent', 'monthly_limit']);
    }

    public function updateSettings(Request $request, string $type)
    {
        abort_unless(array_key_exists($type, RequestTypeSetting::DEFAULTS), 404);
        $data = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'pay_percent' => ['sometimes', 'integer', Rule::in([0, 100])],
            // null = no limit.
            'monthly_limit' => ['sometimes', 'nullable', 'integer', 'between:1,31'],
        ]);

        $setting = RequestTypeSetting::forCompany($request->user()->company_id, $type);
        $setting->fill($data)->save();

        return $setting->only(['type', 'is_active', 'pay_percent', 'monthly_limit']);
    }

    /** Yourself, or — with requests.manage for their branch — someone else. */
    private function employeeFor(Request $request, ?int $employeeId): Employee
    {
        $user = $request->user();
        $own = $user->employee;

        if (! $employeeId || $employeeId === $own?->id) {
            if (! $own) {
                throw ValidationException::withMessages(['employee_id' => ['Your account isn\'t linked to an employee record yet.']]);
            }

            return $own->load('company');
        }

        $employee = Employee::query()->with('currentAssignment', 'company')->findOrFail($employeeId);
        abort_unless($this->chain->covers($user, $employee), 404);

        return $employee;
    }

    private function typeRules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'max:100'],
            'name_km' => ['nullable', 'string', 'max:100'],
            'pay_percent' => [$required, 'integer', 'between:0,100'],
            'counts' => [$required, Rule::in(LeaveType::COUNTS)],
            'accrual' => ['sometimes', Rule::in(LeaveType::ACCRUALS)],
            'yearly_days' => ['nullable', 'numeric', 'between:0,366'],
            'seniority_every_years' => ['nullable', 'integer', 'between:1,50'],
            'seniority_extra_days' => ['nullable', 'numeric', 'between:0,30'],
            'eligible_after_months' => ['nullable', 'integer', 'between:0,120'],
            'requires_balance' => ['sometimes', 'boolean'],
            'allow_half_day' => [$required, 'boolean'],
            'attachment_from_days' => ['nullable', 'numeric', 'between:0.5,366'],
            'min_notice_days' => ['nullable', 'integer', 'between:0,365'],
            'max_days_per_request' => ['nullable', 'numeric', 'between:0.5,366'],
            'gender' => ['nullable', Rule::in(['male', 'female'])],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,9999'],
        ];
    }

    /** Settings that only make sense together. */
    private function checkedType(array $data): array
    {
        // One rule: a number of days a year is a limit, kept as a balance;
        // none (or 0) means no limit. How the days are given only matters with one.
        $limited = (float) ($data['yearly_days'] ?? 0) > 0;
        $data['requires_balance'] = $limited;
        $data['yearly_days'] = $limited ? $data['yearly_days'] : null;
        $data['accrual'] = ! $limited ? 'none' : (($data['accrual'] ?? 'none') === 'none' ? 'yearly' : $data['accrual']);
        if (($data['counts'] ?? null) === 'calendar_days' && ($data['allow_half_day'] ?? false)) {
            throw ValidationException::withMessages(['allow_half_day' => ['Half days only work with leave counted in work days.']]);
        }

        return $data;
    }
}
