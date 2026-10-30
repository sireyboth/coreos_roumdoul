<?php

namespace Tests\Feature\Api\Organization;

use App\Models\Branch;
use App\Models\CompanyModuleEntitlement;
use App\Models\Employee;
use App\Models\Module;
use App\Services\Company\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/** ID cards: HR prints anyone's; staff only their own. */
class EmployeeCardTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    public function test_staff_can_only_open_their_own_card_but_hr_can_open_anyones(): void
    {
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);

        $company = app(CompanyProvisioner::class)->provision('Card Co', 'Boss', 'boss@card.test', 'password123');
        CompanyModuleEntitlement::query()->create([
            'company_id' => $company->id,
            'module_id' => Module::query()->where('code', 'id_cards')->value('id'),
            'is_enabled' => true,
        ]);
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $staff = $this->createUserWithRole($company, 'employee');
        $own = Employee::query()->create(['company_id' => $company->id, 'branch_id' => $branch->id, 'name' => 'Dara', 'user_id' => $staff->id]);
        $colleague = Employee::query()->create(['company_id' => $company->id, 'branch_id' => $branch->id, 'name' => 'Sok']);

        $this->actingAs($staff)->get("/api/employees/{$own->id}/card")->assertOk();
        $this->actingAs($staff)->getJson("/api/employees/{$colleague->id}/card")->assertForbidden();

        // The on-screen version: the same card as HTML, images inlined (no file paths leak).
        $html = $this->actingAs($staff)->get("/api/employees/{$own->id}/card/preview")->assertOk()->getContent();
        $this->assertStringContainsString('DARA', strtoupper((string) $html));
        $this->assertStringContainsString('data:image/png;base64,', (string) $html);
        $this->assertStringNotContainsString(public_path(), (string) $html);
        $this->actingAs($staff)->getJson("/api/employees/{$colleague->id}/card/preview")->assertForbidden();

        $this->app['auth']->forgetGuards();
        $admin = $company->users()->first();
        $this->actingAs($admin)->get("/api/v1/employees/{$colleague->id}/card")->assertOk();
        $this->actingAs($admin)->get("/api/v1/employees/{$colleague->id}/card/preview")->assertOk();
    }
}
