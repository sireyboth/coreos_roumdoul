<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkLocation;
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

/**
 * Work schedules end to end: building them, assigning them over time, and a
 * day of real scans judged against them — including overtime approval, the
 * monthly summary payroll reads, and locking a month.
 */
class WorkScheduleTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private $company;

    private User $admin;

    private User $user;

    private Employee $employee;

    private array $atHq = ['latitude' => 11.5564, 'longitude' => 104.9282];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Sched Co', 'Boss', 'boss@sched.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $this->user = $this->createUserWithRole($this->company, 'employee');
        $this->employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Dara', 'user_id' => $this->user->id]);
        WorkLocation::query()->create(['company_id' => $this->company->id, 'name' => 'HQ', 'latitude' => 11.5564, 'longitude' => 104.9282, 'radius_meters' => 100]);
    }

    private function at(string $local): void
    {
        $this->travelTo(Carbon::parse($local, 'Asia/Phnom_Penh'));
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function day(array $slots): array
    {
        return array_map(fn (array $s) => ['type' => $s[0], 'time' => $s[1], 'next_day' => $s[2] ?? false], $slots);
    }

    private function splitShift(array $attributes = []): int
    {
        $split = $this->day([['in', '08:00'], ['out', '12:00'], ['in', '13:00'], ['out', '17:00']]);

        return $this->as($this->admin)->postJson('/api/work_schedules', array_merge([
            'name' => 'Split Shift',
            'late_grace_minutes' => 5,
            'days' => array_map(fn (int $weekday) => ['weekday' => $weekday, 'slots' => $split], range(1, 6)),
            'default_days_off' => [0],
        ], $attributes))->assertCreated()->json('id');
    }

    // ───────────── Building schedules ─────────────

    public function test_a_schedule_can_have_any_number_of_slots_per_day(): void
    {
        $id = $this->as($this->admin)->postJson('/api/work_schedules', [
            'name' => 'Three stretches',
            'days' => [['weekday' => 1, 'slots' => $this->day([
                ['in', '06:00'], ['out', '09:00'], ['in', '11:00'], ['out', '14:00'], ['in', '17:00'], ['out', '20:00'],
            ])]],
        ])->assertCreated()->assertJsonPath('weekly_minutes', 540)->json('id');

        $this->assertCount(6, WorkSchedule::query()->findOrFail($id)->slotsFor(1));
    }

    public function test_slots_must_alternate_in_and_out_and_move_forward_in_time(): void
    {
        $post = fn (array $slots) => $this->as($this->admin)->postJson('/api/work_schedules', [
            'name' => 'Bad '.uniqid(), 'days' => [['weekday' => 1, 'slots' => $this->day($slots)]],
        ]);

        $post([['in', '08:00'], ['in', '12:00']])->assertStatus(422)->assertJsonValidationErrors('days.0.slots');
        $post([['out', '08:00'], ['in', '12:00']])->assertStatus(422);
        $post([['in', '08:00'], ['out', '07:00']])->assertStatus(422);              // backwards
        $post([['in', '08:00'], ['out', '12:00'], ['in', '13:00']])->assertStatus(422); // IN without OUT
        $post([['in', '22:00'], ['out', '06:00', true]])->assertCreated();          // night shift is fine
    }

    public function test_schedule_names_are_unique_within_a_company(): void
    {
        $this->splitShift();

        $this->as($this->admin)->postJson('/api/work_schedules', ['name' => 'Split Shift', 'days' => [
            ['weekday' => 1, 'slots' => $this->day([['in', '08:00'], ['out', '17:00']])],
        ]])->assertStatus(422)->assertJsonValidationErrors('name');
    }

    public function test_only_people_who_manage_schedules_can_change_them(): void
    {
        $this->as($this->user)->postJson('/api/work_schedules', ['name' => 'X', 'days' => []])->assertForbidden();
    }

    // ───────────── Assignments over time ─────────────

    public function test_a_new_assignment_takes_over_and_history_is_kept(): void
    {
        $normal = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Normal']);
        $split = $this->splitShift();

        $this->as($this->admin)->postJson('/api/schedule-assignments', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $normal->id, 'effective_from' => '2026-10-01',
        ])->assertCreated()->assertJsonPath('days_off', []);

        $this->as($this->admin)->postJson('/api/schedule-assignments', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $split, 'effective_from' => '2026-10-15',
        ])->assertCreated()->assertJsonPath('days_off', [0]); // the schedule's suggestion

        $timeline = EmployeeScheduleAssignment::query()->orderBy('effective_from')->get();
        $this->assertSame(['2026-10-01', '2026-10-14'], [$timeline[0]->effective_from->toDateString(), $timeline[0]->effective_to->toDateString()]);
        $this->assertSame('2026-10-15', $timeline[1]->effective_from->toDateString());
        $this->assertNull($timeline[1]->effective_to);
    }

    public function test_a_temporary_assignment_returns_the_person_to_their_usual_schedule(): void
    {
        $normal = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Normal']);
        $this->assignSchedule($this->employee, $normal, '2026-10-01', daysOff: [0, 6]);
        $split = $this->splitShift();

        $this->as($this->admin)->postJson('/api/schedule-assignments', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $split,
            'effective_from' => '2026-10-10', 'effective_to' => '2026-10-20',
        ])->assertCreated();

        $timeline = EmployeeScheduleAssignment::query()->orderBy('effective_from')->get()
            ->map(fn ($a) => [$a->workSchedule->name, $a->effective_from->toDateString(), $a->effective_to?->toDateString(), $a->daysOff()])->all();

        $this->assertSame([
            ['Normal', '2026-10-01', '2026-10-09', [0, 6]],
            ['Split Shift', '2026-10-10', '2026-10-20', [0]],
            ['Normal', '2026-10-21', null, [0, 6]],
        ], $timeline);
    }

    public function test_a_planned_later_assignment_is_never_silently_removed(): void
    {
        $normal = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Normal']);
        $this->assignSchedule($this->employee, $normal, '2026-11-01');

        $this->as($this->admin)->postJson('/api/schedule-assignments', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $this->splitShift(), 'effective_from' => '2026-10-01',
        ])->assertStatus(422)->assertJsonPath('errors.effective_from.0', 'Dara is already set to follow "Normal" from Nov 1, 2026. Change or remove that first.');
    }

    public function test_bulk_assign_reports_who_was_skipped_and_why(): void
    {
        $split = $this->splitShift();
        $busy = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Busy']);
        $this->assignSchedule($busy, $this->makeWorkSchedule($this->company), '2026-12-01');
        $gone = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Gone', 'employment_status' => 'terminated']);

        $result = $this->as($this->admin)->postJson('/api/schedule-assignments/bulk', [
            'employee_ids' => [$this->employee->id, $busy->id, $gone->id],
            'work_schedule_id' => $split, 'effective_from' => '2026-10-01', 'days_off' => [0, 3],
        ])->assertOk();

        $result->assertJsonPath('assigned', 1);
        $this->assertSame(['Busy', 'Gone'], collect($result->json('skipped'))->pluck('name')->sort()->values()->all());
        $this->assertSame([0, 3], EmployeeScheduleAssignment::query()->where('employee_id', $this->employee->id)->first()->daysOff());
    }

    public function test_an_inactive_schedule_cannot_be_newly_assigned(): void
    {
        $old = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Old', 'is_active' => false]);

        $this->as($this->admin)->postJson('/api/schedule-assignments', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $old->id, 'effective_from' => '2026-10-01',
        ])->assertStatus(422)->assertJsonValidationErrors('work_schedule_id');
    }

    // ───────────── A real day of scans ─────────────

    public function test_a_split_shift_day_with_a_forgotten_lunch_scan(): void
    {
        $split = $this->splitShift();
        $this->as($this->admin)->postJson('/api/schedule-assignments', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $split, 'effective_from' => '2026-10-01',
        ])->assertCreated();

        // Monday 5 October.
        $this->at('2026-10-05 08:07');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated()
            ->assertJsonPath('slot.type', 'in')->assertJsonPath('slot.late_minutes', 2);

        $this->at('2026-10-05 09:00');
        $this->as($this->user)->getJson('/api/attendance/today')->assertOk()
            ->assertJsonPath('schedule', 'Split Shift')
            ->assertJsonPath('next.type', 'out')
            ->assertJsonPath('next.sequence', 2);

        // Forgot the 12:00 OUT; back at 13:02, out at 17:15.
        $this->at('2026-10-05 13:02');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated()->assertJsonPath('slot.sequence', 3);
        $this->at('2026-10-05 17:15');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated()->assertJsonPath('slot.sequence', 4);

        // Next morning, after the hourly job has closed the day.
        $this->at('2026-10-06 09:00');
        $this->artisan('attendance:close-days')->assertSuccessful();
        $day = $this->as($this->admin)->getJson('/api/attendance?exception=missing_out')->assertOk()->json('data.0');

        $this->assertSame('2026-10-05', $day['date']);
        $this->assertSame('incomplete', $day['status']);
        $this->assertSame(['late', 'missing', 'ok', 'ok'], array_column($day['slots'], 'status')); // 08:07 is past the 5 min grace
        $this->assertSame(253, $day['worked_minutes']); // only 13:02–17:15 is a complete pair
        $this->assertSame(['in', 'in', 'out'], array_column($day['scans'], 'role'));

        // A correction adds the missing 12:00 OUT; the day becomes complete.
        $id = $this->as($this->user)->postJson('/api/attendance/corrections', [
            'date' => '2026-10-05', 'reason' => 'Forgot at lunch', 'scans' => ['2026-10-05T12:00'],
        ])->assertCreated()->assertJsonCount(1, 'requested_times')->json('id');
        $this->as($this->admin)->postJson("/api/attendance/corrections/{$id}/approve")->assertOk();

        $fixed = AttendanceDay::query()->whereDate('date', '2026-10-05')->firstOrFail();
        $this->assertSame('complete', $fixed->status);
        $this->assertSame(486, $fixed->worked_minutes); // 08:07–12:00 + 13:02–17:15
    }

    public function test_editing_a_schedule_later_does_not_rewrite_finished_days(): void
    {
        $normal = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Normal']);
        $this->assignSchedule($this->employee, $normal, '2026-10-01');

        $this->at('2026-10-05 08:30');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated();
        $this->at('2026-10-05 17:00');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated();

        // The day closes; next week the start time moves to 09:00.
        $this->at('2026-10-07 09:00');
        $this->artisan('attendance:close-days')->assertSuccessful();
        $this->as($this->admin)->putJson("/api/work_schedules/{$normal->id}", ['days' => array_map(
            fn (int $weekday) => ['weekday' => $weekday, 'slots' => $this->day([['in', '09:00'], ['out', '17:00']])], range(0, 6),
        )])->assertOk();

        // Recalculating the finished day (e.g. a later correction) keeps the 08:00 it was judged by.
        app(AttendanceRecorder::class)->recalculate($this->employee, '2026-10-05');
        $this->assertSame(30, AttendanceDay::query()->whereDate('date', '2026-10-05')->value('late_minutes'));
    }

    // ───────────── Overtime, summary, locked months ─────────────

    public function test_overtime_waits_for_approval_and_only_approved_overtime_reaches_the_summary(): void
    {
        $normal = $this->makeWorkSchedule($this->company, attributes: [
            'name' => 'Normal', 'overtime_mode' => 'after_last_out', 'overtime_min_minutes' => 30, 'overtime_requires_approval' => true,
        ]);
        $this->assignSchedule($this->employee, $normal, '2026-10-01');

        $this->at('2026-10-05 08:00');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated();
        $this->at('2026-10-05 18:30');
        $this->as($this->user)->postJson('/api/attendance/scan', $this->atHq)->assertCreated();

        $pending = $this->as($this->admin)->getJson('/api/attendance/overtime?status=pending')->assertOk()->json('0');
        $this->assertSame(90, $pending['overtime_minutes']);
        $this->assertSame('workday', $pending['overtime_type']);

        $summary = fn () => collect($this->as($this->admin)->getJson('/api/attendance/summary?month=2026-10')->assertOk()->json('rows'))
            ->firstWhere('employee.id', $this->employee->id);
        $this->assertSame(0, $summary()['overtime_workday_minutes']);
        $this->assertSame(90, $summary()['overtime_pending_minutes']);

        $this->as($this->admin)->postJson("/api/attendance/days/{$pending['id']}/overtime/approve")->assertOk()
            ->assertJsonPath('overtime_status', 'approved');

        $this->assertSame(90, $summary()['overtime_workday_minutes']);
        $this->assertSame(0, $summary()['overtime_pending_minutes']);
        $this->assertSame(1, $summary()['present_days']);

        // An employee can't approve overtime.
        $this->as($this->user)->postJson("/api/attendance/days/{$pending['id']}/overtime/reject")->assertForbidden();
    }

    public function test_a_locked_month_cannot_be_changed_until_it_is_reopened(): void
    {
        $normal = $this->makeWorkSchedule($this->company, attributes: ['name' => 'Normal']);
        $this->assignSchedule($this->employee, $normal, '2026-09-01');

        $this->at('2026-10-02 10:00');
        $this->as($this->admin)->postJson('/api/attendance/periods', ['month' => '2026-10'])
            ->assertStatus(422)->assertJsonValidationErrors('month'); // not over yet
        $this->as($this->admin)->postJson('/api/attendance/periods', ['month' => '2026-09'])->assertCreated();

        // Every September day was finalised before locking: nobody scanned, so all absent.
        $this->assertSame(30, AttendanceDay::query()->where('status', 'absent')->whereDate('date', '<=', '2026-09-30')->count());

        $this->as($this->user)->postJson('/api/attendance/corrections', [
            'date' => '2026-09-10', 'reason' => 'Late fix', 'scans' => ['2026-09-10T08:00'],
        ])->assertStatus(422)->assertJsonPath('errors.date.0', 'September 2026 is locked for payroll, so its attendance can\'t be changed. Ask an admin to reopen it.');
        $this->as($this->admin)->postJson('/api/schedules', [
            'employee_id' => $this->employee->id, 'work_schedule_id' => $normal->id, 'date' => '2026-09-12',
        ])->assertStatus(422);

        $this->as($this->admin)->deleteJson('/api/attendance/periods/2026-09')->assertNoContent();
        $this->as($this->user)->postJson('/api/attendance/corrections', [
            'date' => '2026-09-10', 'reason' => 'Late fix', 'scans' => ['2026-09-10T08:00'],
        ])->assertCreated();
    }
}
