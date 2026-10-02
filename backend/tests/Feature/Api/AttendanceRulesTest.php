<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\Employee;
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
 * The attendance rules around a scan: company-timezone schedule times,
 * GPS-only scans matched to a real branch, forgotten scans, night shifts,
 * who may scan at all, and paid vs unpaid breaks.
 */
class AttendanceRulesTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private $company;

    private User $admin;

    private User $user;

    private Employee $employee;

    private WorkLocation $hq;

    /** Standing inside HQ. */
    private array $atHq = ['latitude' => 11.5564, 'longitude' => 104.9282];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        // Cambodia: the company timezone defaults to Asia/Phnom_Penh (UTC+7).
        $this->company = app(CompanyProvisioner::class)->provision('Rules Co', 'Boss', 'boss@rules.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $this->admin = $this->company->users()->first();
        $this->user = $this->createUserWithRole($this->company, 'employee');
        $this->employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Worker', 'user_id' => $this->user->id]);
        $this->hq = WorkLocation::query()->create([
            'company_id' => $this->company->id,
            'name' => 'HQ',
            'latitude' => 11.5564,
            'longitude' => 104.9282,
            'radius_meters' => 100,
        ]);
    }

    private function at(string $utc): void
    {
        $this->travelTo(Carbon::parse($utc, 'UTC'));
    }

    /** 08:00–17:00 with a 10 min grace and a 60 min unpaid break, assigned to the worker. */
    private function dayShift(array $attributes = [], ?Employee $employee = null): void
    {
        $schedule = $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '17:00']], array_merge([
            'late_grace_minutes' => 10, 'break_minutes' => 60, 'is_break_paid' => false,
        ], $attributes));

        $this->assignSchedule($employee ?? $this->employee, $schedule);
    }

    private function scan(?User $user = null, ?array $where = null)
    {
        return $this->actingAs($user ?? $this->user)->postJson('/api/attendance/scan', $where ?? $this->atHq);
    }

    private function dayOf(?Employee $employee = null): AttendanceDay
    {
        return $this->attendanceDay($employee ?? $this->employee) ?? $this->fail('No attendance day was recorded.');
    }

    // ---- 0. Schedule required ------------------------------------------------

    public function test_scanning_needs_a_work_schedule_when_required(): void
    {
        config(['attendance.require_schedule' => true]);
        $this->at('2026-09-21 01:00:00'); // 08:00 in Phnom Penh

        $this->scan()->assertStatus(422)->assertJsonValidationErrors('schedule');

        $this->dayShift();
        $this->app['auth']->forgetGuards();

        // Arriving hours early is fine — there's no early-arrival cutoff.
        $this->at('2026-09-20 22:00:00'); // 05:00 local, same local day
        $this->scan()->assertCreated();
    }

    // ---- 1. Company timezone -------------------------------------------------

    public function test_schedule_times_are_read_in_the_companys_timezone_not_utc(): void
    {
        $this->dayShift();

        // 01:30 UTC is 08:30 in Cambodia: 30 min after an 08:00 start, 20 past the 10 min grace.
        $this->at('2026-09-21 01:30:00');
        $this->scan()->assertCreated()
            ->assertJsonPath('slot.type', 'in')
            ->assertJsonPath('slot.late_minutes', 20)
            ->assertJsonPath('message', 'IN recorded at 08:30 (expected 08:00) — 20 min late.');

        $this->assertSame(20, $this->dayOf()->late_minutes);
    }

    public function test_arriving_within_the_grace_period_is_not_late(): void
    {
        $this->dayShift();

        $this->at('2026-09-21 01:05:00'); // 08:05 in Cambodia
        $this->scan()->assertCreated();

        $this->assertSame(0, $this->dayOf()->late_minutes);
    }

    public function test_the_day_rolls_over_at_local_midnight_not_7am(): void
    {
        // 18:00 UTC on the 20th is 01:00 on the 21st in Cambodia.
        $this->at('2026-09-20 18:00:00');
        $this->scan()->assertCreated();

        $this->assertSame('2026-09-21', $this->dayOf()->date->toDateString());
    }

    public function test_a_corrections_typed_times_are_read_as_company_time(): void
    {
        $this->dayShift();
        $this->at('2026-09-16 05:00:00');

        $id = $this->actingAs($this->user)->postJson('/api/attendance/corrections', [
            'date' => '2026-09-15',
            'reason' => 'Forgot',
            'requested_check_in' => '2026-09-15T08:30',
            'requested_check_out' => '2026-09-15T17:30',
        ])->assertCreated()->json('id');

        // Typed as 08:30 in Cambodia = 01:30 UTC.
        $this->assertSame('01:30', AttendanceCorrection::query()->findOrFail($id)->requestedTimes()[0]->utc()->format('H:i'));

        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$id}/approve")->assertOk();

        // The 15th specifically — approving also brought today (the 16th) up to date.
        $day = $this->attendanceDay($this->employee, '2026-09-15');
        $this->assertSame(20, $day->late_minutes);       // 08:30 vs 08:10
        $this->assertSame(480, $day->worked_minutes);    // 9h minus the 60 min unpaid break
        $this->assertSame('complete', $day->status);
    }

    // ---- 2. GPS-only scans ---------------------------------------------------

    public function test_a_gps_only_scan_inside_a_branch_is_matched_to_it(): void
    {
        $this->scan()->assertCreated()
            ->assertJsonPath('event.work_location_id', $this->hq->id)
            ->assertJsonPath('event.method', 'gps');
    }

    public function test_a_gps_only_scan_far_from_every_branch_is_rejected(): void
    {
        $this->scan(where: ['latitude' => 11.6564, 'longitude' => 104.9282])
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');

        $this->assertSame(0, AttendanceEvent::query()->count());
        $this->assertSame(0, AttendanceDay::query()->count());
    }

    public function test_a_gps_only_scan_needs_at_least_one_branch_location(): void
    {
        $this->hq->delete();

        $this->scan()->assertStatus(422)->assertJsonValidationErrors('latitude');
    }

    public function test_a_scan_with_no_proof_at_all_is_rejected(): void
    {
        $this->scan(where: [])->assertStatus(422)->assertJsonValidationErrors('verification');
    }

    public function test_a_double_tap_is_refused_politely(): void
    {
        $this->at('2026-09-21 01:00:00');
        $this->scan()->assertCreated();

        $this->at('2026-09-21 01:01:00');
        $this->scan()->assertStatus(422)
            ->assertJsonPath('errors.scan.0', 'You already scanned at 08:00. Wait a moment before scanning again.');
    }

    // ---- 3. Forgotten scans --------------------------------------------------

    public function test_a_forgotten_out_is_reported_missing_and_the_next_day_starts_fresh(): void
    {
        $this->dayShift();

        $this->at('2026-09-21 01:00:00'); // 08:00 in Cambodia
        $this->scan()->assertCreated();

        // The next morning: yesterday is closed with its OUT missing, today's first scan is today's IN.
        $this->at('2026-09-22 01:02:00');
        $this->scan()->assertCreated()->assertJsonPath('slot.type', 'in');

        $yesterday = $this->attendanceDay($this->employee, '2026-09-21');
        $this->assertSame('incomplete', $yesterday->status);
        $this->assertContains('missing_out', $yesterday->exceptions);
        $this->assertSame('in_progress', $this->attendanceDay($this->employee, '2026-09-22')->status);
    }

    public function test_the_hourly_command_records_absences_and_missing_scans_for_everyone(): void
    {
        $this->dayShift();

        $this->at('2026-09-21 01:00:00');
        $this->scan()->assertCreated();

        // Nobody scans again; the day closes overnight.
        $this->at('2026-09-22 03:00:00');
        $this->artisan('attendance:close-days')->assertSuccessful();

        $this->assertSame('incomplete', $this->attendanceDay($this->employee, '2026-09-21')->status);
        // Today has started (08:00 local passed at 01:00 UTC) — upcoming until they scan, absent once it closes.
        $this->assertSame('upcoming', $this->attendanceDay($this->employee, '2026-09-22')->status);

        $this->at('2026-09-23 03:00:00');
        $this->artisan('attendance:close-days')->assertSuccessful();
        $this->assertSame('absent', $this->attendanceDay($this->employee, '2026-09-22')->status);
    }

    public function test_a_night_shift_finishes_the_next_morning_on_the_same_work_day(): void
    {
        $night = $this->makeWorkSchedule($this->company, [['in', '22:00'], ['out', '06:00', true]]);
        $this->assignSchedule($this->employee, $night);

        $this->at('2026-09-21 14:58:00'); // 21:58 in Cambodia
        $this->scan()->assertCreated()->assertJsonPath('slot.type', 'in');

        $this->at('2026-09-21 23:05:00'); // 06:05 on the 22nd
        $this->scan()->assertCreated()->assertJsonPath('slot.type', 'out');

        $day = $this->attendanceDay($this->employee, '2026-09-21');
        $this->assertSame('complete', $day->status);
        $this->assertSame(487, $day->worked_minutes);
        $this->assertNull($this->attendanceDay($this->employee, '2026-09-22'));
    }

    // ---- 4. Who may scan -----------------------------------------------------

    public function test_terminated_and_suspended_employees_cannot_scan(): void
    {
        foreach (['terminated', 'suspended'] as $status) {
            $this->employee->update(['employment_status' => $status]);
            $this->user->unsetRelation('employee'); // a real request loads it fresh

            $this->scan()->assertStatus(422)->assertJsonValidationErrors('employee');
        }

        $this->employee->update(['employment_status' => 'on_leave']);
        $this->user->unsetRelation('employee');
        $this->scan()->assertCreated();
    }

    public function test_an_inactive_branch_does_not_accept_scans_by_qr_or_gps(): void
    {
        $this->hq->update(['is_active' => false]);

        $this->scan(where: ['qr_token' => $this->hq->qr_token])->assertStatus(422);

        // GPS-only ignores inactive branches entirely, so there's nothing near enough.
        $this->scan()->assertStatus(422);
    }

    public function test_the_old_check_in_and_check_out_addresses_still_scan(): void
    {
        $this->dayShift();

        $this->at('2026-09-21 01:00:00');
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
        $this->at('2026-09-21 10:00:00');
        $this->actingAs($this->user)->postJson('/api/attendance/check-out', $this->atHq)->assertCreated();

        $this->assertSame('complete', $this->dayOf()->status);
    }

    // ---- 5. Paid vs unpaid breaks --------------------------------------------

    public function test_an_unpaid_break_is_subtracted_from_worked_time_and_a_paid_one_is_not(): void
    {
        $paidUser = $this->createUserWithRole($this->company, 'employee');
        $paidEmployee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Paid', 'user_id' => $paidUser->id]);

        $this->dayShift(['name' => 'Unpaid break', 'is_break_paid' => false]);
        $this->dayShift(['name' => 'Paid break', 'is_break_paid' => true], $paidEmployee);

        $this->at('2026-09-21 01:00:00');
        $this->scan()->assertCreated();
        $this->scan($paidUser)->assertCreated();

        $this->at('2026-09-21 10:00:00'); // 9 hours later
        $this->scan()->assertCreated();
        $this->scan($paidUser)->assertCreated();

        $this->assertSame(480, $this->dayOf()->worked_minutes);              // 9h - 60 unpaid
        $this->assertSame(540, $this->dayOf($paidEmployee)->worked_minutes); // 9h, break is paid
    }
}
