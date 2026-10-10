<?php

namespace App\Support;

/**
 * Starting points for payroll: the components every company gets, the
 * Cambodian statutory rates the platform ships with, and one-click presets.
 *
 * The statutory figures are a best starting point, NOT verified advice: an
 * accountant must confirm them (and the platform admin update them in
 * Filament) before anyone is paid with them.
 */
class PayrollDefaults
{
    /**
     * System components: every company has these. They can be tuned and
     * switched off, never deleted. Amounts are in each employee's salary currency.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function components(): array
    {
        return [
            ['code' => 'BASE', 'name' => 'Base salary', 'kind' => 'earning', 'method' => 'base', 'template' => null, 'params' => null, 'sort_order' => 10],
            ['code' => 'OVERTIME', 'name' => 'Overtime', 'kind' => 'earning', 'method' => 'template', 'template' => 'overtime',
                'params' => ['workday' => 1.5, 'day_off' => 2.0, 'holiday' => 2.0], 'sort_order' => 20],
            ['code' => 'ATTENDANCE_BONUS', 'name' => 'Attendance bonus', 'kind' => 'earning', 'method' => 'template', 'template' => 'attendance_bonus',
                'params' => ['amount' => 0, 'max_absent_days' => 0, 'max_late_count' => 0], 'sort_order' => 30, 'is_active' => false],
            ['code' => 'ABSENCE', 'name' => 'Absence', 'kind' => 'deduction', 'method' => 'template', 'template' => 'absence',
                'params' => ['multiplier' => 1], 'sort_order' => 50],
            ['code' => 'UNPAID_LEAVE', 'name' => 'Unpaid leave', 'kind' => 'deduction', 'method' => 'template', 'template' => 'unpaid_leave',
                'params' => [], 'sort_order' => 55],
            ['code' => 'LATE', 'name' => 'Late arrival', 'kind' => 'deduction', 'method' => 'template', 'template' => 'late',
                'params' => self::latenessParams(), 'sort_order' => 60],
            ['code' => 'EARLY_LEAVE', 'name' => 'Early leave', 'kind' => 'deduction', 'method' => 'template', 'template' => 'early_leave',
                'params' => self::latenessParams(), 'sort_order' => 65],
            ['code' => 'UNPAID_PERMISSION', 'name' => 'Unpaid permission', 'kind' => 'deduction', 'method' => 'template', 'template' => 'unpaid_permission',
                'params' => [], 'sort_order' => 70],
        ];
    }

    /** @return array<string, mixed> */
    public static function latenessParams(): array
    {
        return ['mode' => 'per_minute', 'grace_minutes' => 0, 'amount' => 0, 'free_count' => 0, 'every_n' => 3, 'tiers' => []];
    }

    /** @return array<string, mixed> */
    public static function policy(): array
    {
        return [
            'rate_basis' => 'fixed',
            'rate_basis_days' => 26,
            'hours_per_day' => 8,
            'missing_scan_policy' => 'review',
            'daily_paid_holidays' => true,
            'khr_rounding' => 100,
            'fallback_exchange_rate' => null,
        ];
    }

    /**
     * Cambodia, as shipped. VERIFY with an accountant before first use.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function statutoryRates(): array
    {
        return [
            [
                'country' => 'KH',
                'kind' => 'tax_on_salary',
                'effective_from' => '2023-01-01',
                'note' => 'Shipped default — verify brackets and allowances with an accountant.',
                'params' => [
                    'currency' => 'KHR',
                    // Monthly taxable salary in riel; up_to null = everything above.
                    'brackets' => [
                        ['up_to' => 1500000, 'rate' => 0],
                        ['up_to' => 2000000, 'rate' => 0.05],
                        ['up_to' => 8500000, 'rate' => 0.10],
                        ['up_to' => 12500000, 'rate' => 0.15],
                        ['up_to' => null, 'rate' => 0.20],
                    ],
                    // Per dependent (a spouse who doesn't work, each dependent child), off the taxable base.
                    'dependent_allowance' => 150000,
                    'non_resident_rate' => 0.20,
                    'deduct_employee_nssf' => false,
                ],
            ],
            [
                'country' => 'KH',
                'kind' => 'nssf',
                'effective_from' => '2022-10-01',
                'note' => 'Shipped default — verify rates, floor and ceiling with an accountant.',
                'params' => [
                    'currency' => 'KHR',
                    // Contributions are a share of the insured wage, kept between these.
                    'wage_floor' => 400000,
                    'wage_ceiling' => 1200000,
                    'employee' => ['pension' => 0.02],
                    'employer' => ['pension' => 0.02, 'health' => 0.026, 'occupational_risk' => 0.008],
                ],
            ],
        ];
    }

    /**
     * One-click starting setups. Each sets the policy and tunes the system
     * components' rules; amounts stay for the company to fill in.
     *
     * @return array<string, array{name: string, description: string, policy: array<string, mixed>, components: array<string, array<string, mixed>>}>
     */
    public static function presets(): array
    {
        return [
            'office' => [
                'name' => 'Office standard',
                'description' => '26-day month, per-minute late and early leave after 10 minutes, overtime 150% / 200%.',
                'policy' => ['rate_basis' => 'fixed', 'rate_basis_days' => 26, 'hours_per_day' => 8, 'missing_scan_policy' => 'review'],
                'components' => [
                    'LATE' => ['is_active' => true, 'params' => [...self::latenessParams(), 'mode' => 'per_minute', 'grace_minutes' => 10]],
                    'EARLY_LEAVE' => ['is_active' => true, 'params' => [...self::latenessParams(), 'mode' => 'per_minute', 'grace_minutes' => 10]],
                    'OVERTIME' => ['is_active' => true, 'params' => ['workday' => 1.5, 'day_off' => 2.0, 'holiday' => 2.0]],
                    'ABSENCE' => ['is_active' => true, 'params' => ['multiplier' => 1]],
                ],
            ],
            'factory' => [
                'name' => 'Factory standard',
                'description' => '26-day month, every 3 late arrivals cost one day, overtime 150% / 200%, attendance bonus ready to set.',
                'policy' => ['rate_basis' => 'fixed', 'rate_basis_days' => 26, 'hours_per_day' => 8, 'missing_scan_policy' => 'review'],
                'components' => [
                    'LATE' => ['is_active' => true, 'params' => [...self::latenessParams(), 'mode' => 'count_based', 'every_n' => 3]],
                    'EARLY_LEAVE' => ['is_active' => true, 'params' => [...self::latenessParams(), 'mode' => 'per_minute', 'grace_minutes' => 0]],
                    'OVERTIME' => ['is_active' => true, 'params' => ['workday' => 1.5, 'day_off' => 2.0, 'holiday' => 2.0]],
                    'ABSENCE' => ['is_active' => true, 'params' => ['multiplier' => 1]],
                ],
            ],
        ];
    }
}
