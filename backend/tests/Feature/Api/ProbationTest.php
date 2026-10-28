<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\LeaveType;
use App\Models\Notification;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkSchedule;
use App\Services\CompanyProvisioner;
use App\Services\ProbationNotifier;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/**
 * Probation as HR runs it: each company picks its default length, every new
 * person on probation gets an end date (changeable), leave types can be held
 * back until it ends, and HR is reminded in time to pass or extend.
 *
 * "Today" is Monday 5 October 2026, 10:00 in Phnom Penh.
 */
class ProbationTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private Company $company;

    private User $admin;

    private Branch $branch;

    private WorkSchedule $schedule;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
        $this->travelTo(Carbon::parse('2026-10-05 10:00', 'Asia/Phnom_Penh'));

        $this->company = app(CompanyProvisioner::class)->provision('Trial Co', 'Boss', 'boss@trial.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh']);
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'starter')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $this->branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Main']);
        $this->schedule = $this->makeWorkSchedule(
            $this->company,
            [['in', '08:00'], ['out', '17:00']],
            weekdays: [1, 2, 3, 4, 5],
        );
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function hire(array $attributes = [])
    {
        return $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Sokha', 'branch_id' => $this->branch->id, 'employment_status' => 'probation', 'hire_date' => '2026-10-01', ...$attributes,
        ]);
    }

    /** @return array{0: User, 1: Employee} */
    private function onProbation(string $end, string $hire = '2026-08-01'): array
    {
        $user = $this->createUserWithRole($this->company, 'employee', ['name' => 'Dara']);
        $employee = Employee::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'display_name' => 'Dara', 'user_id' => $user->id,
            'employment_status' => 'probation', 'hire_date' => $hire, 'probation_end_date' => $end,
        ]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'branch_id' => $this->branch->id, 'effective_from' => '2020-01-01',
        ]);
        $this->assignSchedule($employee, $this->schedule);

        return [$user, $employee];
    }

    private function type(string $code): LeaveType
    {
        return LeaveType::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('code', $code)->firstOrFail();
    }

    private function alerts(string $type)
    {
        return Notification::query()->withoutGlobalScopes()->where('recipient_user_id', $this->admin->id)->where('notification_type', $type)->get();
    }

    private function notifyOn(string $localDateTime): int
    {
        return app(ProbationNotifier::class)->run($this->company->fresh(), CarbonImmutable::parse($localDateTime, 'Asia/Phnom_Penh'));
    }

    // ───────────────────────────── end date ─────────────────────────────

    public function test_a_new_person_on_probation_gets_the_company_default_of_three_months(): void
    {
        $this->hire()->assertCreated()->assertJsonPath('probation_end_date', '2026-12-31T00:00:00.000000Z');
    }

    public function test_the_company_can_choose_its_own_length_in_days_or_months(): void
    {
        $this->as($this->admin)->putJson('/api/probation/settings', ['probation_length' => 60, 'probation_unit' => 'days', 'probation_reminder_days' => 14])
            ->assertOk()->assertJsonPath('probation_length', 60);
        $this->hire()->assertCreated()->assertJsonPath('probation_end_date', '2026-11-29T00:00:00.000000Z');

        $this->as($this->admin)->putJson('/api/probation/settings', ['probation_length' => 1, 'probation_unit' => 'months', 'probation_reminder_days' => null])->assertOk();
        $this->hire(['name' => 'Vanna'])->assertCreated()->assertJsonPath('probation_end_date', '2026-10-31T00:00:00.000000Z');

        $company = $this->as($this->admin)->getJson('/api/me')->json('company');
        $this->assertSame([1, 'months', null], [$company['probation_length'], $company['probation_unit'], $company['probation_reminder_days']]);
    }

    public function test_hr_can_set_a_different_end_date_for_one_person_but_not_before_they_started(): void
    {
        $this->hire(['probation_end_date' => '2026-11-15'])->assertCreated()->assertJsonPath('probation_end_date', '2026-11-15T00:00:00.000000Z');
        $this->hire(['name' => 'Early', 'probation_end_date' => '2026-09-01'])->assertUnprocessable()->assertJsonValidationErrors('probation_end_date');
    }

    public function test_a_limit_too_long_for_its_unit_is_refused(): void
    {
        $this->as($this->admin)->putJson('/api/probation/settings', ['probation_length' => 30, 'probation_unit' => 'months'])
            ->assertUnprocessable()->assertJsonValidationErrors('probation_length');
    }

    // ───────────────────────────── leave ─────────────────────────────

    public function test_leave_held_back_during_probation_can_be_asked_for_from_the_day_after_it_ends(): void
    {
        $this->type('special')->update(['allowed_during_probation' => false]);
        [$user] = $this->onProbation('2026-10-31');
        $ask = fn (string $date) => $this->as($user)->postJson('/api/requests', ['leave_type_id' => $this->type('special')->id, 'start_date' => $date, 'end_date' => $date]);

        $ask('2026-10-20')->assertUnprocessable()->assertJsonPath('errors.start_date.0', 'Special leave can be taken once probation ends on 31 Oct 2026.');
        $ask('2026-11-02')->assertCreated();

        // Sick leave is still allowed.
        $this->as($user)->postJson('/api/requests', ['leave_type_id' => $this->type('sick')->id, 'start_date' => '2026-10-20', 'end_date' => '2026-10-20', 'day_part' => 'full'])
            ->assertJsonMissingValidationErrors('start_date');
    }

    public function test_hr_can_turn_the_rule_on_for_a_leave_type(): void
    {
        $type = $this->type('special');
        $this->as($this->admin)->putJson("/api/leave-types/{$type->id}", [
            'name' => $type->name, 'pay_percent' => 100, 'counts' => 'work_days', 'allow_half_day' => true, 'yearly_days' => 7, 'allowed_during_probation' => false,
        ])->assertOk()->assertJsonPath('allowed_during_probation', false);
    }

    // ───────────────────────────── pass / extend ─────────────────────────────

    public function test_passing_early_makes_them_active_and_ends_probation_today(): void
    {
        [, $employee] = $this->onProbation('2026-10-31');

        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/pass")->assertOk()
            ->assertJsonPath('employment_status', 'active')
            ->assertJsonPath('probation_end_date', '2026-10-05T00:00:00.000000Z');

        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/pass")->assertUnprocessable();
    }

    public function test_passing_late_keeps_the_real_end_date(): void
    {
        [, $employee] = $this->onProbation('2026-09-30');

        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/pass")->assertOk()
            ->assertJsonPath('probation_end_date', '2026-09-30T00:00:00.000000Z');
    }

    public function test_extending_needs_a_later_date(): void
    {
        [, $employee] = $this->onProbation('2026-10-31');

        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/extend", ['probation_end_date' => '2026-10-15'])->assertUnprocessable();
        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/extend", ['probation_end_date' => '2026-11-30'])->assertOk()
            ->assertJsonPath('employment_status', 'probation')
            ->assertJsonPath('probation_end_date', '2026-11-30T00:00:00.000000Z');
    }

    public function test_staff_cannot_pass_their_own_probation(): void
    {
        [$user, $employee] = $this->onProbation('2026-10-31');

        $this->as($user)->postJson("/api/employees/{$employee->id}/probation/pass")->assertForbidden();
    }

    // ───────────────────────────── reminders ─────────────────────────────

    public function test_hr_is_reminded_a_week_before_and_again_once_it_has_ended(): void
    {
        [, $employee] = $this->onProbation('2026-10-31');

        $this->assertSame(0, $this->notifyOn('2026-10-23 09:00'));
        $this->assertSame(1, $this->notifyOn('2026-10-24 09:00'));
        $this->notifyOn('2026-10-25 09:00');
        $this->assertCount(1, $this->alerts(ProbationNotifier::ENDING));
        $this->assertSame("Dara's probation ends on 31 Oct 2026", $this->alerts(ProbationNotifier::ENDING)->first()->title);

        $this->assertSame(0, $this->notifyOn('2026-10-31 07:00'));
        $this->notifyOn('2026-10-31 09:00');
        $this->notifyOn('2026-11-02 09:00');
        $this->assertCount(1, $this->alerts(ProbationNotifier::ENDED));
        $this->assertSame("/dashboard/employees/{$employee->id}", $this->alerts(ProbationNotifier::ENDED)->first()->link);
    }

    public function test_extending_brings_the_reminders_back_and_passing_closes_them(): void
    {
        [, $employee] = $this->onProbation('2026-10-08');
        $this->notifyOn('2026-10-05 09:00');
        $this->assertCount(1, $this->alerts(ProbationNotifier::ENDING));

        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/extend", ['probation_end_date' => '2026-10-10'])->assertOk();
        $this->assertNotNull($this->alerts(ProbationNotifier::ENDING)->first()->resolved_at);
        $this->notifyOn('2026-10-05 10:00');
        $this->assertCount(2, $this->alerts(ProbationNotifier::ENDING));

        $this->as($this->admin)->postJson("/api/employees/{$employee->id}/probation/pass")->assertOk();
        $this->assertSame(0, $this->notifyOn('2026-10-12 09:00'));
        $this->assertTrue($this->alerts(ProbationNotifier::ENDING)->every(fn ($n) => $n->resolved_at !== null));
    }
}
