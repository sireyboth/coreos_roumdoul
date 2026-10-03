<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\AttendancePeriod;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkLocation;
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
 * An admin fixing a day directly: voiding a wrong scan, adding a missing
 * one, or moving one to the right time — and the day following along.
 */
class AttendanceAdjustmentTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private $company;

    private User $admin;

    private User $user;

    private Employee $employee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        // Asia/Phnom_Penh (UTC+7).
        $this->company = app(CompanyProvisioner::class)->provision('Adjust Co', 'Boss', 'boss@adjust.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $this->admin = $this->company->users()->first();
        $this->user = $this->createUserWithRole($this->company, 'employee');
        $this->employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Worker', 'user_id' => $this->user->id]);
        WorkLocation::query()->create([
            'company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 11.5564, 'longitude' => 104.9282, 'radius_meters' => 100,
        ]);

        $this->assignSchedule($this->employee, $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '17:00']], [
            'late_grace_minutes' => 10, 'break_minutes' => 60, 'is_break_paid' => false,
        ]));
    }

    /** A scan at a local Phnom Penh time on 2026-09-21. */
    private function scanAt(string $local): AttendanceEvent
    {
        $this->travelTo(Carbon::parse("2026-09-21 {$local}", 'Asia/Phnom_Penh'));
        $this->actingAs($this->user)->postJson('/api/attendance/scan', ['latitude' => 11.5564, 'longitude' => 104.9282])->assertCreated();

        return AttendanceEvent::query()->latest('id')->firstOrFail();
    }

    private function adjust(array $data, ?User $as = null)
    {
        $this->travelTo(Carbon::parse('2026-09-22 09:00', 'Asia/Phnom_Penh'));

        return $this->actingAs($as ?? $this->admin)->postJson('/api/attendance/adjustments', [
            'employee_id' => $this->employee->id,
            'date' => '2026-09-21',
            'reason' => 'Fixing the record',
            ...$data,
        ]);
    }

    public function test_admin_adds_a_forgotten_clock_out(): void
    {
        $this->scanAt('08:00');

        $this->adjust(['add' => ['2026-09-21T17:00']])
            ->assertOk()
            ->assertJsonPath('day.status', 'complete')
            ->assertJsonPath('day.worked_minutes', 480)
            ->assertJsonPath('day.slots.1.scan.method', 'adjustment');

        $added = AttendanceEvent::query()->where('method', 'adjustment')->firstOrFail();
        $this->assertSame($this->admin->id, $added->recorded_by);
        $this->assertSame('2026-09-21 10:00:00', $added->event_time->utc()->format('Y-m-d H:i:s'));
    }

    public function test_admin_moves_a_clock_in_to_the_right_time(): void
    {
        $wrong = $this->scanAt('09:30');
        $this->scanAt('17:00');
        $this->assertSame(80, $this->attendanceDay($this->employee, '2026-09-21')->late_minutes);

        $this->adjust(['void' => [$wrong->id], 'add' => ['2026-09-21T08:00']])
            ->assertOk()
            ->assertJsonPath('day.late_minutes', 0)
            ->assertJsonPath('day.worked_minutes', 480);

        // The wrong scan is voided, not erased.
        $voided = AttendanceEvent::withTrashed()->findOrFail($wrong->id);
        $this->assertTrue($voided->trashed());
        $this->assertSame($this->admin->id, $voided->voided_by);
        $this->assertSame('Fixing the record', $voided->void_reason);
    }

    public function test_the_export_and_the_day_say_who_adjusted_it_and_why(): void
    {
        $wrong = $this->scanAt('09:30');
        $this->adjust(['void' => [$wrong->id], 'add' => ['2026-09-21T08:00', '2026-09-21T17:00'], 'reason' => 'Scanner was down']);

        $this->actingAs($this->admin)->getJson('/api/attendance?from=2026-09-21&to=2026-09-21')
            ->assertJsonPath('data.0.adjustments.0.by', $this->admin->name)
            ->assertJsonPath('data.0.adjustments.0.reason', 'Scanner was down')
            ->assertJsonPath('data.0.adjustments.0.changes', 'Removed 09:30; Added 08:00, 17:00');

        $body = $this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-21&to=2026-09-21')->streamedContent();
        $rows = array_map('str_getcsv', array_filter(explode("\n", ltrim($body, "\xEF\xBB\xBF"))));
        $row = array_combine($rows[0], $rows[1]);

        $this->assertSame('IN 08:00 (adjusted), OUT 17:00 (adjusted)', $row['Scans']);
        $this->assertSame($this->admin->name, $row['Adjusted by']);
        $this->assertSame('2026-09-22 09:00', $row['Adjusted at']);
        $this->assertSame('Scanner was down', $row['Adjustment reason']);
        $this->assertSame('Removed 09:30; Added 08:00, 17:00', $row['Adjustment changes']);
    }

    public function test_removing_a_stray_scan_takes_it_out_of_the_day(): void
    {
        $this->scanAt('08:00');
        $stray = $this->scanAt('12:00');
        $this->scanAt('17:00');

        $this->adjust(['void' => [$stray->id]])
            ->assertOk()
            ->assertJsonPath('day.scan_count', 2)
            ->assertJsonCount(0, 'day.extra_scans');
    }

    public function test_an_adjustment_needs_a_reason_and_a_change(): void
    {
        $this->scanAt('08:00');

        $this->adjust(['reason' => '', 'add' => ['2026-09-21T17:00']])->assertJsonValidationErrors('reason');
        $this->adjust([])->assertJsonValidationErrors('add');
    }

    public function test_another_employees_scan_cannot_be_voided(): void
    {
        $other = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Other']);
        $event = AttendanceEvent::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $other->id, 'method' => 'none', 'event_time' => now(),
        ]);

        $this->adjust(['void' => [$event->id]])->assertJsonValidationErrors('void');
        $this->assertFalse($event->fresh()->trashed());
    }

    public function test_a_locked_month_cannot_be_adjusted(): void
    {
        $this->scanAt('08:00');
        AttendancePeriod::query()->create(['company_id' => $this->company->id, 'month' => '2026-09', 'locked_by' => $this->admin->id, 'locked_at' => now()]);
        app(AttendanceRecorder::class)->forgetLocks(); // the test app keeps one recorder across requests

        $this->adjust(['add' => ['2026-09-21T17:00']])->assertJsonValidationErrors('date');
        $this->assertSame(0, AttendanceEvent::query()->where('method', 'adjustment')->count());
    }

    public function test_an_employee_cannot_adjust_attendance(): void
    {
        $this->scanAt('08:00');

        $this->adjust(['add' => ['2026-09-21T17:00']], $this->user)->assertForbidden();
    }
}
