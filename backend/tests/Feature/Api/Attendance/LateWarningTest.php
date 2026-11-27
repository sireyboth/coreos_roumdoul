<?php

namespace Tests\Feature\Api\Attendance;

use App\Models\AttendanceDay;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\Notification;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Attendance\LateWarningNotifier;
use App\Services\Company\CompanyProvisioner;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * Automatic late warnings: at N late (or early) days in a month the employee
 * and HR are told, again at each further multiple, never twice, and only for
 * companies that turned it on.
 *
 * "Today" is Friday 20 November 2026, 10:00 in Phnom Penh.
 */
class LateWarningTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    private User $staff;

    private Employee $employee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
        $this->travelTo(Carbon::parse('2026-11-20 10:00', 'Asia/Phnom_Penh'));

        $this->company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh', 'late_warning_limit' => 3]);
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();

        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Main']);
        $this->staff = $this->createUserWithRole($this->company, 'employee', ['name' => 'Dara']);
        $this->employee = Employee::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'name' => 'Dara', 'user_id' => $this->staff->id, 'employment_status' => 'active',
        ]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'branch_id' => $branch->id, 'effective_from' => '2020-01-01',
        ]);
    }

    /** A calculated work day with the given late / early minutes. */
    private function day(string $date, int $late = 0, int $early = 0): void
    {
        AttendanceDay::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'date' => $date,
            'kind' => 'work', 'status' => 'complete', 'late_minutes' => $late, 'early_leave_minutes' => $early,
        ]);
    }

    private function warn(?string $localDateTime = null): int
    {
        $this->company->refresh();

        return app(LateWarningNotifier::class)->run($this->company, $localDateTime ? CarbonImmutable::parse($localDateTime, 'Asia/Phnom_Penh') : null);
    }

    private function warnings(User $user)
    {
        return Notification::query()->withoutGlobalScopes()
            ->where('recipient_user_id', $user->id)
            ->where('notification_type', LateWarningNotifier::TYPE)
            ->get();
    }

    public function test_the_employee_and_hr_are_warned_at_the_limit(): void
    {
        $this->day('2026-11-03', late: 15);
        $this->day('2026-11-05', early: 20);
        $this->day('2026-11-09', late: 5);

        $this->assertSame(2, $this->warn());

        $mine = $this->warnings($this->staff)->sole();
        $this->assertSame('⚠️ You were late or left early 3 times this month', $mine->title);
        $this->assertStringContainsString('Tue 3 Nov late 15 min; Thu 5 Nov left early 20 min; Mon 9 Nov late 5 min', $mine->body);
        $this->assertSame('⚠️ Dara: late or left early 3 times this month', $this->warnings($this->admin)->sole()->title);
    }

    public function test_below_the_limit_nobody_is_warned(): void
    {
        $this->day('2026-11-03', late: 15);
        $this->day('2026-11-04');
        $this->day('2026-11-05', late: 3);

        $this->assertSame(0, $this->warn());
    }

    public function test_each_level_is_sent_once_then_again_at_the_next_multiple(): void
    {
        foreach (['03', '04', '05'] as $d) {
            $this->day("2026-11-{$d}", late: 10);
        }

        $this->assertSame(2, $this->warn());
        $this->assertSame(0, $this->warn()); // the next hourly run repeats nothing

        foreach (['06', '09'] as $d) {
            $this->day("2026-11-{$d}", late: 10);
        }
        $this->assertSame(0, $this->warn()); // 5 late: still level 1

        $this->day('2026-11-10', late: 10);
        $this->assertSame(2, $this->warn()); // 6 late: level 2
        $this->assertCount(2, $this->warnings($this->staff));
    }

    public function test_left_early_can_be_left_out(): void
    {
        $this->company->update(['late_warning_counts_early' => false]);
        $this->day('2026-11-03', late: 15);
        $this->day('2026-11-05', early: 20);
        $this->day('2026-11-09', late: 5);

        $this->assertSame(0, $this->warn());

        $this->day('2026-11-10', late: 1, early: 30);
        $this->assertSame(2, $this->warn());
        $this->assertSame('⚠️ You were late 3 times this month', $this->warnings($this->staff)->sole()->title);
    }

    public function test_only_this_month_counts(): void
    {
        $this->day('2026-10-28', late: 15);
        $this->day('2026-10-29', late: 15);
        $this->day('2026-11-03', late: 15);

        $this->assertSame(0, $this->warn());
    }

    public function test_nothing_is_sent_when_off_before_8am_or_for_someone_who_left(): void
    {
        foreach (['03', '04', '05'] as $d) {
            $this->day("2026-11-{$d}", late: 10);
        }

        $this->assertSame(0, $this->warn('2026-11-20 07:30'));

        $this->company->update(['late_warning_limit' => null]);
        $this->assertSame(0, $this->warn());

        $this->company->update(['late_warning_limit' => 3]);
        $this->employee->update(['employment_status' => 'resigned']);
        $this->assertSame(0, $this->warn());
    }

    public function test_the_command_runs_every_company_that_turned_it_on(): void
    {
        foreach (['03', '04', '05'] as $d) {
            $this->day("2026-11-{$d}", late: 10);
        }

        $this->artisan('attendance:late-warnings')->expectsOutput('Sent 2 late warning(s).')->assertSuccessful();
    }

    public function test_a_manager_sets_the_rule_and_it_shows_on_me(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/api/attendance/late-warnings', ['late_warning_limit' => 4, 'late_warning_counts_early' => false])
            ->assertOk()
            ->assertJson(['late_warning_limit' => 4, 'late_warning_counts_early' => false]);

        $this->getJson('/api/me')->assertJsonPath('company.late_warning_limit', 4)->assertJsonPath('company.late_warning_counts_early', false);

        // Turning it off.
        $this->putJson('/api/v1/attendance/late-warnings', ['late_warning_limit' => null, 'late_warning_counts_early' => true])->assertOk();
        $this->assertNull($this->company->fresh()->late_warning_limit);

        $this->putJson('/api/attendance/late-warnings', ['late_warning_limit' => 0, 'late_warning_counts_early' => true])->assertUnprocessable();
    }

    public function test_an_employee_cannot_change_the_rule(): void
    {
        $this->actingAs($this->staff)
            ->putJson('/api/attendance/late-warnings', ['late_warning_limit' => 1, 'late_warning_counts_early' => true])
            ->assertForbidden();
    }
}
