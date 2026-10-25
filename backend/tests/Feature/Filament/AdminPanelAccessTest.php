<?php

namespace Tests\Feature\Filament;

use App\Filament\Resources\CompanyResource;
use App\Filament\Resources\PlanResource\Pages\ManagePlans;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformPermission;
use App\Models\PlatformRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class AdminPanelAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_admin_can_load_every_platform_resource(): void
    {
        $admin = PlatformAdmin::factory()->create();

        $pages = [
            '/admin',
            '/admin/companies',
            '/admin/plans',
            '/admin/modules',
            '/admin/subscriptions',
            '/admin/company-module-entitlements',
            '/admin/audit-logs',
            '/admin/feature-flags',
            '/admin/system-settings',
        ];

        foreach ($pages as $page) {
            $this->actingAs($admin, 'platform')->get($page)->assertOk();
        }
    }

    public function test_a_platform_admin_only_opens_the_areas_their_roles_allow(): void
    {
        // No role: signed in, but nothing to open.
        $nobody = PlatformAdmin::factory()->withoutRoles()->create();
        $this->actingAs($nobody, 'platform')->get('/admin/companies')->assertForbidden();
        $this->actingAs($nobody, 'platform')->get('/admin/plans')->assertForbidden();

        // A support role sees companies, and nothing about plans.
        $support = PlatformRole::query()->create(['name' => 'Support', 'code' => 'support']);
        $support->permissions()->attach(PlatformPermission::query()->whereIn('code', ['companies.view'])->pluck('id'));
        $agent = PlatformAdmin::factory()->withoutRoles()->create();
        $agent->roles()->attach($support);

        $this->actingAs($agent, 'platform')->get('/admin/companies')->assertOk();
        $this->actingAs($agent, 'platform')->get('/admin/plans')->assertForbidden();
        $this->assertFalse(CompanyResource::canCreate());
        $this->assertFalse(CompanyResource::canDeleteAny());
    }

    public function test_platform_admin_can_edit_a_plan_in_a_modal(): void
    {
        $admin = PlatformAdmin::factory()->create();
        $plan = Plan::factory()->create();
        $plan->prices()->create(['interval' => 'monthly', 'price_cents' => 1900, 'currency' => 'USD']);

        Livewire::actingAs($admin, 'platform')
            ->test(ManagePlans::class)
            ->mountTableAction('edit', $plan)
            ->setTableActionData(['name' => 'Renamed Plan'])
            ->callMountedTableAction()
            ->assertHasNoTableActionErrors();

        $this->assertSame('Renamed Plan', $plan->fresh()->name);
    }

    public function test_platform_admin_can_create_a_plan_in_a_modal(): void
    {
        $admin = PlatformAdmin::factory()->create();

        Livewire::actingAs($admin, 'platform')
            ->test(ManagePlans::class)
            ->mountAction('create')
            ->setActionData([
                'name' => 'Enterprise',
                'code' => 'enterprise',
                'status' => 'active',
            ])
            ->callMountedAction()
            ->assertHasNoActionErrors();

        $this->assertTrue(Plan::query()->where('code', 'enterprise')->exists());
    }

    public function test_inactive_platform_admin_cannot_access_admin_panel(): void
    {
        $admin = PlatformAdmin::factory()->create(['status' => 'suspended']);

        $this->actingAs($admin, 'platform')->get('/admin')->assertForbidden();
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/admin')->assertRedirect('/admin/login');
    }
}
