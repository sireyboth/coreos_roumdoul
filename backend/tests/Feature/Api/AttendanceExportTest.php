<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceEvent;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Models\EmployeeRequestDay;
use App\Models\Holiday;
use App\Models\LeaveType;
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

class AttendanceExportTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private Company $company;

    private User $admin;

    private WorkSchedule $schedule;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $this->schedule = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Office']);
        $this->travelTo(Carbon::parse('2026-10-05 05:00:00', 'UTC'));
    }

    /** A finished day for the employee: scans at 08:05 and 17:30 Phnom Penh time against 08:00–17:00. */
    private function shiftFor(Employee $employee, string $date = '2026-09-10'): void
    {
        foreach (['01:05:00', '10:30:00'] as $utc) {
            AttendanceEvent::query()->create([
                'company_id' => $this->company->id, 'employee_id' => $employee->id,
                'method' => 'qr', 'event_time' => "{$date} {$utc}",
            ]);
        }

        app(AttendanceRecorder::class)->recalculate($employee, $date);
    }

    /** Approved unpaid leave on one date: the whole day, or a morning / afternoon. */
    private function approvedLeave(Employee $employee, string $date, string $part): void
    {
        $unpaid = LeaveType::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('code', 'unpaid')->firstOrFail();
        $portion = $part === 'full' ? 1 : 0.5;
        $request = EmployeeRequest::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'requested_by' => $this->admin->id,
            'type' => 'leave', 'leave_type_id' => $unpaid->id, 'start_date' => $date, 'end_date' => $date,
            'day_part' => $part, 'days' => $portion, 'status' => 'approved',
        ]);
        EmployeeRequestDay::query()->create([
            'employee_request_id' => $request->id, 'employee_id' => $employee->id, 'date' => $date, 'portion' => $portion, 'part' => $part,
        ]);
    }

    private function employee(string $name, ?User $user = null, ?string $code = null): Employee
    {
        $employee = Employee::query()->create([
            'company_id' => $this->company->id, 'name' => $name, 'employee_code' => $code, 'user_id' => $user?->id,
        ]);
        $this->assignSchedule($employee, $this->schedule);

        return $employee;
    }

    /** The response body as rows, without the byte-order mark. */
    private function rows($response): array
    {
        $body = ltrim($response->streamedContent(), "\xEF\xBB\xBF");

        return array_map('str_getcsv', array_filter(explode("\n", $body)));
    }

    /** The data rows as column => value, keyed "Name|Y-m-d". */
    private function byDay(array $rows): array
    {
        $header = array_shift($rows);
        $keyed = [];
        foreach ($rows as $row) {
            $row = array_combine($header, $row);
            $keyed[$row['Employee'].'|'.$row['Date']] = $row;
        }

        return $keyed;
    }

    public function test_a_manager_exports_everyone_with_times_in_the_company_timezone(): void
    {
        $this->shiftFor($this->employee('Sok Dara', null, 'E-001'));
        $this->shiftFor($this->employee('Chan Vy', null, 'E-002'));

        $response = $this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30');

        $response->assertOk()->assertDownload('attendance-2026-09-01-to-2026-09-30.csv');
        $rows = $this->rows($response);
        $columns = array_flip($rows[0]);

        $this->assertSame('Employee ID', $rows[0][0]);
        $this->assertCount(1 + 2 * 30, $rows); // header + every September day for two people
        // People are in the company's display order — here nobody has one, so by name — each day by day.
        $this->assertSame(['Chan Vy', '2026-09-01'], [$rows[1][1], $rows[1][$columns['Date']]]);
        $this->assertSame(['Chan Vy', '2026-09-30'], [$rows[30][1], $rows[30][$columns['Date']]]);
        $this->assertSame(['Sok Dara', '2026-09-01'], [$rows[31][1], $rows[31][$columns['Date']]]);
        $row = $rows[31 + 9]; // Sok Dara, 10 September
        $this->assertSame(['E-001', 'Sok Dara'], array_slice($row, 0, 2));
        $this->assertSame('2026-09-10', $row[$columns['Date']]);
        $this->assertSame('Office', $row[$columns['Schedule']]);
        // 01:05 UTC is 08:05 in Phnom Penh.
        $this->assertSame('IN 08:00, OUT 17:00', $row[$columns['Expected']]);
        $this->assertSame('IN 08:05, OUT 17:30', $row[$columns['Scans']]);
        $this->assertSame('5', $row[$columns['Late (min)']]);
        $this->assertSame('9.42', $row[$columns['Worked (hours)']]); // 08:05–17:30
        $this->assertSame('Complete', $row[$columns['Status']]);
        $this->assertSame('Late', $row[$columns['Exceptions']]);
    }

    public function test_one_employee_can_be_exported_on_their_own(): void
    {
        $sok = $this->employee('Sok Dara');
        $this->shiftFor($sok);
        $this->shiftFor($this->employee('Chan Vy'));

        $rows = $this->rows($this->actingAs($this->admin)->get("/api/attendance/export?from=2026-09-01&to=2026-09-30&employee_id={$sok->id}"));

        $this->assertCount(1 + 30, $rows);
        $this->assertSame(['Sok Dara'], array_values(array_unique(array_column(array_slice($rows, 1), 1))));
    }

    public function test_only_days_inside_the_range_are_exported(): void
    {
        $employee = $this->employee('Sok Dara');
        $this->shiftFor($employee, '2026-08-31');
        $this->shiftFor($employee, '2026-09-15');

        $days = $this->byDay($this->rows($this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30')));

        $this->assertCount(30, $days);
        $this->assertArrayNotHasKey('Sok Dara|2026-08-31', $days);
        $this->assertSame('IN 08:05, OUT 17:30', $days['Sok Dara|2026-09-15']['Scans']);
    }

    public function test_every_date_is_listed_with_leave_holidays_days_off_and_missed_scans(): void
    {
        $employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Sok Dara']);
        // Sundays off.
        $this->assignSchedule($employee, $this->schedule, '2026-09-01', daysOff: [0]);
        Holiday::query()->create(['company_id' => $this->company->id, 'name' => 'Pchum Ben', 'date' => '2026-09-22']);
        $this->approvedLeave($employee, '2026-09-08', 'full');
        $this->approvedLeave($employee, '2026-09-09', 'morning');
        // Scanned in, never out.
        AttendanceEvent::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'method' => 'qr', 'event_time' => '2026-09-14 01:00:00',
        ]);
        app(AttendanceRecorder::class)->recalculateRange($employee, '2026-09-01', '2026-10-05');

        $days = $this->byDay($this->rows($this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-10-31')));

        $this->assertCount(61, $days);

        $leave = $days['Sok Dara|2026-09-08'];
        $this->assertSame(['Leave', 'Unpaid leave', 'Off'], [$leave['Day type'], $leave['Leave / holiday'], $leave['Status']]);
        $half = $days['Sok Dara|2026-09-09'];
        $this->assertSame(['Work', 'Unpaid leave (morning)'], [$half['Day type'], $half['Leave / holiday']]);
        $this->assertSame(['Holiday', 'Pchum Ben', 'Off'], [$days['Sok Dara|2026-09-22']['Day type'], $days['Sok Dara|2026-09-22']['Leave / holiday'], $days['Sok Dara|2026-09-22']['Status']]);
        $this->assertSame(['Weekly off', 'Off'], [$days['Sok Dara|2026-09-06']['Day type'], $days['Sok Dara|2026-09-06']['Status']]);

        $missed = $days['Sok Dara|2026-09-14'];
        $this->assertSame(['Incomplete', 'Missing out'], [$missed['Status'], $missed['Exceptions']]);
        $this->assertSame('Absent', $days['Sok Dara|2026-09-15']['Status']);

        // Days still to come are listed with what is expected of them.
        $upcoming = $days['Sok Dara|2026-10-20'];
        $this->assertSame(['Upcoming', 'IN 08:00, OUT 17:00'], [$upcoming['Status'], $upcoming['Expected']]);
    }

    public function test_the_note_explains_approved_permission_and_corrections(): void
    {
        $employee = $this->employee('Sok Dara');
        $permission = EmployeeRequest::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'requested_by' => $this->admin->id,
            'type' => 'late_early', 'start_date' => '2026-09-10', 'end_date' => '2026-09-10', 'days' => 0, 'status' => 'approved',
            'details' => ['kind' => 'late', 'time' => '09:00', 'minutes' => 60],
        ]);
        EmployeeRequestDay::query()->create([
            'employee_request_id' => $permission->id, 'employee_id' => $employee->id, 'date' => '2026-09-10', 'portion' => 0, 'part' => 'full',
        ]);
        AttendanceCorrection::query()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id, 'date' => '2026-09-11',
            'requested_by' => $this->admin->id, 'reason' => 'Forgot to scan this morning', 'status' => 'approved',
        ]);
        $this->shiftFor($employee, '2026-09-10');

        $response = $this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30&with_ids=1');
        $days = $this->byDay($this->rows($response));

        $this->assertSame('Approved late arrival 09:00', $days['Sok Dara|2026-09-10']['Note']);
        // Judged against 09:00, an 08:05 scan isn't late.
        $this->assertSame('0', $days['Sok Dara|2026-09-10']['Late (min)']);
        $this->assertSame('Correction: Forgot to scan this morning', $days['Sok Dara|2026-09-11']['Note']);
        $this->assertSame((string) $employee->id, $days['Sok Dara|2026-09-10']['Employee key']);

        // Without asking, the internal id stays out of the file.
        $this->assertNotContains('Employee key', $this->rows($this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30'))[0]);
    }

    public function test_days_before_someone_started_are_left_out(): void
    {
        $employee = $this->employee('Sok Dara');
        $employee->update(['hire_date' => '2026-09-21']);

        $days = $this->byDay($this->rows($this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30')));

        $this->assertSame('2026-09-21', array_values($days)[0]['Date']);
        $this->assertCount(10, $days);
    }

    public function test_an_ordinary_employee_only_gets_their_own_rows(): void
    {
        $user = $this->createUserWithRole($this->company, 'employee');
        $me = $this->employee('Me Myself', $user);
        $other = $this->employee('Someone Else');
        $this->shiftFor($me);
        $this->shiftFor($other);

        $everyone = $this->rows($this->actingAs($user)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30'));
        $this->assertCount(1 + 30, $everyone);
        $this->assertSame(['Me Myself'], array_values(array_unique(array_column(array_slice($everyone, 1), 1))));

        // Asking for a colleague by id doesn't get around it.
        $colleague = $this->rows($this->actingAs($user)->get("/api/attendance/export?from=2026-09-01&to=2026-09-30&employee_id={$other->id}"));
        $this->assertCount(1, $colleague);
    }

    public function test_a_name_that_looks_like_a_formula_is_neutralised(): void
    {
        $this->shiftFor($this->employee('=HYPERLINK("http://evil.test")'));

        $rows = $this->rows($this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30'));

        $this->assertSame('\'=HYPERLINK("http://evil.test")', $rows[1][1]);
    }

    public function test_the_range_is_required_and_capped_at_a_year(): void
    {
        $this->actingAs($this->admin)->getJson('/api/attendance/export')->assertStatus(422)->assertJsonValidationErrors(['from', 'to']);
        $this->actingAs($this->admin)->getJson('/api/attendance/export?from=2026-09-30&to=2026-09-01')->assertStatus(422)->assertJsonValidationErrors('to');
        $this->actingAs($this->admin)->getJson('/api/attendance/export?from=2024-01-01&to=2026-01-01')->assertStatus(422)->assertJsonValidationErrors('to');
    }
}
