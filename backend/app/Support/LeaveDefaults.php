<?php

namespace App\Support;

/**
 * The leave types every company starts with, following the Cambodian Labour
 * Law as a baseline. Each company can change all of it afterwards — a policy
 * change should never need a code change. Have local HR/legal confirm the
 * numbers for a given company.
 *
 *  - annual     1.5 days per month of service (18 a year), +1 day per 3 years
 *               of service, usable once employed 12 months (Art. 166)
 *  - sick       with a medical certificate; pay is company policy
 *  - maternity  90 calendar days; the employer pays half for staff with a
 *               year of service (Art. 182–183), NSSF covers part
 *  - special    family events (wedding, birth, funeral): up to 7 days a year (Art. 171)
 *  - paternity  not set by law — company policy
 *  - unpaid     no balance, no pay
 */
final class LeaveDefaults
{
    /** @return array<int, array<string, mixed>> */
    public static function types(): array
    {
        $base = [
            'name_km' => null,
            'pay_percent' => 100,
            'counts' => 'work_days',
            'accrual' => 'none',
            'yearly_days' => null,
            'seniority_every_years' => null,
            'seniority_extra_days' => null,
            'eligible_after_months' => null,
            'requires_balance' => false,
            'allow_half_day' => true,
            'attachment_from_days' => null,
            'min_notice_days' => null,
            'max_days_per_request' => null,
            'gender' => null,
            'is_active' => true,
        ];

        return array_map(fn (array $type) => [...$base, ...$type], [
            [
                'code' => 'annual', 'name' => 'Annual leave', 'name_km' => 'ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ', 'sort_order' => 1,
                'accrual' => 'monthly', 'yearly_days' => 18, 'seniority_every_years' => 3, 'seniority_extra_days' => 1,
                'eligible_after_months' => 12, 'requires_balance' => true,
            ],
            [
                'code' => 'sick', 'name' => 'Sick leave', 'name_km' => 'ច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ', 'sort_order' => 2,
                // A medical certificate from the first day.
                'attachment_from_days' => 1,
            ],
            [
                'code' => 'special', 'name' => 'Special leave', 'name_km' => 'ច្បាប់ឈប់សម្រាកពិសេស', 'sort_order' => 3,
                'accrual' => 'yearly', 'yearly_days' => 7, 'requires_balance' => true,
            ],
            [
                'code' => 'maternity', 'name' => 'Maternity leave', 'name_km' => 'ច្បាប់ឈប់សម្រាកលំហែមាតុភាព', 'sort_order' => 4,
                'pay_percent' => 50, 'counts' => 'calendar_days', 'max_days_per_request' => 90, 'gender' => 'female', 'allow_half_day' => false,
            ],
            [
                'code' => 'paternity', 'name' => 'Paternity leave', 'name_km' => 'ច្បាប់ឈប់សម្រាកលំហែបិតុភាព', 'sort_order' => 5,
                'gender' => 'male',
            ],
            [
                'code' => 'unpaid', 'name' => 'Unpaid leave', 'name_km' => 'ច្បាប់ឈប់សម្រាកគ្មានប្រាក់ឈ្នួល', 'sort_order' => 6,
                'pay_percent' => 0,
            ],
        ]);
    }
}
