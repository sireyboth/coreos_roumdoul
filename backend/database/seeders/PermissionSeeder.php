<?php

namespace Database\Seeders;

use App\Models\CompanyPermission;
use App\Support\CompanyPermissions;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (CompanyPermissions::all() as $code) {
            CompanyPermission::query()->firstOrCreate(['code' => $code], ['name' => $code]);
        }
    }
}
