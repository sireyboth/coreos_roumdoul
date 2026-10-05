<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\Branch;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\MembershipBranchAccess;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkSchedule;
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

class CalendarTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private $company;

    private User $admin;

    private User $user;

    private Employee $employee;

    private WorkSchedule $schedule;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Cal Co', 'Boss', 'boss@cal.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $this->admin = $this->company->users()->first();
        $this->user = $this->createUserWithRole($this->company, 'employee');
        $this->employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Worker', 'user_id' => $this->user->id]);
        $this->schedule = $this->makeWorkSchedule($this->company, attributes: [
            'name' => 'Day', 'break_minutes' => 60, 'late_grace_minutes' => 10,
        ]);

        // Mid-month, 10:00 in Phnom Penh.
        $this->travelTo(Carbon::parse('2026-09-15 03:00:00', 'UTC'));
    }

    private function month(?User $as = null, string $query = ''): array
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($as ?? $this->user)
            ->getJson('/api/calendar?month=2026-09'.$query)->assertOk()->json();
    }

    private function day(array $calendar, string $date): array
    {
        return collect($calendar['days'])->firstWhere('date', $date);
    }

    /** A scan at a Phnom Penh wall-clock time. */
    private function scanAt(string $local): void
    {
        AttendanceEvent::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id,
            'method' => 'qr', 'event_time' => Carbon::parse($local, 'Asia/Phnom_Penh')->utc(),
        ]);
    }

    public function test_each_day_is_classified_as_work_holiday_day_off_or_weekly_off(): void
    {
        // Assigned from the 2nd, with Sundays off.
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-02', daysOff: [0]);
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Pchum Ben', 'date' => '2026-09-22']);
        DayOff::query()->create(['company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'date' => '2026-09-23', 'reason' => 'Sick']);

        $calendar = $this->month();

        $this->assertCount(30, $calendar['days']);
        $work = $this->day($calendar, '2026-09-14');
        $this->assertSame('work', $work['type']);
        $this->assertSame('Day', $work['schedule']['name']);
        $this->assertSame('assignment', $work['schedule']['source']);
        $this->assertSame(['in', 'out'], array_column($work['schedule']['slots'], 'type'));
        $this->assertSame('holiday', $this->day($calendar, '2026-09-22')['type']);
        $this->assertSame('Pchum Ben', $this->day($calendar, '2026-09-22')['label']);
        $this->assertSame('day_off', $this->day($calendar, '2026-09-23')['type']);
        $this->assertSame('Sick', $this->day($calendar, '2026-09-23')['label']);
        $this->assertSame('weekly_off', $this->day($calendar, '2026-09-20')['type']); // a Sunday
        $this->assertSame('none', $this->day($calendar, '2026-09-01')['type']);      // before the assignment
    }

    public function test_a_roster_override_replaces_the_assignment_for_that_day(): void
    {
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-01');
        $split = $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '12:00'], ['in', '13:00'], ['out', '17:00']], ['name' => 'Split']);
        $override = $this->overrideOn($this->employee, $split, '2026-09-18');

        $day = $this->day($this->month(), '2026-09-18');

        $this->assertSame('Split', $day['schedule']['name']);
        $this->assertSame('override', $day['schedule']['source']);
        $this->assertCount(4, $day['schedule']['slots']);
        $this->assertSame($override->id, $day['schedule_id']);
    }

    public function test_yearly_holidays_show_up_in_other_years_months(): void
    {
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'New Year', 'date' => '2020-09-25', 'is_recurring_yearly' => true]);

        $this->assertSame('holiday', $this->day($this->month(), '2026-09-25')['type']);
    }

    public function test_past_work_days_show_what_happened(): void
    {
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-10');

        $this->scanAt('2026-09-10 08:00');
        $this->scanAt('2026-09-10 17:00');
        $this->scanAt('2026-09-11 08:35'); // 25 min late (past the 10 min grace)
        $this->scanAt('2026-09-11 17:00');
        $this->scanAt('2026-09-12 08:00'); // never scanned out
        // 13th and 14th: scheduled, never showed up. 15th is today (no scan yet), 16th the future.
        app(AttendanceRecorder::class)->recalculateRange($this->employee, '2026-09-10', '2026-09-15');

        $calendar = $this->month();

        $this->assertSame('present', $this->day($calendar, '2026-09-10')['attendance']);
        $this->assertSame(['08:00', '17:00'], $this->day($calendar, '2026-09-10')['scans']);
        $this->assertSame('late', $this->day($calendar, '2026-09-11')['attendance']);
        $this->assertSame(25, $this->day($calendar, '2026-09-11')['late_minutes']);
        $this->assertSame('incomplete', $this->day($calendar, '2026-09-12')['attendance']);
        $this->assertContains('missing_out', $this->day($calendar, '2026-09-12')['exceptions']);
        $this->assertSame('absent', $this->day($calendar, '2026-09-13')['attendance']);
        $this->assertNull($this->day($calendar, '2026-09-15')['attendance']);
        $this->assertNull($this->day($calendar, '2026-09-16')['attendance']);
        $this->assertSame(2, $calendar['summary']['absent']);
        $this->assertSame(1, $calendar['summary']['late']);
        $this->assertSame(1, $calendar['summary']['incomplete']);
        $this->assertSame(3, $calendar['summary']['present']);
    }

    public function test_an_employee_only_sees_their_own_calendar_but_a_manager_can_pick_anyone(): void
    {
        $other = $this->createUserWithRole($this->company, 'employee');
        $otherEmployee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Other', 'user_id' => $other->id]);

        // Asking for someone else's month as a regular employee is ignored.
        $this->assertSame($this->employee->id, $this->month($this->user, "&employee_id={$otherEmployee->id}")['employee']['id']);
        $this->assertSame($otherEmployee->id, $this->month($this->admin, "&employee_id={$otherEmployee->id}")['employee']['id']);
    }

    public function test_people_on_the_same_schedule_can_have_different_weekly_days_off(): void
    {
        $other = $this->createUserWithRole($this->company, 'employee');
        $otherEmployee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Other', 'user_id' => $other->id]);
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-01', daysOff: [0]); // Sundays
        $this->assignSchedule($otherEmployee, $this->schedule, '2026-09-01', daysOff: [3]);  // Wednesdays

        $mine = $this->month($this->admin, "&employee_id={$this->employee->id}");
        $theirs = $this->month($this->admin, "&employee_id={$otherEmployee->id}");

        // Sunday the 20th, Wednesday the 23rd.
        $this->assertSame(['weekly_off', 'work'], [$this->day($mine, '2026-09-20')['type'], $this->day($mine, '2026-09-23')['type']]);
        $this->assertSame(['work', 'weekly_off'], [$this->day($theirs, '2026-09-20')['type'], $this->day($theirs, '2026-09-23')['type']]);
    }

    public function test_a_manager_can_mark_and_remove_a_day_off(): void
    {
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-01');

        $this->app['auth']->forgetGuards();
        $id = $this->actingAs($this->admin)->postJson('/api/days-off', [
            'employee_id' => $this->employee->id, 'date' => '2026-09-18', 'reason' => 'Family',
        ])->assertCreated()->json('id');

        $this->assertSame('day_off', $this->day($this->month($this->admin, "&employee_id={$this->employee->id}"), '2026-09-18')['type']);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->deleteJson("/api/days-off/{$id}")->assertNoContent();
        $this->assertSame('work', $this->day($this->month($this->admin, "&employee_id={$this->employee->id}"), '2026-09-18')['type']);
    }

    public function test_a_regular_employee_cannot_manage_days_off(): void
    {
        $this->actingAs($this->user)->postJson('/api/days-off', ['employee_id' => $this->employee->id, 'date' => '2026-09-18'])->assertForbidden();
    }

    public function test_a_day_off_and_a_roster_override_cannot_share_a_day(): void
    {
        $this->overrideOn($this->employee, $this->schedule, '2026-09-18');

        $this->actingAs($this->admin)->postJson('/api/days-off', ['employee_id' => $this->employee->id, 'date' => '2026-09-18'])
            ->assertStatus(422)->assertJsonValidationErrors('date');

        $this->app['auth']->forgetGuards();
        DayOff::query()->create(['company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'date' => '2026-09-19']);
        $this->actingAs($this->admin)->postJson('/api/schedules', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $this->schedule->id, 'date' => '2026-09-19',
        ])->assertStatus(422)->assertJsonValidationErrors('date');
    }

    public function test_another_companys_employee_cannot_be_viewed_or_marked_off(): void
    {
        $other = app(CompanyProvisioner::class)->provision('Other Co', 'Boss', 'boss@other.test', 'password123');
        $stranger = Employee::query()->create(['company_id' => $other->id, 'name' => 'Stranger']);

        $this->actingAs($this->admin)->getJson("/api/calendar?month=2026-09&employee_id={$stranger->id}")->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->postJson('/api/days-off', ['employee_id' => $stranger->id, 'date' => '2026-09-18'])->assertNotFound();
    }

    private function team(?User $as = null, string $query = '')
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($as ?? $this->admin)->getJson('/api/calendar/team?month=2026-09'.$query);
    }

    public function test_the_team_roster_shows_every_employee_with_the_same_day_types_as_their_own_calendar(): void
    {
        $other = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Aardvark']);
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-01', daysOff: [0]);
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Big Day', 'date' => '2026-09-24']);

        $team = $this->team()->assertOk()->json();

        $this->assertSame(['Aardvark', 'Worker'], collect($team['employees'])->pluck('name')->all());
        $this->assertFalse($team['truncated']);

        $worker = collect($team['employees'])->firstWhere('id', $this->employee->id);
        $this->assertCount(30, $worker['days']);
        $this->assertSame('work', collect($worker['days'])->firstWhere('date', '2026-09-10')['type']);
        $this->assertSame('holiday', collect($worker['days'])->firstWhere('date', '2026-09-24')['type']);

        // The roster and the personal calendar are built by the same code.
        // (The roster leaves out empty fields to keep the payload small; the app reads a missing one as "none".)
        $personal = array_map(
            fn ($day) => array_filter($day, fn ($value) => $value !== null && $value !== []),
            $this->month($this->admin, "&employee_id={$this->employee->id}")['days'],
        );
        $this->assertEquals($personal, $worker['days']);
        $this->assertSame('none', collect(collect($team['employees'])->firstWhere('id', $other->id)['days'])->firstWhere('date', '2026-09-10')['type']);
    }

    public function test_a_regular_employee_cannot_open_the_team_roster(): void
    {
        $this->team($this->user)->assertForbidden();
    }

    public function test_the_team_roster_can_be_filtered_by_branch_and_respects_branch_access(): void
    {
        $branchA = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'A']);
        $branchB = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'B']);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->postJson('/api/employees', ['name' => 'Alice', 'branch_id' => $branchA->id])->assertCreated();
        $this->actingAs($this->admin)->postJson('/api/employees', ['name' => 'Bob', 'branch_id' => $branchB->id])->assertCreated();

        $names = fn ($response) => collect($response->assertOk()->json('employees'))->pluck('name')->all();

        $this->assertSame(['Bob'], $names($this->team(null, "&branch_id={$branchB->id}")));

        // A manager limited to branch A never sees Bob, even without a filter.
        $manager = $this->createUserWithRole($this->company, 'manager');
        MembershipBranchAccess::query()->create([
            'company_membership_id' => $manager->membership->id, 'branch_id' => $branchA->id, 'created_at' => now(),
        ]);

        $this->assertSame(['Alice'], $names($this->team($manager)));
    }

    public function test_the_team_roster_leaves_out_people_who_left_before_the_month(): void
    {
        Employee::query()->create([
            'company_id' => $this->company->id, 'name' => 'Gone', 'employment_status' => 'terminated', 'termination_date' => '2026-08-01',
        ]);
        Employee::query()->create([
            'company_id' => $this->company->id, 'name' => 'Leaving', 'employment_status' => 'terminated', 'termination_date' => '2026-09-20',
        ]);

        $names = collect($this->team()->assertOk()->json('employees'))->pluck('name')->all();

        $this->assertContains('Leaving', $names);
        $this->assertNotContains('Gone', $names);
    }

    public function test_the_team_roster_does_not_leak_another_companys_employees(): void
    {
        $rival = app(CompanyProvisioner::class)->provision('Rival', 'Boss', 'boss@rival.test', 'password123');
        Employee::query()->create(['company_id' => $rival->id, 'name' => 'Spy']);

        $names = collect($this->team()->assertOk()->json('employees'))->pluck('name')->all();

        $this->assertNotContains('Spy', $names);
    }

    public function test_managers_can_import_holidays_but_existing_dates_are_kept_and_others_cannot(): void
    {
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Renamed by admin', 'date' => '2026-05-01']);

        $payload = ['holidays' => [
            ['name' => 'Labour Day', 'date' => '2026-05-01'],
            ['name' => 'Visak Bochea', 'date' => '2026-05-02'],
        ]];

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->postJson('/api/holidays/import', $payload)
            ->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('skipped.0', '2026-05-01');

        $this->assertSame('Renamed by admin', Holiday::query()->whereDate('date', '2026-05-01')->value('name'));
        $this->assertSame(2, Holiday::query()->count());

        // Importing the same list again adds nothing.
        $this->actingAs($this->admin)->postJson('/api/holidays/import', $payload)->assertOk()->assertJsonPath('created', 0);
        $this->assertSame(2, Holiday::query()->count());

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->user)->postJson('/api/holidays/import', $payload)->assertForbidden();
    }

    public function test_a_holiday_added_afterwards_turns_a_past_absence_into_a_holiday(): void
    {
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-01');
        app(AttendanceRecorder::class)->recalculateRange($this->employee, '2026-09-10', '2026-09-10');
        $this->assertSame('absent', $this->day($this->month(), '2026-09-10')['attendance']);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->postJson('/api/holidays', ['name' => 'Surprise', 'date' => '2026-09-10'])->assertCreated();

        $day = $this->day($this->month(), '2026-09-10');
        $this->assertSame('holiday', $day['type']);
        $this->assertNull($day['attendance']);
    }

    public function test_deleting_a_holiday_turns_the_day_back_into_an_absence(): void
    {
        $this->assignSchedule($this->employee, $this->schedule, '2026-09-01');
        $this->app['auth']->forgetGuards();
        $id = $this->actingAs($this->admin)->postJson('/api/holidays', ['name' => 'Mistake', 'date' => '2026-09-10'])->assertCreated()->json('id');
        $this->assertSame('holiday', $this->day($this->month(), '2026-09-10')['type']);

        $this->actingAs($this->admin)->deleteJson("/api/holidays/{$id}")->assertNoContent();

        $this->assertSame('absent', $this->day($this->month(), '2026-09-10')['attendance']);
    }
}
