<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * A company-chosen order for lists, like product positions in a shop: the
 * lowest sort_order first, anything without one after everything numbered,
 * then by name. Employees follow the same rule (Employee::scopeInDisplayOrder).
 */
trait HasDisplayOrder
{
    public function initializeHasDisplayOrder(): void
    {
        $this->mergeFillable(['sort_order']);
        $this->mergeCasts(['sort_order' => 'integer']);
    }

    public function scopeInDisplayOrder(Builder $query): Builder
    {
        return $query
            ->orderByRaw('coalesce('.$query->qualifyColumn('sort_order').', 2147483647)')
            ->orderBy($query->qualifyColumn('name'))
            ->orderBy($query->qualifyColumn('id'));
    }

    /** Validation for the field, shared by every create / update form. */
    public static function displayOrderRules(): array
    {
        return ['sort_order' => ['nullable', 'integer', 'min:0', 'max:99999']];
    }
}
