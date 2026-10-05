<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\LeaveType;
use App\Models\Notification;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\CompanyProvisioner;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/**
 * Permission to arrive late or leave early: "I'll be in at 09:00 today".
 * Once approved, the day is judged against the approved time — only lateness
 * beyond it counts. Paid by default, at most 3 a month, both changeable.
 *
 * "Today" is Monday 5 October 2026, 10:00 in Phnom Penh. Dara works
 * Mon–Fri 08:00–12:00 + 13:00–17:00.
 */
class LateEarlyRequestTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private Company $company;

    private User $admin;

    private User $staff;

    private Employee $dara;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
        $this->travelTo(Carbon::parse('2026-10-05 10:00', 'Asia/Phnom_Penh'));

        $this->company = app(CompanyProvisioner::class)->provision('Late Co', 'Boss', 'boss@late.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'starter')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);
        $schedule = $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '12:00'], ['in', '13:00'], ['out', '17:00']], [], weekdays: [1, 2, 3, 4, 5]);

        $this->staff = $this->createUserWithRole($this->company, 'employee', ['name' => 'Dara']);
        $this->dara = Employee::query()->withoutGlobalScopes()->create(['company_id' => $this->company->id, 'display_name' => 'Dara', 'user_id' => $this->staff->id]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->dara->id, 'branch_id' => $branch->id, 'effective_from' => '2020-01-01',
        ]);
        $this->assignSchedule($this->dara, $schedule);
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function ask(string $date, string $kind, string $time, array $extra = [], ?User $as = null)
    {
        return $this->as($as ?? $this->staff)->postJson('/api/requests', [
            'type' => 'late_early', 'start_date' => $date, 'end_date' => $date, 'kind' => $kind, 'time' => $time, 'reason' => 'Hospital visit', ...$extra,
        ]);
    }

    private function approved(string $date, string $kind, string $time): int
    {
        $id = $this->ask($date, $kind, $time)->assertCreated()->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        return $id;
    }

    private function scans(string $date, array $times): void
    {
        foreach ($times as $time) {
            AttendanceEvent::query()->withoutGlobalScopes()->create([
                'company_id' => $this->company->id, 'employee_id' => $this->dara->id, 'method' => 'qr',
                'event_time' => Carbon::parse("{$date} {$time}", 'Asia/Phnom_Penh')->utc(),
            ]);
        }
        app(AttendanceRecorder::class)->recalculateRange($this->dara, $date, $date);
    }

    public function test_an_approved_late_arrival_is_not_late_and_only_time_beyond_it_counts(): void
    {
        $this->ask('2026-10-01', 'late', '09:00')
            ->assertCreated()
            ->assertJsonPath('type', 'late_early')
            ->assertJsonPath('label', 'Late arrival')
            ->assertJsonPath('details', ['kind' => 'late', 'time' => '09:00', 'minutes' => 60])
            ->assertJsonPath('days', 0);
        $id = \App\Models\EmployeeRequest::query()->withoutGlobalScopes()->latest('id')->value('id');

        $alert = Notification::query()->withoutGlobalScopes()->where('recipient_user_id', $this->admin->id)->where('notification_type', 'request.late_early_requested')->sole();
        $this->assertSame('⏰ Late arrival request from Dara', $alert->title);
        $this->assertSame('Late arrival · Thu 1 Oct · in at 09:00 (60 min) — Hospital visit', $alert->body);

        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        // Arrived 09:10: 10 minutes late, not 70.
        $this->scans('2026-10-01', ['09:10', '12:00', '13:00', '17:00']);
        $day = $this->attendanceDay($this->dara, '2026-10-01');
        $this->assertSame(10, $day->late_minutes);
        $this->assertStringContainsString('Late arrival 09:00 (approved)', $day->label);
    }

    public function test_an_approved_early_leave_is_not_early_leave(): void
    {
        $this->approved('2026-10-01', 'early', '15:00');
        $this->scans('2026-10-01', ['08:00', '12:00', '13:00', '15:00']);

        $day = $this->attendanceDay($this->dara, '2026-10-01');
        $this->assertSame('complete', $day->status);
        $this->assertSame(0, $day->early_leave_minutes);
        $this->assertSame([], $day->exceptions);
    }

    public function test_approved_afterwards_it_clears_a_late_day_already_recorded(): void
    {
        $this->scans('2026-10-01', ['08:45', '12:00', '13:00', '17:00']);
        $this->assertSame(45, $this->attendanceDay($this->dara, '2026-10-01')->late_minutes);

        $id = $this->approved('2026-10-01', 'late', '09:00');
        $this->assertSame(0, $this->attendanceDay($this->dara, '2026-10-01')->late_minutes);

        // Cancelled again: late again.
        $this->as($this->admin)->postJson("/api/requests/{$id}/cancel", ['reason' => 'Asked by mistake'])->assertOk();
        $this->assertSame(45, $this->attendanceDay($this->dara, '2026-10-01')->late_minutes);
    }

    public function test_the_time_must_fit_the_working_day(): void
    {
        $this->ask('2026-10-01', 'late', '07:30')->assertStatus(422)->assertJsonValidationErrors(['time' => 'after your start at 08:00']);
        $this->ask('2026-10-01', 'late', '17:30')->assertStatus(422)->assertJsonValidationErrors(['time' => 'before your day ends at 17:00']);
        $this->ask('2026-10-01', 'early', '17:00')->assertStatus(422)->assertJsonValidationErrors(['time' => 'before your day ends at 17:00']);
        $this->ask('2026-10-01', 'early', '07:00')->assertStatus(422)->assertJsonValidationErrors(['time' => 'after your start at 08:00']);
        $this->ask('2026-10-03', 'late', '09:00')->assertStatus(422)->assertJsonValidationErrors(['start_date' => 'no work scheduled']);
        $this->ask('2026-10-01', 'late', '9am')->assertStatus(422)->assertJsonValidationErrors('time');
        // Always with a reason when sent (the live preview works without one).
        $this->ask('2026-10-01', 'late', '09:00', ['reason' => ''])->assertStatus(422)->assertJsonValidationErrors('reason');
    }

    public function test_at_most_three_a_month_and_one_of_each_kind_a_day(): void
    {
        $this->ask('2026-10-01', 'late', '09:00')->assertCreated();
        $this->ask('2026-10-01', 'late', '09:30')->assertStatus(422)->assertJsonValidationErrors(['start_date' => 'Already asked']);
        // Late in the morning and early at the end of the same day is fine.
        $this->ask('2026-10-01', 'early', '16:00')->assertCreated();
        $cancelled = $this->ask('2026-10-02', 'late', '09:00')->assertCreated()->json('id');

        $this->ask('2026-10-06', 'late', '09:00')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['start_date' => 'at most 3 late arrivals / early leaves in October 2026']);

        // A withdrawn one doesn't count; another month is a fresh start.
        $this->as($this->staff)->postJson("/api/requests/{$cancelled}/cancel")->assertOk();
        $this->ask('2026-10-06', 'late', '09:00')->assertCreated();
        $this->ask('2026-11-02', 'late', '09:00')->assertCreated();
    }

    public function test_not_on_a_day_already_on_leave(): void
    {
        $annual = LeaveType::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('code', 'unpaid')->firstOrFail();
        $this->as($this->staff)->postJson('/api/requests', ['leave_type_id' => $annual->id, 'start_date' => '2026-10-07', 'end_date' => '2026-10-07'])->assertCreated();

        $this->ask('2026-10-07', 'late', '09:00')->assertStatus(422)->assertJsonValidationErrors(['start_date' => 'Already Unpaid leave on Wed 7 Oct']);
    }

    public function test_hr_sets_paid_or_unpaid_the_limit_or_turns_it_off(): void
    {
        $this->as($this->staff)->getJson('/api/request-settings/late_early')->assertOk()
            ->assertJsonPath('pay_percent', 100)->assertJsonPath('monthly_limit', 3)->assertJsonPath('is_active', true);
        $this->as($this->staff)->putJson('/api/request-settings/late_early', ['pay_percent' => 0])->assertForbidden();

        $this->as($this->admin)->putJson('/api/request-settings/late_early', ['pay_percent' => 0, 'monthly_limit' => null])
            ->assertOk()->assertJsonPath('pay_percent', 0)->assertJsonPath('monthly_limit', null);

        foreach (['2026-10-01', '2026-10-02', '2026-10-06', '2026-10-07'] as $date) {
            $this->approved($date, 'late', '09:00');
        }

        // Payroll: 4 × 60 min excused, unpaid.
        $row = collect($this->as($this->admin)->getJson('/api/attendance/summary?month=2026-10')->assertOk()->json('rows'))->firstWhere('employee.id', $this->dara->id);
        $this->assertSame(240, $row['excused_minutes']);
        $this->assertSame(240, $row['unpaid_excused_minutes']);

        $this->as($this->admin)->putJson('/api/request-settings/late_early', ['is_active' => false])->assertOk();
        $this->ask('2026-10-08', 'late', '09:00')->assertStatus(422)->assertJsonValidationErrors(['type' => 'turned off']);
    }

    public function test_the_preview_shows_the_minutes_and_how_many_are_left_this_month(): void
    {
        $this->approved('2026-10-01', 'late', '09:00');

        $this->as($this->staff)->postJson('/api/requests/preview', [
            'type' => 'late_early', 'start_date' => '2026-10-06', 'end_date' => '2026-10-06', 'kind' => 'early', 'time' => '16:30',
        ])->assertOk()
            ->assertJsonPath('expected', '17:00')
            ->assertJsonPath('minutes', 30)
            ->assertJsonPath('used_this_month', 1)
            ->assertJsonPath('monthly_limit', 3)
            ->assertJsonPath('problems', []);
    }
}
