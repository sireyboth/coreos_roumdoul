<?php

namespace Tests\Concerns;

use App\Models\Company;
use App\Models\CompanyRole;
use App\Models\User;

/**
 * Replaces the old `User::factory(['company_id' => ...])->assignRole(...)`
 * pattern now that company membership is a real relationship
 * (company_memberships + membership_role) instead of a column on users.
 */
trait CreatesCompanyUsers
{
    protected function createUserWithRole(Company $company, string $roleCode, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);

        $membership = $user->membership()->create([
            'company_id' => $company->id,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $role = CompanyRole::query()->where('company_id', $company->id)->where('code', $roleCode)->firstOrFail();

        $membership->roles()->attach($role->id, ['created_at' => now()]);

        return $user->fresh();
    }
}
