<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyPermission;
use App\Models\CompanyRole;
use App\Models\User;
use App\Support\CompanyPermissions;
use Illuminate\Support\Str;

/**
 * Creates a new tenant: the Company row, its default role set, and the
 * first Company Admin user. Anything that needs to happen once per company
 * (Stage 1 roles now, module defaults later) belongs here rather than
 * scattered across controllers.
 */
class CompanyProvisioner
{
    public const ROLES = ['company-admin', 'manager', 'employee'];

    public function provision(string $companyName, string $adminName, string $adminEmail, string $adminPassword): Company
    {
        $company = Company::query()->create([
            'name' => $companyName,
            'slug' => Str::slug($companyName).'-'.Str::lower(Str::random(4)),
            'status' => 'trial',
            'trial_ends_at' => now()->addDays(14),
        ]);

        $roles = [];

        foreach (self::ROLES as $roleCode) {
            $role = CompanyRole::query()->create([
                'company_id' => $company->id,
                'name' => $roleCode,
                'code' => $roleCode,
                'is_system_role' => true,
            ]);

            $permissionIds = collect(CompanyPermissions::forRole($roleCode))
                ->map(function (string $code) {
                    return CompanyPermission::query()->firstOrCreate(['code' => $code], ['name' => $code])->id;
                });

            $role->permissions()->sync($permissionIds);

            $roles[$roleCode] = $role;
        }

        $admin = User::query()->create([
            'name' => $adminName,
            'email' => $adminEmail,
            'password' => $adminPassword,
        ]);

        $membership = $admin->membership()->create([
            'company_id' => $company->id,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $membership->roles()->attach($roles['company-admin']->id, ['created_at' => now()]);

        NotificationService::send(
            $admin,
            'welcome',
            'Welcome to Business OS',
            "{$company->name} is set up and on a 14-day trial.",
            ['company_id' => $company->id],
        );

        return $company;
    }
}
