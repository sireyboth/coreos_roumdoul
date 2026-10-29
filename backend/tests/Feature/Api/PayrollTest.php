<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceDay;
use App\Models\Company;
use App\Models\CompanyPermission;
use App\Models\CompanyRole;
use App\Models\Employee;
use App\Models\EmployeeSalary;
use App\Models\PayComponent;
use App\Models\PayrollAdjustment;
use App\Models\PayRun;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\TaxExchangeRate;
use App\Models\User;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Company\CompanyProvisioner;
use App\Services\Payroll\PayRunService;
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

    private function group(array $attributes): array
    {
        return $this->actingAs($this->admin)->postJson('/api/payroll/groups', ['name' => 'Factory', ...$attributes])->assertCreated()->json();
    }

    private function moveTo(Employee $employee, array $group, string $from = '2026-01-01')
    {
        return $this->actingAs($this->admin)->postJson("/api/employees/{$employee->id}/pay-groups", ['pay_group_id' => $group['id'], 'effective_from' => $from]);
    }

    private function createGroupRun(array $group, string $start, ?string $end = null)
    {
        return $this->actingAs($this->admin)->postJson('/api/payroll/runs', ['pay_group_id' => $group['id'], 'period_start' => $start, 'period_end' => $end]);
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

    public function test_approval_needs_no_blocking_problems_then_freezes_and_locks_only_those_days(): void
    {
        // One admin both prepares and approves here, as a small company allows.
        $this->company->update(['allow_self_approval' => true]);

        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $dara = $this->employee('Dara');
        $other = $this->employee('Other');
        $this->salary($dara, 400);
        $this->day($dara, '2026-09-02', ['status' => 'incomplete', 'scan_count' => 1]);

        $run = $this->createRun()->json();

        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")
            ->assertJsonValidationErrors(['status' => 'payslip has a problem']);

        // Count missing scans as present instead: nothing blocks any more.
        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['missing_scan_policy' => 'present'])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")
            ->assertOk()->assertJsonPath('status', 'approved');

        // Approving locked the attendance it used: Dara's September, nobody else's, nothing after.
        $recorder = app(AttendanceRecorder::class);
        $this->assertTrue($recorder->isLocked($this->company->id, '2026-09-10', $dara->id));
        $this->assertFalse($recorder->isLocked($this->company->id, '2026-09-10', $other->id));
        $this->assertFalse($recorder->isLocked($this->company->id, '2026-10-01', $dara->id));

        // Frozen: no recalculation, no adjustments, no salary change in that period, no delete.
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/calculate")->assertStatus(422);
        $this->actingAs($this->admin)->deleteJson("/api/payroll/runs/{$run['id']}")->assertStatus(422);
        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments', [
            'employee_id' => $dara->id, 'date' => '2026-09-20', 'kind' => 'earning', 'name' => 'Bonus', 'amount' => 10,
        ])->assertJsonValidationErrors('date');
        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments', [
            'employee_id' => $dara->id, 'date' => '2026-10-05', 'kind' => 'earning', 'name' => 'Bonus', 'amount' => 10,
        ])->assertCreated();
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

    public function test_bank_file_details_are_remembered_on_the_policy(): void
    {
        $details = ['chipmong' => ['company_code' => '0100718', 'debit_account' => '98410041']];

        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['bank_exports' => $details])
            ->assertOk()->assertJsonPath('bank_exports.chipmong.company_code', '0100718');
        $this->actingAs($this->admin)->getJson('/api/payroll/settings')
            ->assertJsonPath('policy.bank_exports', $details);

        // Only the known banks and fields are kept.
        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['bank_exports' => ['other' => ['x' => '1']]])
            ->assertJsonValidationErrors('bank_exports');
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

    public function test_a_company_can_switch_off_the_overtime_minimums(): void
    {
        $this->actingAs($this->admin)->getJson('/api/payroll/settings')->assertOk();
        $overtime = PayComponent::query()->where('code', 'OVERTIME')->first();
        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['enforce_overtime_minimums' => false])
            ->assertOk()->assertJsonPath('enforce_overtime_minimums', false);

        // Any rate the company chooses, just not a negative one.
        $this->actingAs($this->admin)->putJson("/api/payroll/components/{$overtime->id}", ['params' => ['workday' => -0.5, 'day_off' => 1, 'holiday' => 1]])
            ->assertJsonValidationErrors('params.workday');
        $this->actingAs($this->admin)->putJson("/api/payroll/components/{$overtime->id}", ['params' => ['workday' => 0.5, 'day_off' => 0, 'holiday' => 1]])
            ->assertOk();
        $this->actingAs($this->admin)->putJson("/api/payroll/components/{$overtime->id}", ['params' => ['workday' => 1, 'day_off' => 1.25, 'holiday' => 1.5]])
            ->assertOk();

        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520)->assertCreated();
        $this->day($sokha, '2026-09-04', ['overtime_minutes' => 360, 'overtime_type' => 'workday', 'overtime_status' => 'approved']);
        $this->day($sokha, '2026-09-06', ['kind' => 'weekly_off', 'overtime_minutes' => 240, 'overtime_type' => 'day_off', 'overtime_status' => 'approved']);

        $run = $this->createRun()->assertCreated()->json();
        $slip = $this->payslip($run['payslips'][0]['id']);
        $this->assertSame('6 h × 2.5 × 100% + 4 h × 2.5 × 125%', $this->line($slip, 'OVERTIME')['explanation']);
        $this->assertEquals(27.5, $this->line($slip, 'OVERTIME')['amount']);

        // Switched back on, the saved rates are lifted to the legal minimums again.
        $this->actingAs($this->admin)->putJson('/api/payroll/policy', ['enforce_overtime_minimums' => true])->assertOk();
        $run = $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/calculate")->assertOk()->json();
        $slip = $this->payslip($run['payslips'][0]['id']);
        $this->assertSame('6 h × 2.5 × 150% + 4 h × 2.5 × 200%', $this->line($slip, 'OVERTIME')['explanation']);
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

        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments/import', ['date' => '2026-09-15', 'rows' => [
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
            'employee_ids' => [$sokha->id, $dara->id], 'date' => '2026-09-15', 'kind' => 'earning', 'name' => 'Mission', 'amount' => 20, 'taxable' => true,
        ])->assertCreated()->assertJson(['created' => 2]);

        // Added after the calculation: the run says so until it is recalculated.
        $this->assertTrue($this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}")->json('is_stale'));
        $run = $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/calculate")->json();
        $this->assertFalse($run['is_stale']);
        $this->assertEquals([540, 420], collect($run['payslips'])->sortBy('employee.name')->pluck('gross')->map(fn ($g) => (float) $g)->reverse()->values()->all());

        // Removing one is a change too.
        $this->actingAs($this->admin)->deleteJson('/api/payroll/adjustments/'.PayrollAdjustment::query()->first()->id)->assertNoContent();
        $this->assertTrue($this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}")->json('is_stale'));

        $this->actingAs($this->admin)->postJson('/api/payroll/adjustments/bulk', [
            'employee_ids' => [$sokha->id, 999999], 'date' => '2026-09-15', 'kind' => 'earning', 'name' => 'Mission', 'amount' => 20,
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

        $this->assertStringContainsString('SOKHA,Sokha,2026-09-01,2026-09-30,USD', $csv);
        $this->assertStringContainsString('ABA,000123', $csv);
    }

    public function test_report_lists_each_payslip_with_its_lines(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $this->salary($this->employee('Sokha', ['bank_name' => 'ABA', 'bank_account_number' => '000123']), 520);
        $run = $this->createRun()->json();

        $report = $this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}/report")->assertOk()->json();

        $slip = $report['payslips'][0];
        $this->assertSame(['Sokha', 'ABA', '000123', 'bank'], [$slip['employee']['name'], $slip['employee']['bank_name'], $slip['employee']['bank_account_number'], $slip['employee']['payment_method']]);
        $base = collect($slip['lines'])->firstWhere('is_base', true);
        $this->assertSame(['earning', 520.0], [$base['kind'], (float) $base['amount']]);
        $this->assertNotNull(collect($slip['lines'])->firstWhere('code', 'TAX'));
    }

    // ───────────────────────────── Pay groups and periods ─────────────────────────────

    public function test_a_cut_off_period_crosses_months_and_pays_the_full_salary_without_tax(): void
    {
        $factory = $this->group(['schedule' => 'monthly', 'cutoff_days' => [25]]);
        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520);
        $this->moveTo($sokha, $factory)->assertCreated();
        $this->day($sokha, '2026-08-28', ['status' => 'absent', 'scan_count' => 0]);
        // Dated inside the period: paid. Dated after it: waits for the next period.
        foreach (['2026-09-20' => 'Mission', '2026-09-27' => 'Later bonus'] as $date => $name) {
            $this->actingAs($this->admin)->postJson('/api/payroll/adjustments', [
                'employee_id' => $sokha->id, 'date' => $date, 'kind' => 'earning', 'name' => $name, 'amount' => 30,
            ])->assertCreated();
        }

        $run = $this->createGroupRun($factory, '2026-08-26')->assertCreated()->json();

        $this->assertSame(['2026-08-26', '2026-09-25', '2026-09'], [$run['period_start'], $run['period_end'], $run['month']]);
        $this->assertSame('26 Aug – 25 Sep 2026', $run['period_label']);
        $this->assertContains('no_tax_nssf', collect($run['warnings'])->pluck('code'));
        $slip = $this->payslip($run['payslips'][0]['id']);
        $this->assertSame('Full month', $this->line($slip, 'BASE')['explanation']);
        $this->assertEquals(520, $this->line($slip, 'BASE')['amount']);
        $this->assertEquals(20, $this->line($slip, 'ABSENCE')['amount']);
        $this->assertNotNull(collect($slip['lines'])->firstWhere('name', 'Mission'));
        $this->assertNull(collect($slip['lines'])->firstWhere('name', 'Later bonus'));
        $this->assertEquals([530, 0, 0, 530], [$slip['gross'], $slip['tax'], $slip['nssf_employee'], $slip['net']]);
        // Gross shared out by day: 6 days of August, 25 of September.
        $this->assertEquals([['month' => '2026-08', 'days' => 6, 'gross' => 102.58], ['month' => '2026-09', 'days' => 25, 'gross' => 427.42]], $slip['inputs']['months']);

        // The default group's September run leaves Sokha out: they are paid with Factory.
        $this->assertSame([], $this->createRun()->json('payslips'));
    }

    public function test_twice_a_month_pays_half_each_period_and_periods_never_overlap(): void
    {
        $half = $this->group(['name' => 'Twice a month', 'schedule' => 'semi_monthly', 'cutoff_days' => [31, 15]]);
        $this->assertSame([15, 31], $half['cutoff_days']);
        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520);
        $this->moveTo($sokha, $half);
        $transport = $this->actingAs($this->admin)->postJson('/api/payroll/components', ['name' => 'Transport', 'kind' => 'earning', 'method' => 'employee_item'])->json();
        $this->actingAs($this->admin)->postJson("/api/employees/{$sokha->id}/pay-items", ['pay_component_id' => $transport['id'], 'amount' => 20, 'effective_from' => '2026-01-01'])->assertCreated();

        $first = $this->createGroupRun($half, '2026-09-01')->assertCreated()->json();
        $slip = $this->payslip($first['payslips'][0]['id']);
        $this->assertSame('2026-09-15', $first['period_end']);
        $this->assertEquals(260, $this->line($slip, 'BASE')['amount']);
        $this->assertSame('520.00 × 1/2', $this->line($slip, 'BASE')['explanation']);
        $this->assertEquals(10, $this->line($slip, 'TRANSPORT')['amount']);

        $this->createGroupRun($half, '2026-09-01')->assertJsonValidationErrors('period_start');
        $this->createGroupRun($half, '2026-09-03')->assertJsonValidationErrors('period_start');
        $this->createGroupRun($half, '2026-09-16')->assertCreated()->assertJsonPath('period_end', '2026-09-30');

        // The periods to pick from, newest first, with their runs.
        $periods = $this->actingAs($this->admin)->getJson("/api/payroll/groups/{$half['id']}/periods")->assertOk()->json();
        $this->assertSame(['1 – 15 Oct 2026', '16 – 30 Sep 2026', '1 – 15 Sep 2026'], array_slice(array_column($periods, 'label'), 0, 3));
        $this->assertNull($periods[0]['run']);
        $this->assertSame($first['id'], $periods[2]['run']['id']);
    }

    public function test_a_weekly_period_can_cross_months_for_daily_workers(): void
    {
        $weekly = $this->group(['name' => 'Weekly', 'schedule' => 'weekly', 'anchor_date' => '2026-09-07']);
        $rith = $this->employee('Rith');
        $this->salary($rith, 15, payType: 'daily');
        $this->moveTo($rith, $weekly);
        foreach (['2026-09-27', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-05'] as $date) {
            $this->day($rith, $date);
        }

        $run = $this->createGroupRun($weekly, '2026-09-28')->assertCreated()->json();

        $this->assertSame('28 Sep – 4 Oct 2026', $run['period_label']);
        $this->assertSame('3 worked = 3 days × 15', $this->line($this->payslip($run['payslips'][0]['id']), 'BASE')['explanation']);
    }

    public function test_a_custom_group_takes_any_range_and_pays_the_share_of_each_month(): void
    {
        $custom = $this->group(['name' => 'Projects', 'schedule' => 'custom']);
        $nita = $this->employee('Nita');
        $this->salary($nita, 310);
        $this->moveTo($nita, $custom);

        $this->createGroupRun($custom, '2026-07-01', '2026-09-30')->assertJsonValidationErrors('period_end');
        $run = $this->createGroupRun($custom, '2026-09-10', '2026-10-05')->assertCreated()->json();

        // 21/30 of September + 5/31 of October.
        $base = $this->line($this->payslip($run['payslips'][0]['id']), 'BASE');
        $this->assertEquals(267, $base['amount']);
        $this->assertSame('310.00 × 0.8613 month', $base['explanation']);
        $this->createGroupRun($custom, '2026-10-01', '2026-10-08')->assertJsonValidationErrors('period_start');
    }

    public function test_moving_group_mid_period_splits_the_salary_between_both_runs(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $half = $this->group(['name' => 'Twice a month', 'schedule' => 'semi_monthly', 'cutoff_days' => [15, 31]]);
        $dara = $this->employee('Dara');
        $this->salary($dara, 520);
        $this->moveTo($dara, $half, '2026-09-16')->assertCreated();

        $monthly = $this->payslip($this->createRun()->json('payslips.0.id'));
        $this->assertEquals(260, $this->line($monthly, 'BASE')['amount']);
        $this->assertSame('520.00 × 15/30 days', $this->line($monthly, 'BASE')['explanation']);

        $second = $this->payslip($this->createGroupRun($half, '2026-09-16')->json('payslips.0.id'));
        $this->assertEquals(260, $this->line($second, 'BASE')['amount']);

        // Nobody is in Twice a month for 1–15 September.
        $this->assertSame([], $this->createGroupRun($half, '2026-09-01')->json('payslips'));
    }

    public function test_a_group_can_use_its_own_rates_and_rules(): void
    {
        $this->actingAs($this->admin)->getJson('/api/payroll/settings')->assertOk();
        $absence = PayComponent::query()->where('code', 'ABSENCE')->first();
        $late = PayComponent::query()->where('code', 'LATE')->first();
        $strict = $this->group(['name' => 'Strict', 'schedule' => 'monthly', 'cutoff_days' => [31], 'rate_basis_days' => 20, 'component_rules' => [
            $absence->id => ['is_active' => false],
            $late->id => ['params' => ['mode' => 'per_time', 'grace_minutes' => 0, 'amount' => 2, 'free_count' => 0, 'every_n' => 3, 'tiers' => []]],
        ]]);
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha');
        $this->salary($sokha, 520);
        $this->moveTo($sokha, $strict);
        $this->day($sokha, '2026-09-01', ['status' => 'absent', 'scan_count' => 0]);
        $this->day($sokha, '2026-09-02', ['late_minutes' => 5]);

        $slip = $this->payslip($this->createGroupRun($strict, '2026-09-01')->json('payslips.0.id'));

        $this->assertEquals(26, $slip['daily_rate']);
        $this->assertNull($this->line($slip, 'ABSENCE'));
        $this->assertSame('1 times × 2.00', $this->line($slip, 'LATE')['explanation']);
        // The company's own rules are untouched.
        $this->assertTrue($absence->fresh()->is_active);
        $this->assertSame('per_minute', $late->fresh()->params['mode']);
    }

    public function test_one_person_can_be_recalculated_alone_and_the_run_says_whose_pay_is_stale(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha');
        $dara = $this->employee('Dara');
        $this->salary($sokha, 520);
        $this->salary($dara, 400);
        $run = $this->createRun()->json();
        $daraSlip = collect($run['payslips'])->firstWhere('employee.id', $dara->id)['id'];

        $this->day($sokha, '2026-09-03', ['status' => 'absent', 'scan_count' => 0]);

        $run = $this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}")->json();
        $this->assertSame([true, false, [$sokha->id]], [$run['is_stale'], $run['stale_everyone'], $run['stale_employee_ids']]);

        $run = $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/employees/{$sokha->id}/calculate")->assertOk()->json();

        $this->assertFalse($run['is_stale']);
        $this->assertEquals(20, $this->line($this->payslip(collect($run['payslips'])->firstWhere('employee.id', $sokha->id)['id']), 'ABSENCE')['amount']);
        // Dara's payslip was left alone.
        $this->assertSame($daraSlip, collect($run['payslips'])->firstWhere('employee.id', $dara->id)['id']);
        $this->assertEquals(500 + 400, $run['totals']['USD']['gross']);
    }

    public function test_an_automatic_group_prepares_the_period_that_just_ended(): void
    {
        $half = $this->group(['name' => 'Twice a month', 'schedule' => 'semi_monthly', 'cutoff_days' => [15, 31], 'auto_calculate' => true]);
        $this->salary($sokha = $this->employee('Sokha'), 520);
        $this->moveTo($sokha, $half);

        $this->assertCount(1, app(PayRunService::class)->prepareDue());
        $this->assertCount(0, app(PayRunService::class)->prepareDue());

        $run = PayRun::query()->sole();
        $this->assertSame(['2026-09-16', '2026-09-30', 'calculated', null], [$run->period_start->toDateString(), $run->period_end->toDateString(), $run->status, $run->calculated_by]);
    }

    public function test_a_paid_period_cant_be_moved_to_another_group(): void
    {
        // One admin both prepares and approves here, as a small company allows.
        $this->company->update(['allow_self_approval' => true]);

        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $half = $this->group(['name' => 'Twice a month', 'schedule' => 'semi_monthly', 'cutoff_days' => [15, 31]]);
        $dara = $this->employee('Dara');
        $this->salary($dara, 400);
        $run = $this->createRun()->json();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertOk();

        $this->moveTo($dara, $half, '2026-09-20')->assertJsonValidationErrors(['effective_from' => 'already paid through 30 Sep 2026']);
        $this->moveTo($dara, $half, '2026-10-01')->assertCreated();

        $pay = $this->actingAs($this->admin)->getJson("/api/employees/{$dara->id}/pay")->assertOk()->json();
        $this->assertSame(['Twice a month', '2026-09-30'], [$pay['pay_group']['name'], $pay['paid_through']]);
        // The default group can't be deleted; a group with people in it neither.
        $default = collect($this->actingAs($this->admin)->getJson('/api/payroll/groups')->json())->firstWhere('is_default', true);
        $this->actingAs($this->admin)->deleteJson("/api/payroll/groups/{$default['id']}")->assertJsonValidationErrors('group');
        $this->actingAs($this->admin)->deleteJson("/api/payroll/groups/{$half['id']}")->assertJsonValidationErrors('group');
    }

    public function test_everyones_pay_setup_today_for_the_employee_export(): void
    {
        $half = $this->group(['name' => 'Twice a month', 'schedule' => 'semi_monthly', 'cutoff_days' => [15, 31]]);
        $transport = $this->actingAs($this->admin)->postJson('/api/payroll/components', ['name' => 'Transport', 'kind' => 'earning', 'method' => 'employee_item'])->json();
        $dara = $this->employee('Dara');
        $this->salary($dara, 400);
        $this->salary($dara, 450, 'USD', '2026-10-01', 'monthly', 'promotion');
        $this->moveTo($dara, $half);
        $this->actingAs($this->admin)->putJson("/api/employees/{$dara->id}/pay-profile", ['nssf_enrolled' => false, 'child_dependents' => 2])->assertOk();
        $this->actingAs($this->admin)->postJson("/api/employees/{$dara->id}/pay-items", ['pay_component_id' => $transport['id'], 'amount' => 20, 'effective_from' => '2026-01-01', 'effective_to' => '2026-06-30'])->assertCreated();
        $this->actingAs($this->admin)->postJson("/api/employees/{$dara->id}/pay-items", ['pay_component_id' => $transport['id'], 'amount' => 25, 'effective_from' => '2026-07-01'])->assertCreated();
        $vy = $this->employee('Vy');

        $pay = $this->actingAs($this->admin)->getJson('/api/payroll/employee-pay')->assertOk()->json();

        $this->assertContains('Transport', array_column($pay['item_components'], 'name'));
        $this->assertContains('Transport', $this->actingAs($this->admin)->getJson('/api/payroll/item-options')->assertOk()->json('*.name'));
        $rows = collect($pay['employees'])->keyBy('employee_id');
        $this->assertSame(['amount' => '450.00', 'currency' => 'USD', 'pay_type' => 'monthly', 'effective_from' => '2026-10-01'], $rows[$dara->id]['salary']);
        $this->assertSame('Twice a month', $rows[$dara->id]['pay_group']['name']);
        $this->assertSame([false, 2], [$rows[$dara->id]['profile']['nssf_enrolled'], $rows[$dara->id]['profile']['child_dependents']]);
        // Only the item in force today.
        $this->assertSame(['25.00'], array_column($rows[$dara->id]['items'], 'amount'));
        // No setup yet: default group, default profile, no salary.
        $this->assertNull($rows[$vy->id]['salary']);
        $this->assertTrue($rows[$vy->id]['profile']['tax_resident']);
        $this->assertNotSame('Twice a month', $rows[$vy->id]['pay_group']['name']);

        $staff = $this->createUserWithRole($this->company, 'employee');
        $this->actingAs($staff)->getJson('/api/payroll/employee-pay')->assertForbidden();
    }

    public function test_hr_prepares_the_run_and_only_an_approver_can_approve_it(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $this->salary($this->employee('Sokha'), 520);
        $role = function (string $code, array $permissions) {
            $role = CompanyRole::query()->create(['company_id' => $this->company->id, 'name' => $code, 'code' => $code]);
            $role->permissions()->attach(CompanyPermission::query()->whereIn('code', $permissions)->pluck('id'));

            return $this->createUserWithRole($this->company, $code);
        };
        $hr = $role('hr-office', ['payroll.view', 'payroll.manage']);
        $boss = $role('approver', ['payroll.view', 'payroll.approve']);

        // HR calculates, but can't sign it off.
        $run = $this->actingAs($hr)->postJson('/api/payroll/runs', ['month' => '2026-09'])->assertCreated()->json();
        $this->actingAs($hr)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertForbidden();

        // The approver can't prepare runs, only approve them.
        $this->actingAs($boss)->postJson("/api/payroll/runs/{$run['id']}/calculate")->assertForbidden();
        $this->actingAs($boss)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertOk()->assertJsonPath('status', 'approved');
        $this->assertSame($boss->id, PayRun::query()->find($run['id'])->approved_by);

        // Then HR records the payment. The company admin still has every right.
        $this->actingAs($hr)->postJson("/api/payroll/runs/{$run['id']}/paid")->assertOk()->assertJsonPath('status', 'paid');
        $this->assertTrue($this->admin->fresh()->hasCompanyPermission('payroll.approve'));

        // Only an approver can undo the sign-off.
        $this->actingAs($hr)->postJson("/api/payroll/runs/{$run['id']}/reopen", ['reason' => 'Wrong scans'])->assertForbidden();
        $this->actingAs($boss)->postJson("/api/payroll/runs/{$run['id']}/reopen", ['reason' => 'Wrong scans'])->assertOk();
    }

    public function test_reopening_a_paid_run_unlocks_its_attendance_for_fixing(): void
    {
        // One admin both prepares and approves here, as a small company allows.
        $this->company->update(['allow_self_approval' => true]);

        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $dara = $this->employee('Dara');
        $this->salary($dara, 400);
        $run = $this->createRun()->json();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertOk();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/paid")->assertOk();

        $recorder = app(AttendanceRecorder::class);
        $this->assertTrue($recorder->isLocked($this->company->id, '2026-09-10', $dara->id));

        // A reason is required, and only a signed-off run can be reopened.
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/reopen")->assertJsonValidationErrors('reason');
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/reopen", ['reason' => 'Test scans were paid'])
            ->assertOk()->assertJsonPath('status', 'calculated');
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/reopen", ['reason' => 'Again'])
            ->assertJsonValidationErrors(['status' => 'Only an approved or paid']);

        // Attendance opens again, the run can be recalculated, and the reason is on record.
        $this->assertFalse($recorder->isLocked($this->company->id, '2026-09-10', $dara->id));
        $this->assertNull(PayRun::query()->find($run['id'])->paid_at);
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/calculate")->assertOk();
        $this->assertDatabaseHas('audit_logs', ['event' => 'pay_run.reopened', 'subject_id' => $run['id'], 'reason' => 'Test scans were paid']);
    }

    public function test_whoever_prepared_a_run_cant_also_approve_it(): void
    {
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $this->salary($this->employee('Sokha'), 520);
        $role = CompanyRole::query()->create(['company_id' => $this->company->id, 'name' => 'payroll-lead', 'code' => 'payroll-lead']);
        $role->permissions()->attach(CompanyPermission::query()->whereIn('code', ['payroll.view', 'payroll.manage', 'payroll.approve'])->pluck('id'));
        $lead = $this->createUserWithRole($this->company, 'payroll-lead');

        $run = $this->actingAs($lead)->postJson('/api/payroll/runs', ['month' => '2026-09'])->assertCreated()->json();
        $this->actingAs($lead)->postJson("/api/payroll/runs/{$run['id']}/approve")
            ->assertUnprocessable()->assertJsonValidationErrors('status');

        // Someone else signs it off, and the run still says who prepared it.
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertOk()->assertJsonPath('status', 'approved');
        $run = PayRun::query()->find($run['id']);
        $this->assertSame($lead->id, $run->calculated_by);
        $this->assertSame($this->admin->id, $run->approved_by);
    }

    public function test_changing_a_bank_account_after_approval_doesnt_redirect_that_pay(): void
    {
        $this->company->update(['allow_self_approval' => true]);
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $sokha = $this->employee('Sokha', ['bank_name' => 'ABA Bank', 'bank_account_number' => '000111']);
        $this->salary($sokha, 520);
        $run = $this->createRun()->assertCreated()->json();
        $this->actingAs($this->admin)->postJson("/api/payroll/runs/{$run['id']}/approve")->assertOk();

        $sokha->update(['bank_account_number' => '=HYPERLINK("http://evil")']);

        $csv = $this->actingAs($this->admin)->get("/api/payroll/runs/{$run['id']}/export")->assertOk()->streamedContent();
        $this->assertStringContainsString('000111', $csv);
        $this->assertStringNotContainsString('HYPERLINK', $csv);
        $this->assertSame('000111', collect($this->actingAs($this->admin)->getJson("/api/payroll/runs/{$run['id']}/report")->json('payslips'))->first()['employee']['bank_account_number']);
    }

    public function test_the_bank_export_keeps_formulas_as_text(): void
    {
        $this->company->update(['allow_self_approval' => true]);
        TaxExchangeRate::query()->create(['month' => '2026-09', 'rate' => 4100]);
        $this->salary($this->employee('Sokha', ['bank_account_number' => '=1+1']), 520);
        $run = $this->createRun()->assertCreated()->json();

        $csv = $this->actingAs($this->admin)->get("/api/payroll/runs/{$run['id']}/export")->assertOk()->streamedContent();
        $this->assertStringContainsString("'=1+1", $csv);
    }
}
