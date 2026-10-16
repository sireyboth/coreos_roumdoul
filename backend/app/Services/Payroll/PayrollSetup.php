<?php

namespace App\Services\Payroll;

use App\Models\Company;
use App\Models\PayComponent;
use App\Models\PayGroup;
use App\Models\PayrollPolicy;
use App\Support\PayrollDefaults;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Gives a company its payroll starting point the first time payroll is
 * opened: the policy row, the system components and a default "Monthly" pay
 * group. Safe to call any number of times — it only adds what is missing,
 * never resets what was tuned.
 */
class PayrollSetup
{
    public function ensure(Company $company): PayrollPolicy
    {
        $policy = PayrollPolicy::query()->withoutGlobalScopes()->firstOrCreate(
            ['company_id' => $company->id],
            PayrollDefaults::policy(),
        );

        $this->defaultGroup($company);

        $existing = PayComponent::query()->withoutGlobalScopes()->where('company_id', $company->id)->pluck('code')->all();

        foreach (PayrollDefaults::components() as $component) {
            if (! in_array($component['code'], $existing, true)) {
                PayComponent::query()->create([
                    'is_active' => true,
                    ...$component,
                    'company_id' => $company->id,
                    'is_system' => true,
                ]);
            }
        }

        return $policy;
    }

    /** The group everyone is paid with until they are put in another one. */
    public function defaultGroup(Company $company): PayGroup
    {
        $groups = PayGroup::query()->withoutGlobalScopes()->where('company_id', $company->id);

        return (clone $groups)->where('is_default', true)->first()
            ?? PayGroup::query()->create([
                'company_id' => $company->id, 'name' => (clone $groups)->where('name', 'Monthly')->exists() ? 'Monthly (default)' : 'Monthly',
                'schedule' => 'monthly', 'cutoff_days' => [31], 'is_default' => true, 'sort_order' => 10,
            ]);
    }

    /** Applies one of PayrollDefaults::presets() on top of the company's current setup. */
    public function applyPreset(Company $company, string $key): void
    {
        $preset = PayrollDefaults::presets()[$key] ?? throw new InvalidArgumentException("Unknown preset {$key}.");
        $policy = $this->ensure($company);

        DB::transaction(function () use ($company, $policy, $preset) {
            $policy->update($preset['policy']);

            foreach ($preset['components'] as $code => $changes) {
                PayComponent::query()->withoutGlobalScopes()
                    ->where('company_id', $company->id)->where('code', $code)
                    ->first()?->update($changes);
            }
        });
    }
}
