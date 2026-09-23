<?php

namespace Database\Seeders;

use App\Models\Module;
use Illuminate\Database\Seeder;

class ModuleSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            ['code' => 'attendance', 'name' => 'Attendance', 'description' => 'Check-in/out, shifts, leave, overtime.'],
            ['code' => 'hr', 'name' => 'HR', 'description' => 'Employee lifecycle and records.'],
            ['code' => 'payroll', 'name' => 'Payroll', 'description' => 'Payroll calculation and payslips.'],
            ['code' => 'pos', 'name' => 'POS', 'description' => 'Point of sale.'],
            ['code' => 'inventory', 'name' => 'Inventory', 'description' => 'Stock and warehouse management.'],
            ['code' => 'crm', 'name' => 'CRM', 'description' => 'Customers and sales pipeline.'],
            ['code' => 'accounting', 'name' => 'Accounting', 'description' => 'Bookkeeping and financial reports.'],
            ['code' => 'id_cards', 'name' => 'ID Cards', 'description' => 'Printable employee ID card PDFs.'],
        ];

        foreach ($modules as $module) {
            Module::query()->updateOrCreate(['code' => $module['code']], $module);
        }
    }
}
