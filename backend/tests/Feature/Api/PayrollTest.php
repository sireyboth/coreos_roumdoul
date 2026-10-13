<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceDay;
use App\Models\AttendancePeriod;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeSalary;
use App\Models\PayComponent;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\TaxExchangeRate;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * Standard payroll end to end: salary history, attendance → pay, NSSF and
 * tax, approval gates, and the rule templates.
 */
class PayrollTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-10 10:00:00');

        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Pay Co', 'Boss', 'boss@pay.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh']);
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    private function employee(string $name, array $attributes = []): Employee
    {
        return Employee::query()->create(['company_id' => $this->company->id, 'name' => $name, 'employee_code' => strtoupper($name), ...$attributes]);
    }

    private function salary(Employee $employee, float $amount, string $currency = 'USD', string $from = '2026-01-01', string $payType = 'monthly', string $reason = 'hired')
    {
        return $this->actingAs($this->admin)->postJson("/api/employees/{$employee->id}/salaries", [
            'amount' => $amount, 'currency' => $currency, 'pay_type' => $payType, 'effective_from' => $from, 'reason' => $reason,
        ]);
    }

    private function day(Employee $employee, string $date, array $attributes = []): void
    {
        AttendanceDay::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'date' => $date,
            'kind' => 'work', 'status' => 'complete', 'scan_count' => 2, 'is_closed' => true,
            'slots' => [], 'scans' => [], 'extra_scans' => [], 'exceptions' => [],
            ...$attributes,
        ]);
    }

    private function createRun(string $month = '2026-09')
    {
        return $this->actingAs($this->admin)->postJson('/api/payroll/runs', ['month' => $month]);
    }

    private function payslip(int $payslipId): array
    {
        return $this->actingAs($this->admin)->getJson("/api/payroll/payslips/{$payslipId}")->assertOk()->json();
    }

    private function line(array $payslip, string $code): ?array
    {
        return collect($payslip['lines'])->firstWhere('code', $code);
    }

    private function lockSeptember(): void
    {
        AttendancePeriod::query()->create(['company_id' => $this->company->id, 'month' => '2026-09', 'locked_at' => now(), 'locked_by' => $this->admin->id]);
    }

    // ───────────────────────────── Tests ─────────────────────────────

    public function test_worked_example_from_attendance_to_net_pay(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520)->assertCreated();

        // A transport allowance, set per person.
        $transport = $this->actingAs($this->admin)->postJson('/api/payroll/components', [
            'name' => 'Transport', 'kind' => 'earning', 'method' => 'employee_item', 'taxable' => true, 'nssf_insurable' => true,
        ])->assertCreated()->json();
        $this->actingAs($this->admin)->postJson("/api/employees/{$sokha->id}/pay-items", [
            'pay_component_id' => $transport['id'], 'amount' => 20, 'effective_from' => '2026-01-01',
        ])->assertCreated();

        $this->day($sokha, '2026-09-01', ['status' => 'absent', 'scan_count' => 0]);
        $this->day($sokha, '2026-09-02', ['late_minutes' => 20]);
        $this->day($sokha, '2026-09-03', ['late_minutes' => 25]);
        $this->day($sokha, '2026-09-04', ['overtime_minutes' => 360, 'overtime_type' => 'workday', 'overtime_status' => 'approved']);
        $this->day($sokha, '2026-09-06', ['kind' => 'weekly_off', 'overtime_minutes' => 240, 'overtime_type' => 'day_off', 'overtime_status' => 'approved']);
        // Pending overtime is not paid, only flagged.
        $this->day($sokha, '2026-09-07', ['overtime_minutes' => 60, 'overtime_type' => 'workday', 'overtime_status' => 'pending']);

        $run = $this->createRun()->assertCreated()->json();
        $this->assertSame('calculated', $run['status']);
        $slip = $this->payslip($run['payslips'][0]['id']);

        $this->assertSame('Full month', $this->line($slip, 'BASE')['explanation']);
        $this->assertEquals(520, $this->line($slip, 'BASE')['amount']);
        $this->assertEquals(20, $this->line($slip, 'ABSENCE')['amount']);
        $this->assertSame('1 day × 20', $this->line($slip, 'ABSENCE')['explanation']);
        $this->assertEquals(1.88, $this->line($slip, 'LATE')['amount']);
        $this->assertSame('45 min × 0.0417', $this->line($slip, 'LATE')['explanation']);
        $this->assertEquals(42.5, $this->line($slip, 'OVERTIME')['amount']);
        $this->assertSame('6 h × 2.5 × 150% + 4 h × 2.5 × 200%', $this->line($slip, 'OVERTIME')['explanation']);
        $this->assertEquals(20, $this->line($slip, 'TRANSPORT')['amount']);

        $this->assertEquals(560.62, $slip['gross']);
        // NSSF: insured wage capped at 1,200,000 KHR × 2% = 24,000 KHR ÷ 4,100.
        $this->assertEquals(5.85, $slip['nssf_employee']);
        // Tax: 2,298,542 KHR → 25,000 + 29,854 = 54,854 KHR ÷ 4,100.
        $this->assertEquals(13.38, $slip['tax']);
        $this->assertEquals(541.39, $slip['net']);
        $this->assertEquals(576.42, $slip['employer_cost']);

        $this->assertContains('pending_overtime', collect($slip['warnings'])->pluck('code'));
        $this->assertSame(['USD'], array_keys($run['totals']));
    }

    public function test_approval_needs_locked_attendance_and_no_blocking_problems_then_freezes(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $dara = $this->employee('Dara');
        $this->salary($dara, 400);
        $this->day($dara, '2026-09-02', ['status' => 'incomplete', 'scan_count' => 1]);

        $run = $this->createRun()->json();

        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")
            ->assertJsonValidationErrors(['status' => 'isn\'t locked']);

        $this->lockSeptember();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")
            ->assertJsonValidationErrors(['status' => 'payslip has a problem']);

        // Count missing scans as present instead: nothing blocks any more.
        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['missing_scan_policy' => 'present'])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")
            ->assertOk()->assertJsonPath('status', 'approved');

        // Frozen: no recalculation, no adjustments, no salary change in that month, no delete.
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/calculate")->assertStatus(422);
        $this->actingAs($this->admin)->deleteJson("/api/payroll/runs/{$run['id']}")->assertStatus(422);
        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments', [
            'employee_id' => $dara->id, 'month' => '2026-09', 'kind' => 'earning', 'name' => 'Bonus', 'amount' => 10,
        ])->assertJsonValidationErrors('month');
        $this->salary($dara, 450, from: '2026-09-15', reason: 'promotion')->assertJsonValidationErrors('effective_from');

        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/paid")->assertOk()->assertJsonPath('status', 'paid');
    }

    public function test_joiners_and_mid_month_raises_are_prorated_by_calendar_day(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $new = $this->employee('Nita', ['hire_date' => '2026-09-11']);
        $this->salary($new, 300, from: '2026-09-11');
        $this->salary($new, 450, from: '2026-09-21', reason: 'probation_passed')->assertCreated();

        $slip = $this->payslip($this->createRun()->json('payslips.0.id'));

        // 300 × 10/30 + 450 × 10/30
        $this->assertEquals(250, $this->line($slip, 'BASE')['amount']);
        $this->assertSame('300.00 × 10/30 days + 450.00 × 10/30 days', $this->line($slip, 'BASE')['explanation']);
        $this->assertSame(['2026-09-11', '2026-09-20'], [EmployeeSalary::query()->first()->effective_from->toDateString(), EmployeeSalary::query()->first()->effective_to->toDateString()]);
    }

    public function test_riel_salary_uses_dependents_and_rounds_net_to_100_riel(): void
    {
        $sophea = $this->employee('Sophea');
        $this->salary($sophea, 2000050, 'KHR');
        $this->actingAs($this->admin)->putJson("/api/employees/{$sophea->id}/pay-profile", ['spouse_dependent' => true, 'child_dependents' => 1])->assertOk();

        $slip = $this->payslip($this->createRun()->json('payslips.0.id'));

        $this->assertEquals(24000, $slip['nssf_employee']);
        // 2,000,050 − 2 × 150,000 = 1,700,050 → 5% of 200,050 = 10,003 (rounded to the riel).
        $this->assertEquals(10003, $slip['tax']);
        // 2,000,050 − 24,000 − 10,003 = 1,966,047 → nearest 100.
        $this->assertEquals(1966000, $slip['net']);
        $this->assertNull($slip['exchange_rate']);
    }

    public function test_dollar_salary_without_an_exchange_rate_blocks_approval(): void
    {
        $this->salary($this->employee('Vanna'), 500);

        $slip = $this->payslip($this->createRun()->json('payslips.0.id'));

        $this->assertTrue(collect($slip['warnings'])->firstWhere('code', 'no_exchange_rate')['blocking']);
        $this->assertEquals(0, $slip['tax']);

        // A company fallback rate fixes it.
        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['fallback_exchange_rate' => 4100])->assertOk();
        $run = $this->actingAs($this->admin)->postJson('/api/payroll/runs/'.$slip['pay_run_id'].'/calculate')->json();
        $this->assertSame([], $run['payslips'][0]['warnings']);
    }

    public function test_daily_workers_are_paid_for_days_worked_and_never_charged_absence(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $worker = $this->employee('Rith');
        $this->salary($worker, 15, payType: 'daily');
        foreach (['2026-09-01', '2026-09-02', '2026-09-03'] as $date) {
            $this->day($worker, $date);
        }
        $this->day($worker, '2026-09-04', ['status' => 'absent', 'scan_count' => 0]);

        $slip = $this->payslip($this->createRun()->json('payslips.0.id'));

        $this->assertEquals(45, $this->line($slip, 'BASE')['amount']);
        $this->assertSame('3 worked = 3 days × 15', $this->line($slip, 'BASE')['explanation']);
        $this->assertNull($this->line($slip, 'ABSENCE'));
    }

    public function test_lateness_templates_and_attendance_bonus_in_live_preview(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520);
        foreach (['2026-09-01' => 5, '2026-09-02' => 12, '2026-09-03' => 40, '2026-09-04' => 3] as $date => $late) {
            $this->day($sokha, $date, ['late_minutes' => $late]);
        }
        $this->actingAs($this->admin)->getJson('/api/payroll/settings')->assertOk();
        $late = PayComponent::query()->where('code', 'LATE')->first();
        $bonus = PayComponent::query()->where('code', 'ATTENDANCE_BONUS')->first();
        $preview = fn (int $componentId, array $params) => $this->actingAs($this->admin)->postJson('/api/payroll/preview', [
            'employee_id' => $sokha->id, 'month' => '2026-09', 'component_id' => $componentId, 'params' => $params,
        ])->assertOk()->json('lines');
        $base = ['mode' => 'per_minute', 'grace_minutes' => 0, 'amount' => 0, 'free_count' => 0, 'every_n' => 3, 'tiers' => []];

        // Per minute after 10 minutes' grace a day: (12−10) + (40−10) = 32 min.
        $this->assertSame('32 min × 0.0417 (after 10 min grace a day)', collect($preview($late->id, [...$base, 'grace_minutes' => 10]))->firstWhere('code', 'LATE')['explanation']);
        // Per time, first 2 free: (4 − 2) × 1.
        $this->assertEquals(2, collect($preview($late->id, [...$base, 'mode' => 'per_time', 'amount' => 1, 'free_count' => 2]))->firstWhere('code', 'LATE')['amount']);
        // Every 3 lates = a day's pay: 4 ÷ 3 = 1 day × 20.
        $this->assertEquals(20, collect($preview($late->id, [...$base, 'mode' => 'count_based']))->firstWhere('code', 'LATE')['amount']);
        // Tiers per day: ≤10 min 0.50, ≤30 min 1.00, longer half a day.
        $tiers = [['up_to_minutes' => null, 'amount' => 0, 'day_fraction' => 0.5], ['up_to_minutes' => 10, 'amount' => 0.5, 'day_fraction' => 0], ['up_to_minutes' => 30, 'amount' => 1, 'day_fraction' => 0]];
        $this->assertEquals(12, collect($preview($late->id, [...$base, 'mode' => 'tiers', 'tiers' => $tiers]))->firstWhere('code', 'LATE')['amount']);

        // The bonus allows 3 lates; 4 means not earned, so no line.
        $this->assertNull(collect($preview($bonus->id, ['amount' => 30, 'max_absent_days' => 0, 'max_late_count' => 3]))->firstWhere('code', 'ATTENDANCE_BONUS'));
        $this->assertEquals(30, collect($preview($bonus->id, ['amount' => 30, 'max_absent_days' => 0, 'max_late_count' => 4]))->firstWhere('code', 'ATTENDANCE_BONUS')['amount']);

        // Preview never saves.
        $this->assertSame('per_minute', $late->fresh()->params['mode']);
    }

    public function test_overtime_below_the_legal_minimum_is_refused(): void
    {
        $this->actingAs($this->admin)->getJson('/api/payroll/settings')->assertOk();
        $overtime = PayComponent::query()->where('code', 'OVERTIME')->first();

        $this->actingAs($this->admin)->putJson("/api/payroll/components/{$overtime->id}", ['params' => ['workday' => 1.25, 'day_off' => 2, 'holiday' => 2]])
            ->assertJsonValidationErrors('params.workday');

        $this->actingAs($this->admin)->deleteJson("/api/payroll/components/{$overtime->id}")->assertJsonValidationErrors('component');
    }

    public function test_presets_tune_policy_and_rules(): void
    {
        $this->actingAs($this->admin)->postJson('/api/payroll/presets', ['preset' => 'factory'])->assertOk();

        $this->assertSame('count_based', PayComponent::query()->where('code', 'LATE')->first()->params['mode']);
    }

    public function test_employee_form_salary_becomes_history_and_history_mirrors_the_profile(): void
    {
        $dara = $this->employee('Dara', ['hire_date' => '2025-03-01']);

        $this->actingAs($this->admin)->putJson("/api/employees/{$dara->id}", ['base_salary' => 400, 'salary_currency' => 'USD'])->assertOk();
        $first = EmployeeSalary::query()->sole();
        $this->assertSame(['2025-03-01', 'hired'], [$first->effective_from->toDateString(), $first->reason]);

        $this->salary($dara, 480, from: '2026-10-01', reason: 'annual_increase')->assertCreated();
        $this->assertEquals(480, $dara->fresh()->base_salary);

        // A future raise doesn't change today's salary yet.
        $this->salary($dara, 500, from: '2026-12-01', reason: 'promotion')->assertCreated();
        $this->assertEquals(480, $dara->fresh()->base_salary);

        // Only the latest can be removed; the one before runs on again.
        $latest = EmployeeSalary::query()->latest('effective_from')->first();
        $this->actingAs($this->admin)->deleteJson("/api/employees/{$dara->id}/salaries/{$first->id}")->assertJsonValidationErrors('salary');
        $this->actingAs($this->admin)->deleteJson("/api/employees/{$dara->id}/salaries/{$latest->id}")->assertNoContent();
        $this->assertNull(EmployeeSalary::query()->where('amount', 480)->first()->effective_to);
    }

    public function test_adjustments_import_reports_rows_it_cannot_match(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520);

        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments/import', ['month' => '2026-09', 'rows' => [
            ['employee_code' => 'SOKHA', 'kind' => 'earning', 'name' => 'Sales commission', 'amount' => 35],
            ['employee_code' => 'NOBODY', 'kind' => 'earning', 'name' => 'Bonus', 'amount' => 10],
        ]])->assertOk()->assertJson(['created' => 1, 'errors' => [['row' => 2]]]);

        $slip = $this->payslip($this->createRun()->json('payslips.0.id'));
        $this->assertEquals(35, collect($slip['lines'])->firstWhere('name', 'Sales commission')['amount']);
        $this->assertEquals(555, $slip['gross']);
    }

    public function test_one_adjustment_can_go_to_many_people_and_the_run_asks_to_recalculate(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha');
        $dara = $this->employee('Dara');
        $this->salary($sokha, 520);
        $this->salary($dara, 400);
        $run = $this->createRun()->json();
        $this->assertFalse($run['is_stale']);

        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments/bulk', [
            'employee_ids' => [$sokha->id, $dara->id], 'month' => '2026-09', 'kind' => 'earning', 'name' => 'Mission', 'amount' => 20, 'taxable' => true,
        ])->assertCreated()->assertJson(['created' => 2]);

        // Added after the calculation: the run says so until it is recalculated.
        $this->assertTrue($this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}")->json('is_stale'));
        $run = $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/calculate")->json();
        $this->assertFalse($run['is_stale']);
        $this->assertEquals([540, 420], collect($run['payslips'])->sortBy('employee.name')->pluck('gross')->map(fn ($g) => (float) $g)->reverse()->values()->all());

        // Removing one is a change too.
        $this->actingAs($this->admin)->deleteJson('/api/payroll/adjustments/'.\App\Models\PayrollAdjustment::query()->first()->id)->assertNoContent();
        $this->assertTrue($this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}")->json('is_stale'));

        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments/bulk', [
            'employee_ids' => [$sokha->id, 999999], 'month' => '2026-09', 'kind' => 'earning', 'name' => 'Mission', 'amount' => 20,
        ])->assertJsonValidationErrors('employee_ids');
    }

    public function test_employees_without_salary_are_listed_not_paid(): void
    {
        $this->employee('Nosalary');

        $run = $this->createRun()->assertCreated()->json();

        $this->assertSame([], $run['payslips']);
        $this->assertSame('no_salary', $run['warnings'][0]['code']);
    }

    public function test_payroll_needs_its_permission_and_module(): void
    {
        $staff = $this->createUserWithRole($this->company, 'employee');
        $this->actingAs($staff)->getJson('/api/payroll/runs')->assertForbidden();

        Subscription::query()->where('company_id', $this->company->id)->update([
            'plan_id' => Plan::query()->where('code', 'starter')->firstOrFail()->id,
        ]);
        $this->actingAs($this->admin->fresh())->getJson('/api/payroll/runs')->assertForbidden()->assertJsonPath('code', 'module_not_enabled');
    }

    public function test_export_lists_each_payslip(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $this->salary($this->employee('Sokha', ['bank_name' => 'ABA', 'bank_account_number' => '000123']), 520);
        $run = $this->createRun()->json();

        $csv = $this->actingAs($this->admin)->get("/api/payroll/runs/{$run['id']}/export")->assertOk()->streamedContent();

        $this->assertStringContainsString('SOKHA,Sokha,USD', $csv);
        $this->assertStringContainsString('ABA,000123', $csv);
    }
}
