<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkLocation;
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
 * A schedule with automatic attendance (e.g. top management): nobody scans,
 * and each IN/OUT is filled in at its scheduled time once it has passed.
 */
class AttendanceAutoTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private $company;

    private User $user;

    private Employee $director;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        // Asia/Phnom_Penh (UTC+7).
        $this->company = app(CompanyProvisioner::class)->provision('Auto Co', 'Boss', 'boss@auto.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $this->user = $this->createUserWithRole($this->company, 'employee');
        $this->director = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Director', 'user_id' => $this->user->id]);
        WorkLocation::query()->create([
            'company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 11.5564, 'longitude' => 104.9282, 'radius_meters' => 100,
        ]);

        $this->assignSchedule($this->director, $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '17:00']], [
            'name' => 'Top management', 'auto_attendance' => true, 'break_minutes' => 60, 'is_break_paid' => false,
        ]));
    }

    private function closeDaysAt(string $local): void
    {
        $this->travelTo(Carbon::parse($local, 'Asia/Phnom_Penh'));
        $this->artisan('attendance:close-days')->assertSuccessful();
    }

    public function test_a_finished_day_is_complete_without_any_scan(): void
    {
        $this->closeDaysAt('2026-09-21 18:00');

        $day = $this->attendanceDay($this->director, '2026-09-21');
        $this->assertSame('complete', $day->status);
        $this->assertSame(480, $day->worked_minutes);
        $this->assertSame(0, $day->late_minutes);
        $this->assertSame([], $day->exceptions);
        $this->assertSame(['auto', 'auto'], array_column($day->slots, 'method'));
        $this->assertSame(0, AttendanceEvent::query()->count());
    }

    public function test_only_slots_already_passed_are_filled_in(): void
    {
        $this->closeDaysAt('2026-09-21 10:00');

        $day = $this->attendanceDay($this->director, '2026-09-21');
        $this->assertSame('in_progress', $day->status);
        $this->assertSame(['ok', 'pending'], array_column($day->slots, 'status'));
    }

    public function test_scanning_is_refused_politely(): void
    {
        $this->travelTo(Carbon::parse('2026-09-21 08:30', 'Asia/Phnom_Penh'));

        $this->actingAs($this->user)->postJson('/api/attendance/scan', ['latitude' => 11.5564, 'longitude' => 104.9282])
            ->assertJsonValidationErrors('schedule');
        $this->assertSame(0, AttendanceEvent::query()->count());
    }

    public function test_weekly_days_off_stay_off(): void
    {
        EmployeeScheduleAssignment::query()->withoutGlobalScopes()->where('employee_id', $this->director->id)->update(['days_off' => [0]]);

        $this->closeDaysAt('2026-09-27 18:00'); // a Sunday

        $this->assertNull($this->attendanceDay($this->director, '2026-09-27'));
    }
}
