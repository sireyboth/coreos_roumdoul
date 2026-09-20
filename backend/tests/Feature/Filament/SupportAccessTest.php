<?php

namespace Tests\Feature\Filament;

use App\Models\AuditLog;
use App\Models\PlatformAdmin;
use App\Services\CompanyProvisioner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class SupportAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_admin_can_start_and_end_a_support_access_session(): void
    {
        $company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $platformAdmin = PlatformAdmin::factory()->create();

        Livewire::actingAs($platformAdmin, 'platform')
            ->test(\App\Filament\Resources\CompanyResource\Pages\ManageCompanies::class)
            ->callTableAction('start_support_access', $company, data: [
                'reason' => 'Investigating a billing question',
                'duration_minutes' => 30,
            ]);

        $session = $company->supportAccessSessions()->firstOrFail();
        $this->assertSame($platformAdmin->id, $session->platformAdmin->id);
        $this->assertNull($session->ended_at);
        $this->assertTrue($session->isActive());

        $startLog = AuditLog::query()->where('event', 'support_access.started')->firstOrFail();
        $this->assertSame(PlatformAdmin::class, $startLog->actor_type);

        Livewire::actingAs($platformAdmin, 'platform')
            ->test(\App\Filament\Resources\CompanyResource\Pages\ManageCompanies::class)
            ->callTableAction('end_support_access', $company);

        $this->assertNotNull($session->fresh()->ended_at);
        $this->assertFalse($session->fresh()->isActive());
        $this->assertTrue(AuditLog::query()->where('event', 'support_access.ended')->exists());
    }
}
