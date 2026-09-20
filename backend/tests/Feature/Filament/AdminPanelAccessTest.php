<?php

namespace Tests\Feature\Filament;

use App\Filament\Resources\PlanResource\Pages\ManagePlans;
use App\Models\Plan;
use App\Models\PlatformAdmin;
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
