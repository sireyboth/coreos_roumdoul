<?php

namespace Database\Seeders;

use App\Models\Module;
use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $starter = Plan::query()->updateOrCreate(
            ['code' => 'starter'],
            [
                'name' => 'Starter',
                'description' => 'Attendance only, for small teams getting started.',
                'max_employees' => 25,
                'max_branches' => 1,
                'status' => 'active',
            ]
        );

        $growth = Plan::query()->updateOrCreate(
            ['code' => 'growth'],
            [
                'name' => 'Growth',
                'description' => 'Attendance + HR + Payroll for growing businesses.',
                'max_employees' => 200,
                'max_branches' => 10,
                'status' => 'active',
            ]
        );

        // Yearly priced at 10 months' worth (~17% off) — a standard SaaS discount.
        $starter->prices()->updateOrCreate(['interval' => 'monthly'], ['price_cents' => 0, 'currency' => 'USD']);
        $starter->prices()->updateOrCreate(['interval' => 'yearly'], ['price_cents' => 0, 'currency' => 'USD']);

        $growth->prices()->updateOrCreate(['interval' => 'monthly'], ['price_cents' => 4900, 'currency' => 'USD']);
        $growth->prices()->updateOrCreate(['interval' => 'yearly'], ['price_cents' => 49000, 'currency' => 'USD']);

        $starter->modules()->sync(
            Module::query()->whereIn('code', ['attendance'])->pluck('id')
        );

        $growth->modules()->sync(
            Module::query()->whereIn('code', ['attendance', 'hr', 'payroll'])->pluck('id')
        );
    }
}
