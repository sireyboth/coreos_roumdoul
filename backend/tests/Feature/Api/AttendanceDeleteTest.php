<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceAdjustment;
use App\Models\AttendanceEvent;
use App\Models\AttendancePeriod;
use App\Models\AuditLog;
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

/** Clearing test attendance: a day's scans, corrections and adjustments gone for good. */
class AttendanceDeleteTest extends TestCase
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

        $this->company = app(CompanyProvisioner::class)->provision('Delete Co', 'Boss', 'boss@delete.test', 'password123');
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
        $this->assignSchedule($this->employee, $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '17:00']]));
    }

    private function scanAt(string $localDateTime): AttendanceEvent
    {
        $this->travelTo(Carbon::parse($localDateTime, 'Asia/Phnom_Penh'));
        $this->actingAs($this->user)->postJson('/api/attendance/scan', ['latitude' => 11.5564, 'longitude' => 104.9282])->assertCreated();

        return AttendanceEvent::query()->latest('id')->firstOrFail();
    }

    private function deleteDays(array $ids, ?User $as = null)
    {
        $this->travelTo(Carbon::parse('2026-09-23 09:00', 'Asia/Phnom_Penh'));

        return $this->actingAs($as ?? $this->admin)->postJson('/api/attendance/days/delete', ['ids' => $ids]);
    }

    public function test_deleting_a_day_removes_its_scans_and_adjustments_for_good(): void
    {
        $stray = $this->scanAt('2026-09-21 08:00');
        $this->scanAt('2026-09-21 17:00');
        $this->travelTo(Carbon::parse('2026-09-22 08:30', 'Asia/Phnom_Penh'));
        $this->actingAs($this->admin)->postJson('/api/attendance/adjustments', [
            'employee_id' => $this->employee->id, 'date' => '2026-09-21', 'reason' => 'Test', 'void' => [$stray->id], 'add' => ['2026-09-21T08:00'],
        ])->assertOk();
        $nextDay = $this->scanAt('2026-09-22 08:00');

        $this->deleteDays([$this->attendanceDay($this->employee, '2026-09-21')->id])->assertOk()->assertJsonPath('deleted', 1);

        // Voided scans too, but not the next day's.
        $this->assertSame([$nextDay->id], AttendanceEvent::withTrashed()->pluck('id')->all());
        $this->assertSame(0, AttendanceAdjustment::query()->withoutGlobalScopes()->count());

        // A past work day with no scans is what it is: absent.
        $day = $this->attendanceDay($this->employee, '2026-09-21');
        $this->assertSame(0, $day->scan_count);
        $this->assertSame('absent', $day->status);
        $this->assertSame(1, $this->attendanceDay($this->employee, '2026-09-22')->scan_count);

        $this->assertTrue(AuditLog::query()->where('event', 'attendance.day_deleted')->exists());
    }

    public function test_an_employee_cannot_delete_attendance(): void
    {
        $this->scanAt('2026-09-21 08:00');

        $this->deleteDays([$this->attendanceDay($this->employee, '2026-09-21')->id], $this->user)->assertForbidden();
        $this->assertSame(1, AttendanceEvent::query()->count());
    }

    public function test_nothing_is_deleted_when_one_of_the_days_is_locked(): void
    {
        $this->scanAt('2026-08-31 08:00');
        $this->scanAt('2026-09-21 08:00');
        AttendancePeriod::query()->create(['company_id' => $this->company->id, 'month' => '2026-08', 'locked_by' => $this->admin->id, 'locked_at' => now()]);
        app(AttendanceRecorder::class)->forgetLocks(); // the test app keeps one recorder across requests

        $this->deleteDays([
            $this->attendanceDay($this->employee, '2026-09-21')->id,
            $this->attendanceDay($this->employee, '2026-08-31')->id,
        ])->assertJsonValidationErrors('ids');

        $this->assertSame(2, AttendanceEvent::query()->count());
    }

    public function test_unknown_days_are_rejected(): void
    {
        $this->deleteDays([999999])->assertJsonValidationErrors('ids');
    }
}
