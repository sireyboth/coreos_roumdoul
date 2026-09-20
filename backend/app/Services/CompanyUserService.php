<?php

namespace App\Services;

use App\Models\CompanyRole;
use App\Models\User;

/**
 * Creates a login inside an existing company: the User, its company
 * membership, and its role. Shared by the Users page (inviting a teammate)
 * and the Employees flow (giving an employee a login), so both behave the
 * same way.
 */
class CompanyUserService
{
    public function create(int $companyId, string $name, string $email, string $password, string $roleName): User
    {
        $role = CompanyRole::query()
            ->where('company_id', $companyId)
            ->where('name', $roleName)
            ->firstOrFail();

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'is_active' => true,
        ]);

        $membership = $user->membership()->create([
            'company_id' => $companyId,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $membership->roles()->attach($role->id, ['created_at' => now()]);

        AuditLogger::record('user.invited', $user, ['name' => $user->name, 'email' => $user->email, 'role' => $roleName]);

        return $user->fresh();
    }

    /**
     * Limits a login to exactly one branch, replacing any earlier restriction.
     * Used for employees, whose login should only see their own branch.
     */
    public function restrictToBranch(User $user, int $branchId): void
    {
        $membership = $user->membership;

        $membership->branchAccess()->delete();
        $membership->branchAccess()->create(['branch_id' => $branchId, 'created_at' => now()]);

        AuditLogger::record('user.branch_access_changed', $user, ['branch_ids' => [$branchId], 'reason' => 'employee branch']);
    }

    /**
     * When an employee moves branch their login follows — but only if it was
     * tied to the old branch alone. Someone left unrestricted, or given a
     * custom set of branches by an admin, is never changed behind their back.
     */
    public function followEmployeeBranch(User $user, ?int $from, ?int $to): void
    {
        if ($from === null || $to === null || $from === $to) {
            return;
        }

        if (array_map('intval', $user->membership?->accessibleBranchIds() ?? []) === [$from]) {
            $this->restrictToBranch($user, $to);
        }
    }
}
