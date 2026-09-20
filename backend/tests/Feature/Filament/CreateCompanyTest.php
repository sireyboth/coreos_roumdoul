<?php

namespace Tests\Feature\Filament;

use App\Filament\Resources\CompanyResource\Pages\ManageCompanies;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\PlatformAdmin;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class CreateCompanyTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_admin_creating_a_company_also_provisions_roles_and_an_admin_user(): void
    {
        $this->seed(PermissionSeeder::class);

        $platformAdmin = PlatformAdmin::factory()->create();

        Livewire::actingAs($platformAdmin, 'platform')
            ->test(ManageCompanies::class)
            ->mountAction('create')
            ->setActionData([
                'name' => 'Manually Onboarded Co',
                'admin_name' => 'Onboarded Admin',
                'admin_email' => 'admin@onboarded.test',
                'admin_password' => 'password123',
                'timezone' => 'Asia/Phnom_Penh',
                'status' => 'active',
            ])
            ->callMountedAction()
            ->assertHasNoActionErrors();

        $company = Company::query()->where('name', 'Manually Onboarded Co')->firstOrFail();
        $this->assertSame('active', $company->status);

        $admin = User::query()->where('email', 'admin@onboarded.test')->firstOrFail();
        $this->assertSame($company->id, $admin->company_id);
        $this->assertTrue($admin->membership->roles->contains('code', 'company-admin'));

        $auditLog = AuditLog::query()->where('event', 'company.created')->firstOrFail();
        $this->assertSame(PlatformAdmin::class, $auditLog->actor_type);
        $this->assertSame($platformAdmin->id, $auditLog->actor_id);
        $this->assertNotEmpty($auditLog->after_data);
    }
}
