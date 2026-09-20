<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * Mirrors BelongsToCompany's pattern for branch-level access: when the
 * current user's membership has one or more membership_branch_access rows,
 * queries are restricted to just those branches. Zero rows means
 * unrestricted (full access to every branch in the company) — restrictions
 * are opt-in per membership, not a default that has to be explicitly lifted.
 */
trait RestrictedToAccessibleBranches
{
    public static function bootRestrictedToAccessibleBranches(): void
    {
        static::addGlobalScope('branch_access', function (Builder $builder) {
            $user = auth()->user();
            $membership = $user?->membership;

            if (! $membership) {
                return;
            }

            $branchIds = $membership->accessibleBranchIds();

            // Employee has no branch_id column of its own — its branch is
            // derived from the open-ended employee_assignments row — so the
            // restriction is expressed as a relationship constraint rather
            // than a plain column filter.
            if ($branchIds !== null) {
                $builder->whereHas(
                    'currentAssignment',
                    fn (Builder $query) => $query->whereIn('branch_id', $branchIds),
                );
            }
        });
    }

    public function scopeWithoutBranchAccessScope(Builder $builder): Builder
    {
        return $builder->withoutGlobalScope('branch_access');
    }
}
