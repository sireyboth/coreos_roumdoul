<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\Company;
use App\Models\Employee;
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

    public function test_a_manager_exports_everyone_with_times_in_the_company_timezone(): void
    {
        $this->shiftFor($this->employee('Sok Dara', null, 'E-001'));
        $this->shiftFor($this->employee('Chan Vy', null, 'E-002'));

        $response = $this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30');

        $response->assertOk()->assertDownload('attendance-2026-09-01-to-2026-09-30.csv');
        $rows = $this->rows($response);
        $columns = array_flip($rows[0]);

        $this->assertSame('Employee ID', $rows[0][0]);
        $this->assertCount(3, $rows); // header + two people
        $row = $rows[1];
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

        $this->assertCount(2, $rows);
        $this->assertSame('Sok Dara', $rows[1][1]);
    }

    public function test_only_days_inside_the_range_are_exported(): void
    {
        $employee = $this->employee('Sok Dara');
        $this->shiftFor($employee, '2026-08-31');
        $this->shiftFor($employee, '2026-09-15');

        $rows = $this->rows($this->actingAs($this->admin)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30'));

        $this->assertCount(2, $rows);
        $this->assertSame('2026-09-15', $rows[1][array_flip($rows[0])['Date']]);
    }

    public function test_an_ordinary_employee_only_gets_their_own_rows(): void
    {
        $user = $this->createUserWithRole($this->company, 'employee');
        $me = $this->employee('Me Myself', $user);
        $other = $this->employee('Someone Else');
        $this->shiftFor($me);
        $this->shiftFor($other);

        $everyone = $this->rows($this->actingAs($user)->get('/api/attendance/export?from=2026-09-01&to=2026-09-30'));
        $this->assertCount(2, $everyone);
        $this->assertSame('Me Myself', $everyone[1][1]);

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
