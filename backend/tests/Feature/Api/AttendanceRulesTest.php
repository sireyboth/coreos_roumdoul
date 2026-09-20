<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceSession;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Shift;
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
use Tests\TestCase;

/**
 * The attendance rules that used to be gaps: company-timezone shift times,
 * GPS-only check-ins matched to a real branch, forgotten check-outs, who may
 * check in at all, and paid vs unpaid breaks.
 */
class AttendanceRulesTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

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

    private function shift(array $overrides = []): Shift
    {
        return Shift::query()->create(array_merge([
            'company_id' => $this->company->id,
            'name' => 'Day',
            'start_time' => '08:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
            'is_break_paid' => false,
            'grace_minutes' => 10,
        ], $overrides));
    }

    private function schedule(Shift $shift, string $localDate, ?Employee $employee = null): void
    {
        Schedule::query()->create([
            'company_id' => $this->company->id,
            'employee_id' => ($employee ?? $this->employee)->id,
            'shift_id' => $shift->id,
            'date' => $localDate,
        ]);
    }

    private function sessionOf(?Employee $employee = null): AttendanceSession
    {
        return AttendanceSession::query()->where('employee_id', ($employee ?? $this->employee)->id)->latest('id')->firstOrFail();
    }

    // ---- 0. Shift required ---------------------------------------------------

    public function test_check_in_needs_a_shift_on_the_roster_when_required(): void
    {
        config(['attendance.require_schedule' => true]);
        $this->at('2026-09-21 01:00:00'); // 08:00 in Phnom Penh

        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)
            ->assertStatus(422)
            ->assertJsonValidationErrors('schedule');

        $this->schedule($this->shift(), '2026-09-21');
        $this->app['auth']->forgetGuards();

        // Arriving hours early is fine — there's no early-arrival cutoff.
        $this->at('2026-09-20 22:00:00'); // 05:00 local, same local day
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
    }

    // ---- 1. Company timezone -------------------------------------------------

    public function test_shift_times_are_read_in_the_companys_timezone_not_utc(): void
    {
        $this->schedule($this->shift(), '2026-09-21');

        // 01:30 UTC is 08:30 in Cambodia: 30 min after an 08:00 start, 20 past the 10 min grace.
        $this->at('2026-09-21 01:30:00');
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();

        $this->assertSame(20, $this->sessionOf()->late_minutes);
    }

    public function test_arriving_within_the_grace_period_is_not_late(): void
    {
        $this->schedule($this->shift(), '2026-09-21');

        $this->at('2026-09-21 01:05:00'); // 08:05 in Cambodia
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();

        $this->assertSame(0, $this->sessionOf()->late_minutes);
    }

    public function test_the_day_rolls_over_at_local_midnight_not_7am(): void
    {
        // 18:00 UTC on the 20th is 01:00 on the 21st in Cambodia.
        $this->at('2026-09-20 18:00:00');
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();

        $this->assertSame('2026-09-21', $this->sessionOf()->date->toDateString());
    }

    public function test_a_corrections_typed_times_are_read_as_company_time(): void
    {
        $this->schedule($this->shift(), '2026-09-15');

        $id = $this->actingAs($this->user)->postJson('/api/attendance/corrections', [
            'date' => '2026-09-15',
            'reason' => 'Forgot',
            'requested_check_in' => '2026-09-15T08:30',
            'requested_check_out' => '2026-09-15T17:30',
        ])->assertCreated()->json('id');

        // Typed as 08:30 in Cambodia = 01:30 UTC.
        $this->assertSame('01:30', AttendanceCorrection::query()->findOrFail($id)->requested_check_in->utc()->format('H:i'));

        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$id}/approve")->assertOk();

        $session = $this->sessionOf();
        $this->assertSame(20, $session->late_minutes);           // 08:30 vs 08:10
        $this->assertSame(480, $session->worked_minutes);        // 9h minus the 60 min unpaid break
        $this->assertSame('completed', $session->status);
    }

    // ---- 2. GPS-only check-in ------------------------------------------------

    public function test_a_gps_only_check_in_inside_a_branch_is_matched_to_it(): void
    {
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)
            ->assertCreated()
            ->assertJsonPath('work_location_id', $this->hq->id)
            ->assertJsonPath('method', 'gps');
    }

    public function test_a_gps_only_check_in_far_from_every_branch_is_rejected(): void
    {
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', ['latitude' => 11.6564, 'longitude' => 104.9282])
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');

        $this->assertSame(0, AttendanceSession::query()->count());
    }

    public function test_a_gps_only_check_in_needs_at_least_one_branch_location(): void
    {
        $this->hq->delete();

        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)
            ->assertStatus(422)
            ->assertJsonValidationErrors('latitude');
    }

    public function test_a_check_in_with_no_proof_at_all_is_rejected(): void
    {
        $this->actingAs($this->user)->postJson('/api/attendance/check-in')
            ->assertStatus(422)
            ->assertJsonValidationErrors('verification');
    }

    // ---- 3. Forgotten check-outs ---------------------------------------------

    public function test_a_forgotten_check_out_is_flagged_and_stops_blocking_the_next_day(): void
    {
        $this->at('2026-09-21 01:00:00'); // 08:00 in Cambodia
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
        $forgotten = $this->sessionOf();

        // 17 hours on (01:00 the next morning) — past the 16h cutoff.
        $this->at('2026-09-21 18:00:00');

        $this->actingAs($this->user)->postJson('/api/attendance/check-out', $this->atHq)
            ->assertStatus(422)
            ->assertJsonPath('errors.event_type.0', fn ($message) => str_contains($message, 'never closed'));

        $this->assertSame('missing_checkout', $forgotten->fresh()->status);

        // ...and a new day's check-in works again.
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
    }

    public function test_the_scheduled_command_flags_forgotten_shifts_for_everyone(): void
    {
        $this->at('2026-09-21 01:00:00');
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
        $session = $this->sessionOf();

        $this->at('2026-09-21 18:00:00');
        $this->artisan('attendance:close-stale')->assertSuccessful();

        $this->assertSame('missing_checkout', $session->fresh()->status);
    }

    public function test_a_night_shift_still_checks_out_after_midnight_but_cannot_start_a_second_shift(): void
    {
        $this->at('2026-09-21 14:00:00'); // 21:00 in Cambodia
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();

        $this->at('2026-09-21 20:00:00'); // 03:00 the next day, 6h later — still a normal open shift
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)
            ->assertStatus(422)
            ->assertJsonPath('errors.event_type.0', fn ($message) => str_contains($message, 'still checked in'));

        $this->actingAs($this->user)->postJson('/api/attendance/check-out', $this->atHq)->assertCreated();
        $this->assertSame('completed', $this->sessionOf()->status);
    }

    // ---- 4. Who may check in -------------------------------------------------

    public function test_terminated_and_suspended_employees_cannot_check_in(): void
    {
        foreach (['terminated', 'suspended'] as $status) {
            $this->employee->update(['employment_status' => $status]);
            $this->user->unsetRelation('employee'); // a real request loads it fresh

            $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)
                ->assertStatus(422)
                ->assertJsonValidationErrors('employee');
        }

        $this->employee->update(['employment_status' => 'on_leave']);
        $this->user->unsetRelation('employee');
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
    }

    public function test_an_inactive_branch_does_not_accept_check_ins_by_qr_or_gps(): void
    {
        $this->hq->update(['is_active' => false]);

        $this->actingAs($this->user)->postJson('/api/attendance/check-in', ['qr_token' => $this->hq->qr_token])
            ->assertStatus(422);

        // GPS-only ignores inactive branches entirely, so there's nothing near enough.
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)
            ->assertStatus(422);
    }

    // ---- 5. Paid vs unpaid breaks --------------------------------------------

    public function test_an_unpaid_break_is_subtracted_from_worked_time_and_a_paid_one_is_not(): void
    {
        $paidUser = $this->createUserWithRole($this->company, 'employee');
        $paidEmployee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Paid', 'user_id' => $paidUser->id]);

        $this->schedule($this->shift(['name' => 'Unpaid break', 'is_break_paid' => false]), '2026-09-21');
        $this->schedule($this->shift(['name' => 'Paid break', 'is_break_paid' => true]), '2026-09-21', $paidEmployee);

        $this->at('2026-09-21 01:00:00');
        $this->actingAs($this->user)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();
        $this->actingAs($paidUser)->postJson('/api/attendance/check-in', $this->atHq)->assertCreated();

        $this->at('2026-09-21 10:00:00'); // 9 hours later
        $this->actingAs($this->user)->postJson('/api/attendance/check-out', $this->atHq)->assertCreated();
        $this->actingAs($paidUser)->postJson('/api/attendance/check-out', $this->atHq)->assertCreated();

        $this->assertSame(480, $this->sessionOf()->worked_minutes);              // 9h - 60 unpaid
        $this->assertSame(540, $this->sessionOf($paidEmployee)->worked_minutes); // 9h, break is paid
    }
}
