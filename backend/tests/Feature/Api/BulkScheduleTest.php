<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\Schedule;
use App\Models\WorkLocation;
use App\Models\WorkSchedule;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

class BulkScheduleTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private const WEEKDAYS = [1, 2, 3, 4, 5];

    private $company;

    private $admin;

    private WorkSchedule $shift;

    /** @var array<int, Employee> */
    private array $staff = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Roster Co', 'Boss', 'boss@roster.test', 'password123');
        $this->admin = $this->company->users()->first();
        $this->shift = $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '17:00']], ['name' => 'Day', 'late_grace_minutes' => 10, 'break_minutes' => 60]);
        foreach (['A', 'B', 'C'] as $name) {
            $this->staff[$name] = Employee::query()->create(['company_id' => $this->company->id, 'name' => $name]);
        }
    }

    private function bulk(array $overrides = [], $as = null)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($as ?? $this->admin)->postJson('/api/schedules/bulk', $overrides + [
            'employee_ids' => collect($this->staff)->pluck('id')->all(),
            'work_schedule_id' => $this->shift->id,
            // 2026-09-14 (Mon) to 2026-09-27 (Sun): two full weeks.
            'from' => '2026-09-14',
            'to' => '2026-09-27',
            'weekdays' => self::WEEKDAYS,
        ]);
    }

    public function test_several_employees_are_rostered_across_a_range_on_the_chosen_weekdays_only(): void
    {
        $this->bulk()->assertOk()->assertJsonPath('created', 30)->assertJsonPath('dry_run', false);

        // 3 people x 10 weekdays, and no weekends.
        $this->assertSame(30, Schedule::query()->count());
        // Weekday worked out in PHP, so this runs the same on every database.
        $this->assertSame(0, Schedule::query()->get()->filter(fn (Schedule $s) => $s->date->isWeekend())->count());
        $this->assertSame(10, Schedule::query()->where('employee_id', $this->staff['A']->id)->count());
        $this->assertSame($this->shift->id, Schedule::query()->first()->work_schedule_id);
    }

    public function test_a_single_day_still_works_like_before(): void
    {
        $this->bulk(['employee_ids' => [$this->staff['A']->id], 'from' => '2026-09-15', 'to' => '2026-09-15', 'weekdays' => null])
            ->assertOk()->assertJsonPath('created', 1);
    }

    public function test_holidays_days_off_existing_entries_and_people_who_left_are_skipped_and_counted(): void
    {
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Big Day', 'date' => '2026-09-16']);
        // A yearly holiday from a different year still lands on 17 September.
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Yearly', 'date' => '2020-09-17', 'is_recurring_yearly' => true]);
        DayOff::query()->create(['company_id' => $this->company->id, 'employee_id' => $this->staff['A']->id, 'date' => '2026-09-18']);
        $existing = Schedule::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->staff['B']->id, 'work_schedule_id' => $this->shift->id, 'date' => '2026-09-14',
        ]);
        $gone = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Gone', 'employment_status' => 'terminated']);

        $result = $this->bulk(['employee_ids' => [$this->staff['A']->id, $this->staff['B']->id, $gone->id], 'from' => '2026-09-14', 'to' => '2026-09-18'])
            ->assertOk();

        // 3 people x 5 weekdays = 15 slots. Gone = 5 skipped. The other two: 2 holidays each (4),
        // A's day off (1), B's existing Monday (1) => 15 - 5 - 4 - 1 - 1 = 4 created.
        $result->assertJsonPath('created', 4)
            ->assertJsonPath('skipped.employee_left', 5)
            ->assertJsonPath('skipped.holiday', 4)
            ->assertJsonPath('skipped.day_off', 1)
            ->assertJsonPath('skipped.already_scheduled', 1);

        // The existing entry is untouched, not duplicated or replaced.
        $this->assertSame(1, Schedule::query()->where('employee_id', $this->staff['B']->id)->whereDate('date', '2026-09-14')->count());
        $this->assertSame($existing->id, Schedule::query()->where('employee_id', $this->staff['B']->id)->whereDate('date', '2026-09-14')->value('id'));
    }

    public function test_holidays_can_be_scheduled_over_when_asked(): void
    {
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Big Day', 'date' => '2026-09-16']);

        $this->bulk(['employee_ids' => [$this->staff['A']->id], 'from' => '2026-09-16', 'to' => '2026-09-16', 'skip_holidays' => false])
            ->assertOk()->assertJsonPath('created', 1)->assertJsonPath('skipped.holiday', 0);
    }

    public function test_a_dry_run_reports_the_same_numbers_but_writes_nothing(): void
    {
        $this->bulk(['dry_run' => true])->assertOk()->assertJsonPath('dry_run', true)->assertJsonPath('created', 30);

        $this->assertSame(0, Schedule::query()->count());
    }

    public function test_running_it_twice_never_duplicates(): void
    {
        $this->bulk()->assertOk()->assertJsonPath('created', 30);
        $this->bulk()->assertOk()->assertJsonPath('created', 0)->assertJsonPath('skipped.already_scheduled', 30);

        $this->assertSame(30, Schedule::query()->count());
    }

    public function test_the_shift_location_range_and_people_are_checked(): void
    {
        $inactive = $this->makeWorkSchedule($this->company, [['in', '09:00'], ['out', '18:00']], ['name' => 'Old', 'is_active' => false]);
        $this->bulk(['work_schedule_id' => $inactive->id])->assertStatus(422)->assertJsonValidationErrors('work_schedule_id');

        $this->bulk(['from' => '2026-01-01', 'to' => '2026-12-31'])->assertStatus(422)->assertJsonValidationErrors('to');
        $this->bulk(['weekdays' => [0], 'from' => '2026-09-15', 'to' => '2026-09-19'])->assertStatus(422)->assertJsonValidationErrors('weekdays');
        $this->bulk(['employee_ids' => []])->assertStatus(422)->assertJsonValidationErrors('employee_ids');
        $this->bulk(['to' => '2026-09-01'])->assertStatus(422)->assertJsonValidationErrors('to');

        $this->assertSame(0, Schedule::query()->count());
    }

    public function test_another_companys_employees_shifts_and_locations_are_refused(): void
    {
        $rival = app(CompanyProvisioner::class)->provision('Rival', 'Rival', 'boss@rival.test', 'password123');
        $spy = Employee::query()->create(['company_id' => $rival->id, 'name' => 'Spy']);
        $rivalShift = $this->makeWorkSchedule($rival, [['in', '08:00'], ['out', '17:00']], ['name' => 'Theirs']);
        $rivalBranch = Branch::query()->create(['company_id' => $rival->id, 'name' => 'HQ', 'latitude' => 1, 'longitude' => 1]);
        $rivalLocation = WorkLocation::query()->create(['company_id' => $rival->id, 'branch_id' => $rivalBranch->id, 'name' => 'HQ']);

        $this->bulk(['employee_ids' => [$this->staff['A']->id, $spy->id]])->assertStatus(422)->assertJsonValidationErrors('employee_ids');
        $this->bulk(['work_schedule_id' => $rivalShift->id])->assertStatus(422)->assertJsonValidationErrors('work_schedule_id');
        $this->bulk(['work_location_id' => $rivalLocation->id])->assertStatus(422)->assertJsonValidationErrors('work_location_id');
        $this->assertSame(0, Schedule::query()->count());
    }

    public function test_an_optional_location_is_applied_to_every_entry(): void
    {
        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 1, 'longitude' => 1]);
        $location = WorkLocation::query()->create(['company_id' => $this->company->id, 'branch_id' => $branch->id, 'name' => 'HQ']);

        $this->bulk(['work_location_id' => $location->id])->assertOk();

        $this->assertSame(30, Schedule::query()->where('work_location_id', $location->id)->count());
    }

    public function test_only_people_who_manage_the_roster_can_use_it(): void
    {
        $employee = $this->createUserWithRole($this->company, 'employee');

        $this->bulk([], $employee)->assertForbidden();
        $this->assertSame(0, Schedule::query()->count());
    }

    public function test_the_roster_list_can_load_a_whole_month_at_once(): void
    {
        $this->bulk(['from' => '2026-09-01', 'to' => '2026-09-30'])->assertOk();

        $this->app['auth']->forgetGuards();
        $default = $this->actingAs($this->admin)->getJson('/api/schedules?from=2026-09-01&to=2026-09-30')->json('data');
        $this->assertCount(50, $default);

        $all = $this->actingAs($this->admin)->getJson('/api/schedules?from=2026-09-01&to=2026-09-30&per_page=500')->json();
        $this->assertCount(66, $all['data']);
        $this->assertSame(66, $all['total']);
    }
}
