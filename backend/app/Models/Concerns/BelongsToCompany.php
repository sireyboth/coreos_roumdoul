<?php

namespace App\Models\Concerns;

use App\Models\Company;
use Illuminate\Database\Eloquent\Builder;

/**
 * Enforces tenant isolation: every query against a company-owned model is
 * automatically scoped to the authenticated user's company, and new records
 * are automatically stamped with it. Platform admins (company_id === null)
 * bypass the scope so Filament can manage every tenant.
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $builder) {
            $user = auth()->user();

            if ($user && $user->company_id !== null) {
                $builder->where($builder->getModel()->getTable().'.company_id', $user->company_id);
            }
        });

        static::creating(function ($model) {
            if (! $model->company_id && auth()->check()) {
                $model->company_id = auth()->user()->company_id;
            }
        });
    }

    public function company(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function scopeWithoutCompanyScope(Builder $builder): Builder
    {
        return $builder->withoutGlobalScope('company');
    }
}
