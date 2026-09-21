<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceEvent;
use App\Models\AttendanceSession;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\CompanyProvisioner;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Dash Co', 'Boss', 'boss@dash.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 1, 'longitude' => 1]);

        // 10:00 in Phnom Penh on 21 Sept 2026.
        $this->travelTo(Carbon::parse('2026-09-21 03:00:00', 'UTC'));
    }

    private function summary($as = null)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($as ?? $this->admin)->getJson('/api/dashboard/summary');
    }

    private function attend(Employee $employee, string $date, array $extra = []): AttendanceSession
    {
        $in = AttendanceEvent::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'event_type' => 'check_in',
            'method' => 'qr', 'event_time' => "{$date} 01:05:00",
        ]);

        return AttendanceSession::query()->create($extra + [
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'date' => $date,
            'check_in_event_id' => $in->id, 'late_minutes' => 0, 'status' => 'open',
        ]);
    }

    public function test_counts_are_exact_even_when_far_more_than_one_page_of_records_exist(): void
    {
        // 70 people checked in today (the old approach counted from the newest 50 rows), 12 of them late.
        foreach (range(1, 70) as $i) {
            $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => "E{$i}"]);
            $this->attend($employee, '2026-09-21', ['late_minutes' => $i <= 12 ? 15 : 0]);
            // ...and 40 of them also worked two days ago.
            if ($i <= 40) {
                $this->attend($employee, '2026-09-19');
            }
        }

        $attendance = $this->summary()->assertOk()->json('attendance');

        $this->assertSame(70, $attendance['checked_in_today']);
        $this->assertSame(12, $attendance['late_today']);

        $this->assertCount(7, $attendance['week']);
        $this->assertSame('2026-09-15', $attendance['week'][0]['date']);
        $this->assertSame('2026-09-21', $attendance['week'][6]['date']);
        $counts = collect($attendance['week'])->pluck('count', 'date');
        $this->assertSame(70, $counts['2026-09-21']);
        $this->assertSame(40, $counts['2026-09-19']);
        // Days with nothing are still listed, as zero.
        $this->assertSame(0, $counts['2026-09-20']);
    }

    public function test_it_reports_headcount_branches_and_pending_corrections_and_the_latest_six_check_ins(): void
    {
        foreach (range(1, 9) as $i) {
            $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => "Person {$i}"]);
            $this->attend($employee, '2026-09-21');
        }
        $employee = Employee::query()->first();
        AttendanceCorrection::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'requested_by' => $this->admin->id,
            'date' => '2026-09-10', 'reason' => 'forgot', 'status' => 'pending',
        ]);
        AttendanceCorrection::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'requested_by' => $this->admin->id,
            'date' => '2026-09-11', 'reason' => 'done', 'status' => 'approved',
        ]);

        $json = $this->summary()->assertOk()->json();

        $this->assertSame(9, $json['employees']);
        $this->assertSame(1, $json['branches']);
        $this->assertSame(1, $json['attendance']['pending_corrections']);
        $this->assertCount(6, $json['attendance']['recent']);
        $this->assertSame('Person 9', $json['attendance']['recent'][0]['employee']['name']);
        // Stored as 01:05 UTC; shown in the company's own time (Phnom Penh, UTC+7).
        $this->assertSame('08:05', $json['attendance']['recent'][0]['check_in']);
        $this->assertArrayHasKey('photo_url', $json['attendance']['recent'][0]['employee']);
    }

    public function test_it_stays_small_and_quick_however_much_data_there_is(): void
    {
        foreach (range(1, 60) as $i) {
            $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => "E{$i}"]);
            $this->attend($employee, '2026-09-21');
        }

        \DB::flushQueryLog();
        \DB::enableQueryLog();
        $response = $this->summary()->assertOk();
        $queries = count(\DB::getQueryLog());

        $this->assertLessThanOrEqual(25, $queries);
        $this->assertLessThan(6, strlen($response->getContent()) / 1024, 'the summary should be a few KB, not a list download');
    }

    public function test_only_people_with_dashboard_access_get_it(): void
    {
        $employee = $this->createUserWithRole($this->company, 'employee');

        $this->summary($employee)->assertForbidden();
    }

    public function test_a_role_with_dashboard_access_but_not_attendance_management_only_sees_their_own_attendance(): void
    {
        $mine = $this->createUserWithRole($this->company, 'employee');
        $me = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Me', 'user_id' => $mine->id]);
        $other = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Other']);
        $this->attend($me, '2026-09-21');
        $this->attend($other, '2026-09-21');

        // Give this ordinary employee the dashboard permission through a custom role.
        $role = \App\Models\CompanyRole::query()->create(['company_id' => $this->company->id, 'name' => 'Viewer', 'code' => 'viewer']);
        $role->permissions()->sync(\App\Models\CompanyPermission::query()->whereIn('code', ['dashboard.view', 'attendance.view'])->pluck('id'));
        $mine->membership->roles()->sync([$role->id]);

        $attendance = $this->summary($mine->fresh())->assertOk()->json('attendance');

        $this->assertSame(1, $attendance['checked_in_today']);
        $this->assertSame(['Me'], collect($attendance['recent'])->pluck('employee.name')->all());
        // No employees.view / branches.view, so those counts are withheld.
        $this->assertNull($this->summary($mine->fresh())->json('employees'));
    }

    public function test_attendance_details_are_left_out_when_the_module_is_off(): void
    {
        $bare = app(CompanyProvisioner::class)->provision('No Module Co', 'Boss', 'boss@nomodule.test', 'password123');

        $json = $this->summary($bare->users()->first())->assertOk()->json();

        $this->assertNull($json['attendance']);
        $this->assertArrayHasKey('today', $json);
    }

    public function test_the_list_endpoints_accept_a_bigger_page_but_never_an_unbounded_one(): void
    {
        foreach (range(1, 60) as $i) {
            $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => "E{$i}"]);
            $this->attend($employee, '2026-09-21');
        }

        $this->assertCount(50, $this->summaryList('/api/attendance')->json('data'));
        $this->assertCount(60, $this->summaryList('/api/attendance?per_page=1000')->json('data'));
        // A silly value is clamped rather than trusted.
        $this->assertSame(1000, $this->summaryList('/api/attendance?per_page=999999')->json('per_page'));
        $this->assertSame(500, $this->summaryList('/api/employees?per_page=999999')->json('per_page'));
        $this->assertSame(2000, $this->summaryList('/api/schedules?per_page=999999')->json('per_page'));
    }

    private function summaryList(string $path)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($this->admin)->getJson($path)->assertOk();
    }
}
