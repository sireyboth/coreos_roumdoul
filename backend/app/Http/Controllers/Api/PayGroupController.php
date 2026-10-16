<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayComponent;
use App\Models\PayGroup;
use App\Models\PayrollPolicy;
use App\Models\PayRun;
use App\Services\Payroll\PayGroupService;
use App\Services\Payroll\PayrollSetup;
use App\Services\Payroll\PayRunService;
use App\Services\Payroll\PayTemplates;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Pay groups: who is paid on which schedule, by which rules. Set up once in
 * payroll settings; each employee is put in one (or stays in the default).
 */
class PayGroupController extends Controller
{
    public function __construct(private readonly PayrollSetup $setup) {}

    public function index(Request $request, PayGroupService $groups)
    {
        $company = $request->user()->company;
        $this->setup->ensure($company);
        $counts = $groups->memberCounts($company->id, $this->today($request), $this->setup->defaultGroup($company)->id);

        return PayGroup::query()->withCount(['payRuns'])->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (PayGroup $group) => [...$this->present($group, $request), 'employees_count' => $counts[$group->id] ?? 0]);
    }

    /** Names only, for picking a group on an employee. */
    public function options(Request $request)
    {
        $this->setup->ensure($request->user()->company);

        return PayGroup::query()->orderBy('sort_order')->orderBy('id')->get(['id', 'name', 'schedule', 'is_default']);
    }

    public function store(Request $request)
    {
        $company = $request->user()->company;
        $this->setup->ensure($company);
        $data = $this->validated($request);

        $group = DB::transaction(function () use ($data, $company) {
            if (! empty($data['is_default'])) {
                PayGroup::query()->update(['is_default' => false]);
            }

            return PayGroup::query()->create([...$data, 'company_id' => $company->id]);
        });

        return response()->json($this->present($group->loadCount('payRuns'), $request), 201);
    }

    public function update(Request $request, PayGroup $group)
    {
        $data = $this->validated($request, $group);

        if ($group->is_default && array_key_exists('is_default', $data) && ! $data['is_default']) {
            throw ValidationException::withMessages(['is_default' => ['Make another group the default instead.']]);
        }

        $timing = array_intersect_key($data, array_flip(['schedule', 'cutoff_days', 'anchor_date']));
        $changesTiming = collect($timing)->contains(fn ($value, $key) => $value != $group->{$key} && ! ($key === 'anchor_date' && $value === $group->anchor_date?->toDateString()));
        if ($changesTiming && $group->payRuns()->whereIn('status', ['draft', 'calculated'])->exists()) {
            throw ValidationException::withMessages(['schedule' => ['Approve or delete this group\'s open pay runs before changing its schedule.']]);
        }

        DB::transaction(function () use ($group, $data) {
            if (! empty($data['is_default'])) {
                PayGroup::query()->whereKeyNot($group->id)->update(['is_default' => false]);
            }
            $group->update($data);
        });

        return $this->present($group->fresh()->loadCount('payRuns'), $request);
    }

    public function destroy(PayGroup $group)
    {
        if ($group->is_default) {
            throw ValidationException::withMessages(['group' => ['The default group can\'t be deleted. Make another group the default first.']]);
        }
        if ($group->payRuns()->exists()) {
            throw ValidationException::withMessages(['group' => ['This group has pay runs, so it is kept for the record.']]);
        }
        if (($count = $group->members()->count()) > 0) {
            throw ValidationException::withMessages(['group' => ["{$count} pay group ".($count === 1 ? 'change points' : 'changes point').' to this group. Move those people to another group first.']]);
        }

        $group->delete();

        return response()->noContent();
    }

    /**
     * The group's recent periods to choose from when starting a run, newest
     * first, each with its run if it has one. A period that overlaps an
     * earlier run (after a schedule change) starts the day after that run.
     */
    public function periods(Request $request, PayGroup $group)
    {
        if (! $group->hasFixedPeriods()) {
            return [];
        }

        $today = $this->today($request);
        $runs = $group->payRuns()->orderByDesc('period_start')->get(['id', 'period_start', 'period_end', 'status']);

        return collect($group->recentPeriods($today, 8))->map(function (array $period) use ($runs) {
            [$start, $end] = $period;
            $run = $runs->first(fn (PayRun $r) => $r->period_start->toDateString() <= $end->toDateString() && $r->period_end->toDateString() >= $start->toDateString());
            if ($run && $run->period_end->toDateString() < $end->toDateString() && $run->period_start->toDateString() <= $start->toDateString()) {
                // Only the tail of this period is still unpaid.
                $start = CarbonImmutable::parse($run->period_end->toDateString())->addDay();
                $run = null;
            }

            return [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'label' => PayRunService::periodLabel($start, $end),
                'run' => $run?->only(['id', 'status']),
            ];
        })->values();
    }

    private function validated(Request $request, ?PayGroup $group = null): array
    {
        $required = $group ? 'sometimes' : 'required';
        $data = $request->validate([
            'name' => [$required, 'string', 'max:100', Rule::unique('pay_groups', 'name')->where('company_id', $request->user()->company_id)->ignore($group?->id)],
            'schedule' => [$required, Rule::in(PayGroup::SCHEDULES)],
            'cutoff_days' => ['nullable', 'array', 'max:2'],
            'cutoff_days.*' => ['integer', 'min:1', 'max:31', 'distinct'],
            'anchor_date' => ['nullable', 'date_format:Y-m-d'],
            'rate_basis' => ['nullable', Rule::in(PayrollPolicy::RATE_BASES)],
            'rate_basis_days' => ['nullable', 'integer', 'min:1', 'max:31'],
            'hours_per_day' => ['nullable', 'numeric', 'min:1', 'max:24'],
            'missing_scan_policy' => ['nullable', Rule::in(PayrollPolicy::MISSING_SCAN_POLICIES)],
            'daily_paid_holidays' => ['nullable', 'boolean'],
            'component_rules' => ['nullable', 'array'],
            'component_rules.*.is_active' => ['sometimes', 'boolean'],
            'component_rules.*.params' => ['sometimes', 'nullable', 'array'],
            'auto_calculate' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);

        $schedule = $data['schedule'] ?? $group?->schedule;
        $cutoffs = array_key_exists('cutoff_days', $data) ? $data['cutoff_days'] : $group?->cutoff_days;
        $anchor = array_key_exists('anchor_date', $data) ? $data['anchor_date'] : $group?->anchor_date?->toDateString();

        // Each schedule keeps only what it uses.
        if (in_array($schedule, ['monthly', 'semi_monthly'], true)) {
            $needed = $schedule === 'monthly' ? 1 : 2;
            $cutoffs = collect($cutoffs ?? [])->map(fn ($d) => (int) $d)->sort()->values()->all();
            if (count($cutoffs) !== $needed) {
                throw ValidationException::withMessages(['cutoff_days' => [$needed === 1 ? 'Pick the day each period ends on.' : 'Pick the two days the periods end on.']]);
            }
            if ($needed === 2 && min(abs($cutoffs[1] - $cutoffs[0]), 31 - abs($cutoffs[1] - $cutoffs[0])) < 7) {
                throw ValidationException::withMessages(['cutoff_days' => ['The two cut-off days should be at least a week apart.']]);
            }
            $data['cutoff_days'] = $cutoffs;
            $data['anchor_date'] = null;
        } elseif (in_array($schedule, ['weekly', 'biweekly'], true)) {
            if (! $anchor) {
                throw ValidationException::withMessages(['anchor_date' => ['Pick the first day of any one period; the rest follow from it.']]);
            }
            $data['anchor_date'] = $anchor;
            $data['cutoff_days'] = null;
        } else {
            $data['cutoff_days'] = null;
            $data['anchor_date'] = null;
        }

        if (array_key_exists('component_rules', $data)) {
            $data['component_rules'] = $this->componentRules($data['component_rules'] ?? []);
        }

        return $data;
    }

    /**
     * Keeps only rules for this company's components, with template params checked like the company's own.
     *
     * @param  array<int|string, array<string, mixed>>  $rules
     * @return array<int, array<string, mixed>>|null
     */
    private function componentRules(array $rules): ?array
    {
        $components = PayComponent::query()->whereIn('id', array_keys($rules))->get()->keyBy('id');
        $clean = [];

        foreach ($rules as $id => $rule) {
            $component = $components->get((int) $id) ?? throw ValidationException::withMessages(['component_rules' => ['One of these rules is for a component that no longer exists.']]);
            if ($component->method === 'base') {
                continue;
            }

            $entry = [];
            if (array_key_exists('is_active', $rule)) {
                $entry['is_active'] = (bool) $rule['is_active'];
            }
            if (! empty($rule['params']) && $component->method === 'template') {
                $entry['params'] = PayTemplates::normalise($component->template, $rule['params']);
            }
            if ($entry !== []) {
                $clean[$component->id] = $entry;
            }
        }

        return $clean === [] ? null : $clean;
    }

    private function today(Request $request): string
    {
        return now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();
    }

    private function present(PayGroup $group, Request $request): array
    {
        $current = $group->periodFor($this->today($request));

        return [
            ...$group->toArray(),
            'pay_runs_count' => $group->pay_runs_count ?? $group->payRuns()->count(),
            'current_period' => $current ? ['start' => $current[0]->toDateString(), 'end' => $current[1]->toDateString(), 'label' => PayRunService::periodLabel($current[0], $current[1])] : null,
        ];
    }
}
