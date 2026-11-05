<?php

namespace App\Services\Company;

use App\Models\CompanyMembership;
use App\Models\CompanyRole;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Validation\ValidationException;

/**
 * Creates a login inside an existing company: the User, its company
 * membership, and its role. Shared by the Users page (inviting a teammate)
 * and the Employees flow (giving an employee a login), so both behave the
 * same way.
 */
class CompanyUserService
{
    /** A built-in role (company-admin, manager, employee) by its fixed code — whatever it's called now. */
    public static function roleByCode(int $companyId, string $code): CompanyRole
    {
        return CompanyRole::query()->where('company_id', $companyId)->where('code', $code)->firstOrFail();
    }

    /**
     * @param  string|null  $email  null for someone who signs in with an employee ID instead
     * @param  string|null  $loginId  the employee ID they sign in with (with the company code)
     */
    public function create(int $companyId, string $name, ?string $email, string $password, CompanyRole|string $roleName, ?string $loginId = null): User
    {
        // A role picked on screen comes by the name people see; code that means
        // a built-in role passes the role itself (see roleByCode), so renaming
        // a role never breaks it.
        $role = $roleName instanceof CompanyRole
            ? $roleName
            : CompanyRole::query()->where('company_id', $companyId)->where('name', $roleName)->firstOrFail();

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'is_active' => true,
        ]);

        $membership = $user->membership()->create([
            'company_id' => $companyId,
            // Lower-case so "E-001" and "e-001" are the same person.
            'login_id' => $loginId !== null ? self::normaliseLoginId($loginId) : null,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $membership->roles()->attach($role->id, ['created_at' => now()]);

        AuditLogger::record('user.invited', $user, [
            'name' => $user->name, 'email' => $user->email, 'login_id' => $membership->login_id, 'role' => $roleName,
        ]);

        return $user->fresh();
    }

    /**
     * An admin sets a new password for someone who forgot theirs. Every device
     * they were signed in on is signed out, so the old password stops working
     * everywhere at once.
     *
     * Two guards: your own password is changed from your Profile (which asks
     * for the current one), and only a company admin can reset a company
     * admin's — otherwise an HR manager could take over the owner's account.
     */
    public function resetPassword(User $actor, User $user, string $password): void
    {
        if ($actor->is($user)) {
            throw ValidationException::withMessages([
                'password' => [__('Change your own password from your Profile.')],
            ]);
        }

        if ($this->isCompanyAdmin($user) && ! $this->isCompanyAdmin($actor)) {
            throw ValidationException::withMessages([
                'password' => [__('Only a company admin can reset a company admin\'s password.')],
            ]);
        }

        $user->update(['password' => $password]);
        $user->tokens()->delete();

        // Never the password itself — just that it happened and who did it.
        AuditLogger::record('user.password_reset', $user, ['name' => $user->name]);
    }

    private function isCompanyAdmin(User $user): bool
    {
        return CompanyMembership::query()
            ->where('user_id', $user->id)
            ->whereHas('roles', fn ($query) => $query->where('code', 'company-admin'))
            ->exists();
    }

    public static function normaliseLoginId(string $loginId): string
    {
        return mb_strtolower(trim($loginId));
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
