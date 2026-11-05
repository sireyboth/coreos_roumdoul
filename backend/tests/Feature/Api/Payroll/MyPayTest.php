<?php

namespace Tests\Feature\Api\Payroll;

use App\Models\Company;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\TaxExchangeRate;
use App\Models\User;
use App\Services\Company\CompanyProvisioner;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/** Employees see their own salary and released payslips on their profile, without HR permissions. */
class MyPayTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    private User $staff;

    private Employee $own;

    private Employee $colleague;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-10 10:00:00');

        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Pay Co', 'Boss', 'boss@pay.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh', 'allow_self_approval' => true]);
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        TaxExchangeRate::query()->create(['month' => '2026-08', 'rate' => 4100]);
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);

        // A plain staff member: no salary or payroll permission.
        $this->staff = $this->createUserWithRole($this->company, 'employee');
        $this->own = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Dara', 'employee_code' => 'E1', 'user_id' => $this->staff->id]);
        $this->colleague = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Sok', 'employee_code' => 'E2']);

        foreach ([$this->own, $this->colleague] as $employee) {
            $this->actingAs($this->admin)->postJson("/api/employees/{$employee->id}/salaries", [
                'amount' => 400, 'currency' => 'USD', 'pay_type' => 'monthly', 'effective_from' => '2026-01-01', 'reason' => 'hired',
            ])->assertCreated();
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function payRun(string $month, ?string $status = null): array
    {
        $run = $this->actingAs($this->admin)->postJson('/api/payroll/runs', ['month' => $month])->assertCreated()->json();
        // Approving recalculates first, so payslip ids are taken from the run it returns.
        if ($status === 'approved' || $status === 'paid') {
            $run = $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertOk()->json();
        }
        if ($status === 'paid') {
            $run = $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/paid")->assertOk()->json();
        }

        return $run;
    }

    private function slipOf(array $run, Employee $employee): int
    {
        return collect($run['payslips'])->firstWhere('employee.id', $employee->id)['id'];
    }

    public function test_an_employee_sees_their_salary_and_only_released_payslips(): void
    {
        $august = $this->payRun('2026-08', 'paid');
        $this->payRun('2026-09');

        $pay = $this->actingAs($this->staff)->getJson('/api/v1/profile/pay')->assertOk()->json();

        $this->assertEquals(400, $pay['salary']['amount']);
        $this->assertSame('USD', $pay['salary']['currency']);
        $this->assertSame('2026-01-01', $pay['salary']['effective_from']);
        // September is still being prepared, so only August shows — and only their own payslip.
        $this->assertCount(1, $pay['payslips']);
        $this->assertSame($this->slipOf($august, $this->own), $pay['payslips'][0]['id']);
        $this->assertSame('paid', $pay['payslips'][0]['status']);
        $this->assertEquals(400, $pay['payslips'][0]['gross']);

        $slip = $this->actingAs($this->staff)->getJson("/api/profile/payslips/{$pay['payslips'][0]['id']}")->assertOk()->json();
        $this->assertSame('Dara', $slip['employee']['name']);
        $this->assertNotEmpty($slip['lines']);
        // The company's own cost is not shown to the employee.
        $this->assertArrayNotHasKey('employer_cost', $slip);

        // HR's views stay closed.
        $this->actingAs($this->staff)->getJson("/api/employees/{$this->own->id}/pay")->assertForbidden();
        $this->actingAs($this->staff)->getJson("/api/payroll/payslips/{$pay['payslips'][0]['id']}")->assertForbidden();
    }

    public function test_a_colleagues_or_unreleased_payslip_cannot_be_opened(): void
    {
        $august = $this->payRun('2026-08', 'approved');
        $september = $this->payRun('2026-09');

        $this->actingAs($this->staff)->getJson("/api/profile/payslips/{$this->slipOf($august, $this->colleague)}")->assertNotFound();
        $this->actingAs($this->staff)->getJson("/api/profile/payslips/{$this->slipOf($september, $this->own)}")->assertNotFound();
        $this->actingAs($this->staff)->getJson("/api/profile/payslips/{$this->slipOf($august, $this->own)}")->assertOk();
    }

    public function test_someone_without_an_employee_record_or_without_the_module_gets_no_pay(): void
    {
        $this->actingAs($this->admin)->getJson('/api/profile/pay')->assertNotFound()->assertJsonPath('code', 'no_employee_record');

        Subscription::query()->where('company_id', $this->company->id)->update([
            'plan_id' => Plan::query()->where('code', 'starter')->firstOrFail()->id,
        ]);
        $this->actingAs($this->staff->fresh())->getJson('/api/profile/pay')->assertForbidden()->assertJsonPath('code', 'module_not_enabled');
    }
}
