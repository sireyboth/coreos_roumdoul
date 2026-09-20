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
}
