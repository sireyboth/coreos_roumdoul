<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceSession;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Shift;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private User $admin;

    private User $user;

    private Employee $employee;

    private Shift $shift;

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
        $this->shift = Shift::query()->create([
            'company_id' => $this->company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00',
            'break_minutes' => 60, 'grace_minutes' => 10,
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

    private function schedule(string $date): Schedule
    {
        return Schedule::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id,
            'shift_id' => $this->shift->id, 'date' => $date,
        ]);
    }

    public function test_each_day_is_classified_as_work_holiday_day_off_or_weekly_off(): void
    {
        $this->company->update(['default_rest_days' => [0]]); // Sundays
        $this->schedule('2026-09-14');
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Pchum Ben', 'date' => '2026-09-22']);
        DayOff::query()->create(['company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'date' => '2026-09-23', 'reason' => 'Sick']);

        $calendar = $this->month();

        $this->assertCount(30, $calendar['days']);
        $this->assertSame('work', $this->day($calendar, '2026-09-14')['type']);
        $this->assertSame('holiday', $this->day($calendar, '2026-09-22')['type']);
        $this->assertSame('Pchum Ben', $this->day($calendar, '2026-09-22')['label']);
        $this->assertSame('day_off', $this->day($calendar, '2026-09-23')['type']);
        $this->assertSame('Sick', $this->day($calendar, '2026-09-23')['label']);
        $this->assertSame('weekly_off', $this->day($calendar, '2026-09-20')['type']); // a Sunday
        $this->assertSame('none', $this->day($calendar, '2026-09-16')['type']);
    }

    public function test_yearly_holidays_show_up_in_other_years_months(): void
    {
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'New Year', 'date' => '2020-09-25', 'is_recurring_yearly' => true]);

        $this->assertSame('holiday', $this->day($this->month(), '2026-09-25')['type']);
    }

    public function test_past_work_days_show_what_happened(): void
    {
        foreach (['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-15', '2026-09-16'] as $date) {
            $this->schedule($date);
        }
        $event = fn () => \App\Models\AttendanceEvent::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id,
            'event_type' => 'check_in', 'event_time' => now(),
        ]);
        $session = fn (string $date, array $attrs) => AttendanceSession::query()->create(array_merge([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'date' => $date,
            'check_in_event_id' => $event()->id, 'status' => 'completed', 'late_minutes' => 0,
        ], $attrs));

        $session('2026-09-10', []);
        $session('2026-09-11', ['late_minutes' => 25]);
        $session('2026-09-12', ['status' => 'missing_checkout']);
        // 09-13: scheduled, never showed up. 09-15 is today with no check-in yet. 09-16 is the future.

        $calendar = $this->month();

        $this->assertSame('present', $this->day($calendar, '2026-09-10')['attendance']);
        $this->assertSame('late', $this->day($calendar, '2026-09-11')['attendance']);
        $this->assertSame('missing_checkout', $this->day($calendar, '2026-09-12')['attendance']);
        $this->assertSame('absent', $this->day($calendar, '2026-09-13')['attendance']);
        $this->assertNull($this->day($calendar, '2026-09-15')['attendance']);
        $this->assertNull($this->day($calendar, '2026-09-16')['attendance']);
        $this->assertSame(1, $calendar['summary']['absent']);
        $this->assertSame(1, $calendar['summary']['late']);
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

    public function test_a_manager_can_set_weekly_days_off_and_mark_and_remove_a_day_off(): void
    {
        $this->actingAs($this->admin)->putJson('/api/calendar/weekly-off-days', ['days' => [6, 0]])
            ->assertOk()->assertJson(['weekly_off_days' => [0, 6]]);
        $this->assertSame([0, 6], $this->company->fresh()->default_rest_days);

        $this->app['auth']->forgetGuards();
        $id = $this->actingAs($this->admin)->postJson('/api/days-off', [
            'employee_id' => $this->employee->id, 'date' => '2026-09-18', 'reason' => 'Family',
        ])->assertCreated()->json('id');

        $this->assertSame('day_off', $this->day($this->month($this->admin, "&employee_id={$this->employee->id}"), '2026-09-18')['type']);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin)->deleteJson("/api/days-off/{$id}")->assertNoContent();
        $this->assertNotSame('day_off', $this->day($this->month($this->admin, "&employee_id={$this->employee->id}"), '2026-09-18')['type']);
    }

    public function test_a_regular_employee_cannot_manage_days_off_or_weekly_days(): void
    {
        $this->actingAs($this->user)->postJson('/api/days-off', ['employee_id' => $this->employee->id, 'date' => '2026-09-18'])->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->user)->putJson('/api/calendar/weekly-off-days', ['days' => [0]])->assertForbidden();
    }

    public function test_a_day_off_and_a_shift_cannot_share_a_day(): void
    {
        $this->schedule('2026-09-18');

        $this->actingAs($this->admin)->postJson('/api/days-off', ['employee_id' => $this->employee->id, 'date' => '2026-09-18'])
            ->assertStatus(422)->assertJsonValidationErrors('date');

        $this->app['auth']->forgetGuards();
        DayOff::query()->create(['company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'date' => '2026-09-19']);
        $this->actingAs($this->admin)->postJson('/api/schedules', [
            'employee_id' => $this->employee->id, 'shift_id' => $this->shift->id, 'date' => '2026-09-19',
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
}
