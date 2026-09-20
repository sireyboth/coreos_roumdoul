<?php

namespace App\Support;

/**
 * Single source of truth for what a company-scoped role can do. Used both to
 * seed the global permission catalog and to assign permissions to each new
 * company's roles when it's provisioned. Add a resource here once and every
 * company (new and existing, via re-running the seeder) gets it consistently.
 */
class CompanyPermissions
{
    public const RESOURCES = [
        'branches', 'departments', 'teams', 'employees', 'users', 'roles',
        'work_locations', 'shifts', 'holidays', 'schedules', 'attendance',
    ];

    /**
     * Permissions that don't follow the <resource>.view / .manage pattern.
     * "dashboard.view" gates the overview page: staff who only clock in and
     * check their own schedule don't need it.
     */
    public const STANDALONE = ['company.manage', 'dashboard.view'];

    /**
     * All permission strings that exist, e.g. "branches.view", "branches.manage".
     *
     * @return array<int, string>
     */
    public static function all(): array
    {
        $permissions = self::STANDALONE;

        foreach (self::RESOURCES as $resource) {
            $permissions[] = "{$resource}.view";
            $permissions[] = "{$resource}.manage";
        }

        return $permissions;
    }

    /**
     * The catalog grouped for a checkbox-list UI: one entry per resource plus
     * the standalone "company.manage" permission.
     *
     * @return array<int, array{resource: string, permissions: array<int, string>}>
     */
    public static function grouped(): array
    {
        $groups = [
            ['resource' => 'dashboard', 'permissions' => ['dashboard.view']],
            ['resource' => 'company', 'permissions' => ['company.manage']],
        ];

        foreach (self::RESOURCES as $resource) {
            $groups[] = [
                'resource' => $resource,
                'permissions' => ["{$resource}.view", "{$resource}.manage"],
            ];
        }

        return $groups;
    }

    /**
     * Which permissions each default company role gets.
     *
     * @return array<string, array<int, string>>
     */
    public static function forRole(string $role): array
    {
        return match ($role) {
            'company-admin' => self::all(),
            'manager' => [
                'dashboard.view',
                'branches.view',
                'departments.view',
                'teams.view',
                'teams.manage',
                'employees.view',
                'employees.manage',
                'work_locations.view',
                'shifts.view',
                'shifts.manage',
                'holidays.view',
                'holidays.manage',
                'schedules.view',
                'schedules.manage',
                'attendance.view',
                'attendance.manage',
            ],
            'employee' => [
                'employees.view',
                'schedules.view',
                'holidays.view',
                'attendance.view',
            ],
            default => [],
        };
    }
}
