<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceEvent;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\EmployeeRequest;
use App\Models\Holiday;
use App\Models\LeaveType;
use App\Models\MembershipBranchAccess;
use App\Models\Notification;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkSchedule;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\CompanyProvisioner;
use App\Services\Requests\EmployeeRequestService;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\Concerns\CreatesWorkSchedules;
use Tests\TestCase;

/**
 * Leave requests end to end, the way HR runs them: the policy (Cambodian
 * defaults), balances, who approves, what attendance shows afterwards, and
 * the edges — half days, holidays inside a range, overlaps, locked payroll,
 * two managers clicking at once.
 *
 * "Today" is Monday 5 October 2026, 10:00 in Phnom Penh. Dara works
 * Mon–Fri 08:00–12:00 + 13:00–17:00, hired 1 January 2024.
 */
class LeaveRequestTest extends TestCase
{
    use CreatesCompanyUsers, CreatesWorkSchedules, RefreshDatabase;

    private Company $company;

    private User $admin;

    private Branch $branchA;

    private Branch $branchB;

    private WorkSchedule $schedule;

    private User $staff;

    private Employee $dara;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
        $this->travelTo(Carbon::parse('2026-10-05 10:00', 'Asia/Phnom_Penh'));

        $this->company = app(CompanyProvisioner::class)->provision('Leave Co', 'Boss', 'boss@leave.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'starter')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $this->branchA = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Branch A']);
        $this->branchB = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Branch B']);
        $this->schedule = $this->makeWorkSchedule(
            $this->company,
            [['in', '08:00'], ['out', '12:00'], ['in', '13:00'], ['out', '17:00']],
            ['late_grace_minutes' => 0],
            weekdays: [1, 2, 3, 4, 5],
        );

        [$this->staff, $this->dara] = $this->person('Dara', 'employee', ['gender' => 'female', 'hire_date' => '2024-01-01']);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** @return array{0: User, 1: Employee} */
    private function person(string $name, string $role, array $attributes = [], ?Branch $branch = null, ?Employee $manager = null): array
    {
        $user = $this->createUserWithRole($this->company, $role, ['name' => $name]);
        $employee = Employee::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'display_name' => $name, 'user_id' => $user->id, ...$attributes,
        ]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id,
            'branch_id' => ($branch ?? $this->branchA)->id, 'manager_employee_id' => $manager?->id, 'effective_from' => '2020-01-01',
        ]);
        $this->assignSchedule($employee, $this->schedule);

        return [$user, $employee];
    }

    /** A branch approver: the built-in manager role, limited to one branch. */
    private function approverOf(Branch $branch, string $name): User
    {
        $user = $this->createUserWithRole($this->company, 'manager', ['name' => $name]);
        MembershipBranchAccess::query()->create(['company_membership_id' => $user->membership->id, 'branch_id' => $branch->id, 'created_at' => now()]);

        return $user;
    }

    private function giveDaraALineManager(): User
    {
        [$sokhaUser, $sokha] = $this->person('Sokha', 'employee');
        EmployeeAssignment::query()->withoutGlobalScopes()->where('employee_id', $this->dara->id)->update(['manager_employee_id' => $sokha->id]);

        return $sokhaUser;
    }

    private function type(string $code): LeaveType
    {
        return LeaveType::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('code', $code)->firstOrFail();
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function ask(User $user, string $code, string $start, ?string $end = null, array $extra = [])
    {
        return $this->as($user)->postJson('/api/requests', [
            'leave_type_id' => $this->type($code)->id, 'start_date' => $start, 'end_date' => $end ?? $start, ...$extra,
        ]);
    }

    private function alerts(User $user, string $type)
    {
        return Notification::query()->withoutGlobalScopes()->where('recipient_user_id', $user->id)->where('notification_type', $type)->get();
    }

    private function scan(Employee $employee, string $at): void
    {
        AttendanceEvent::query()->withoutGlobalScopes()->create([
            'company_id' => $employee->company_id, 'employee_id' => $employee->id, 'method' => 'qr',
            'event_time' => Carbon::parse($at, 'Asia/Phnom_Penh')->utc(),
        ]);
    }

    private function balance(User $user, string $code, ?int $employeeId = null): ?array
    {
        return collect($this->as($user)->getJson('/api/leave-balances'.($employeeId ? "?employee_id={$employeeId}" : ''))->assertOk()->json('balances'))
            ->firstWhere('leave_type.code', $code);
    }

    // ───────────────────────────── policy & balance ─────────────────────────────

    public function test_every_company_starts_with_the_cambodian_leave_policy(): void
    {
        $types = collect($this->as($this->staff)->getJson('/api/leave-types')->assertOk()->json())->keyBy('code');

        $this->assertSame(['annual', 'sick', 'special', 'maternity', 'paternity', 'unpaid'], $types->keys()->all());
        $this->assertSame('monthly', $types['annual']['accrual']);
        $this->assertEquals(18, $types['annual']['yearly_days']);
        $this->assertSame(12, $types['annual']['eligible_after_months']);
        $this->assertEquals(7, $types['special']['yearly_days']);
        $this->assertSame('calendar_days', $types['maternity']['counts']);
        $this->assertEquals(90, $types['maternity']['max_days_per_request']);
        $this->assertSame('female', $types['maternity']['gender']);
        $this->assertEquals(1, $types['sick']['attachment_from_days']);
        $this->assertSame(0, $types['unpaid']['pay_percent']);
    }

    public function test_annual_leave_is_earned_at_one_and_a_half_days_a_month_plus_seniority(): void
    {
        // Jan–Sep 2026 are full months by 5 Oct: 9 × 1.5.
        $annual = $this->balance($this->staff, 'annual');
        $this->assertEquals(13.5, $annual['earned']);
        $this->assertEquals(18, $annual['full_year']);
        $this->assertEquals(13.5, $annual['available']);

        // Six years' service by 1 Jan 2026: +2 days a year (one per three years) → 20 a year.
        [$veteranUser] = $this->person('Veteran', 'employee', ['hire_date' => '2020-01-01']);
        $this->assertEquals(20, $this->balance($veteranUser, 'annual')['full_year']);
        $this->assertEquals(15, $this->balance($veteranUser, 'annual')['earned']);

        // Hired mid-March: April–September → 6 full months (15 Mar – 14 Sep… counted to 5 Oct).
        [$newUser] = $this->person('New', 'employee', ['hire_date' => '2026-03-15']);
        $this->assertEquals(9, $this->balance($newUser, 'annual')['earned']);

        // Special leave: 7 every year, from January.
        $this->assertEquals(7, $this->balance($this->staff, 'special')['available']);
    }

    public function test_a_range_only_takes_work_days_holidays_and_weekends_inside_are_free(): void
    {
        Holiday::query()->withoutGlobalScopes()->create(['company_id' => $this->company->id, 'name' => 'Pchum Ben', 'date' => '2026-10-12']);

        // Thu 8 – Tue 13 Oct: Sat, Sun and the Monday holiday don't count.
        $preview = $this->as($this->staff)->postJson('/api/requests/preview', [
            'leave_type_id' => $this->type('annual')->id, 'start_date' => '2026-10-08', 'end_date' => '2026-10-13',
        ])->assertOk();

        $preview->assertJsonPath('total', 3)->assertJsonPath('problems', []);
        $this->assertSame(['2026-10-08', '2026-10-09', '2026-10-13'], array_column($preview->json('days'), 'date'));
        $preview->assertJsonPath('balances.0.available', 13.5)->assertJsonPath('balances.0.after', 10.5)
            ->assertJsonPath('balances.0.leave_type.name', 'Annual leave')
            ->assertJsonPath('balances.0.year', 2026);
    }

    public function test_a_holiday_announced_after_the_leave_gives_that_day_back(): void
    {
        $id = $this->ask($this->staff, 'annual', '2026-10-08', '2026-10-09')->assertCreated()->assertJsonPath('days', 2)->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        $holiday = $this->as($this->admin)->postJson('/api/holidays', ['name' => 'Surprise holiday', 'date' => '2026-10-09'])->assertCreated()->json('id');

        $this->as($this->staff)->getJson("/api/requests/{$id}")->assertJsonPath('days', 1)->assertJsonCount(1, 'dates');
        $this->assertEquals(1, $this->balance($this->staff, 'annual')['used']);

        // Called off again: the day is leave once more.
        $this->as($this->admin)->deleteJson("/api/holidays/{$holiday}")->assertNoContent();
        $this->as($this->staff)->getJson("/api/requests/{$id}")->assertJsonPath('days', 2);
    }

    public function test_dates_with_no_work_at_all_are_refused(): void
    {
        $this->ask($this->staff, 'annual', '2026-10-10', '2026-10-11')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['start_date' => 'No working days']);
    }

    public function test_annual_leave_waits_for_twelve_months_of_service(): void
    {
        [$newUser] = $this->person('New', 'employee', ['hire_date' => '2026-03-01']);

        $this->ask($newUser, 'annual', '2026-10-08')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['start_date' => 'from 1 Mar 2027']);
    }

    public function test_the_balance_can_not_be_overspent_and_waiting_requests_hold_their_days(): void
    {
        // 13.5 earned so far: 10 days waiting leaves 3.5 today.
        $this->ask($this->staff, 'annual', '2026-10-19', '2026-10-30')->assertCreated()->assertJsonPath('days', 10);
        $this->assertEquals(3.5, $this->balance($this->staff, 'annual')['available']);

        // Leave is checked against what is earned by its own dates: by 13 Nov,
        // October is earned too (15), so 5 are left — not enough for 10.
        $this->ask($this->staff, 'annual', '2026-11-02', '2026-11-13')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['balance' => 'Not enough Annual leave: 10 days asked, 5 left for 2026.']);
        $this->ask($this->staff, 'annual', '2026-11-02', '2026-11-06')->assertCreated();
    }

    public function test_any_leave_type_gets_a_yearly_limit_by_setting_its_days_and_none_when_cleared(): void
    {
        $sick = $this->type('sick');

        $this->as($this->staff)->putJson("/api/leave-types/{$sick->id}", ['yearly_days' => 7])->assertForbidden();
        $this->as($this->admin)->putJson("/api/leave-types/{$sick->id}", ['yearly_days' => 7])
            ->assertOk()
            ->assertJsonPath('requires_balance', true)
            ->assertJsonPath('accrual', 'yearly');

        $this->assertEquals(7, $this->balance($this->staff, 'sick')['available']);
        $this->ask($this->staff, 'sick', '2026-10-12', '2026-10-21', ['attachment' => UploadedFile::fake()->create('note.pdf', 10, 'application/pdf')])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['balance' => 'Not enough Sick leave: 8 days asked, 7 left for 2026.']);

        // Cleared: no limit again, and no balance card for it.
        $this->as($this->admin)->putJson("/api/leave-types/{$sick->id}", ['yearly_days' => null])
            ->assertOk()
            ->assertJsonPath('requires_balance', false)
            ->assertJsonPath('accrual', 'none');
        $this->assertNull($this->balance($this->staff, 'sick'));

        // Annual keeps earning monthly when only its number changes.
        $this->as($this->admin)->putJson("/api/leave-types/{$this->type('annual')->id}", ['yearly_days' => 24])
            ->assertOk()->assertJsonPath('accrual', 'monthly');
        $this->assertEquals(18, $this->balance($this->staff, 'annual')['earned']);
    }

    public function test_hr_adjusts_a_balance_with_a_reason_and_staff_cannot(): void
    {
        $payload = ['employee_id' => $this->dara->id, 'leave_type_id' => $this->type('annual')->id, 'year' => 2026, 'days' => 3, 'reason' => 'Carried over from 2025'];

        $this->as($this->staff)->postJson('/api/leave-adjustments', $payload)->assertForbidden();
        $this->as($this->admin)->postJson('/api/leave-adjustments', [...$payload, 'days' => 0.3])->assertStatus(422);
        $this->as($this->admin)->postJson('/api/leave-adjustments', $payload)->assertCreated();

        $annual = $this->balance($this->staff, 'annual');
        $this->assertEquals(3, $annual['adjustments']);
        $this->assertEquals(16.5, $annual['available']);
    }

    // ───────────────────────────── who approves ─────────────────────────────

    public function test_the_line_manager_decides_even_without_any_approval_permission(): void
    {
        $sokha = $this->giveDaraALineManager();
        $branchApprover = $this->approverOf($this->branchA, 'HR A');

        $id = $this->ask($this->staff, 'annual', '2026-10-08', '2026-10-09', ['reason' => 'Family trip'])
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('waiting_on.name', 'Sokha')
            ->json('id');

        // Only the line manager is alerted; the branch approver isn't bothered.
        $alert = $this->alerts($sokha, 'request.leave_requested')->sole();
        $this->assertSame('🌴 Leave request from Dara', $alert->title);
        $this->assertStringContainsString('Annual leave · Thu 8 Oct – Fri 9 Oct · 2 days — Family trip', $alert->body);
        $this->assertCount(0, $this->alerts($branchApprover, 'request.leave_requested'));

        $this->as($sokha)->getJson('/api/requests?scope=approvals')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.can.decide', true);
        $this->as($sokha)->getJson('/api/requests/waiting-count')->assertJsonPath('count', 1);
        $this->as($sokha)->postJson("/api/requests/{$id}/approve", ['notes' => 'Enjoy'])->assertOk()->assertJsonPath('status', 'approved');

        $decided = $this->alerts($this->staff, 'request.leave_decided')->sole();
        $this->assertSame('✅ Leave approved', $decided->title);
        $this->assertSame('Annual leave · Thu 8 Oct – Fri 9 Oct · 2 days — approved by Sokha. Remark: Enjoy', $decided->body);
        $this->assertNotNull($alert->fresh()->resolved_at);

        $this->assertEquals(2, $this->balance($this->staff, 'annual')['used']);
    }

    public function test_a_branch_approver_can_step_in_for_an_absent_line_manager(): void
    {
        $this->giveDaraALineManager();
        $branchApprover = $this->approverOf($this->branchA, 'HR A');
        $id = $this->ask($this->staff, 'annual', '2026-10-08')->assertCreated()->json('id');

        $this->as($branchApprover)->postJson("/api/requests/{$id}/approve")->assertOk();

        $step = EmployeeRequest::query()->withoutGlobalScopes()->findOrFail($id)->approval->steps->sole();
        $this->assertSame('approved', $step->status);
        $this->assertSame($branchApprover->id, $step->acted_by_user_id);
    }

    public function test_without_a_line_manager_the_branch_approvers_decide_and_other_branches_cannot(): void
    {
        $approverA = $this->approverOf($this->branchA, 'HR A');
        $approverB = $this->approverOf($this->branchB, 'HR B');

        $id = $this->ask($this->staff, 'annual', '2026-10-08')->assertCreated()->assertJsonPath('waiting_on', null)->json('id');

        $this->assertCount(1, $this->alerts($approverA, 'request.leave_requested'));
        $this->assertCount(0, $this->alerts($approverB, 'request.leave_requested'));

        $this->as($approverB)->getJson('/api/requests?scope=approvals')->assertJsonCount(0, 'data');
        $this->as($approverB)->postJson("/api/requests/{$id}/approve")->assertNotFound();
        $this->as($approverA)->postJson("/api/requests/{$id}/approve")->assertOk();
    }

    public function test_nobody_decides_their_own_leave(): void
    {
        // A branch approver who is also staff asks for leave: someone else must decide.
        $approver = $this->approverOf($this->branchA, 'HR A');
        $employee = Employee::query()->withoutGlobalScopes()->create(['company_id' => $this->company->id, 'display_name' => 'HR A', 'user_id' => $approver->id, 'hire_date' => '2020-01-01']);
        EmployeeAssignment::query()->withoutGlobalScopes()->create(['company_id' => $this->company->id, 'employee_id' => $employee->id, 'branch_id' => $this->branchA->id, 'effective_from' => '2020-01-01']);
        $this->assignSchedule($employee, $this->schedule);

        $id = $this->ask($approver, 'annual', '2026-10-08')->assertCreated()->assertJsonPath('can.decide', false)->json('id');

        $this->as($approver)->getJson('/api/requests?scope=approvals')->assertJsonCount(0, 'data');
        $this->as($approver)->postJson("/api/requests/{$id}/approve")->assertForbidden();
        $this->assertCount(0, $this->alerts($approver, 'request.leave_requested'));
        // The company admin is told instead, and decides.
        $this->assertCount(1, $this->alerts($this->admin, 'request.leave_requested'));
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();
    }

    public function test_a_line_manager_asking_for_their_own_leave_goes_to_the_branch_approvers(): void
    {
        // Sokha manages Dara but has no manager himself: his own leave goes to the branch approvers.
        $sokha = $this->giveDaraALineManager();
        $id = $this->ask($sokha, 'annual', '2026-10-08')->assertCreated()->assertJsonPath('waiting_on', null)->json('id');

        $this->as($sokha)->postJson("/api/requests/{$id}/approve")->assertForbidden();
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();
    }

    public function test_reject_needs_a_reason_the_employee_can_read(): void
    {
        $id = $this->ask($this->staff, 'annual', '2026-10-08')->assertCreated()->json('id');

        $this->as($this->admin)->postJson("/api/requests/{$id}/reject")->assertStatus(422)->assertJsonValidationErrors('notes');
        $this->as($this->admin)->postJson("/api/requests/{$id}/reject", ['notes' => 'Stock count that week'])->assertOk()->assertJsonPath('status', 'rejected');

        $alert = $this->alerts($this->staff, 'request.leave_decided')->sole();
        $this->assertSame('❌ Leave rejected', $alert->title);
        $this->assertStringEndsWith('rejected by Boss. Remark: Stock count that week', $alert->body);
        $this->assertEquals(0, $this->balance($this->staff, 'annual')['pending']);
    }

    public function test_of_two_managers_deciding_at_once_only_one_counts(): void
    {
        $id = $this->ask($this->staff, 'annual', '2026-10-08')->assertCreated()->json('id');
        $stale = EmployeeRequest::query()->withoutGlobalScopes()->findOrFail($id);

        $this->as($this->admin)->postJson("/api/requests/{$id}/reject", ['notes' => 'No'])->assertOk();

        $this->expectException(ValidationException::class);
        try {
            app(EmployeeRequestService::class)->approve($this->admin, $stale);
        } finally {
            $this->assertSame('rejected', $stale->fresh()->status);
        }
    }

    public function test_hr_can_record_leave_for_staff_and_approve_it_at_once(): void
    {
        $this->as($this->admin)->postJson('/api/requests', [
            'employee_id' => $this->dara->id, 'leave_type_id' => $this->type('unpaid')->id,
            'start_date' => '2026-10-01', 'end_date' => '2026-10-01', 'approve' => true,
        ])->assertCreated()->assertJsonPath('status', 'approved');

        // Staff can't send requests for someone else.
        [$otherUser] = $this->person('Other', 'employee');
        $this->as($otherUser)->postJson('/api/requests', [
            'employee_id' => $this->dara->id, 'leave_type_id' => $this->type('unpaid')->id, 'start_date' => '2026-10-02', 'end_date' => '2026-10-02',
        ])->assertForbidden();
    }

    // ───────────────────────────── rules by type ─────────────────────────────

    public function test_sick_leave_needs_a_certificate_that_opens_only_through_its_signed_link(): void
    {
        Storage::fake('local');

        $this->ask($this->staff, 'sick', '2026-10-02')->assertStatus(422)->assertJsonValidationErrors('attachment');

        $created = $this->ask($this->staff, 'sick', '2026-10-02', null, [
            'attachment' => UploadedFile::fake()->create('certificate.pdf', 120, 'application/pdf'),
        ])->assertCreated();

        $url = $created->json('attachments.0.url');
        $this->assertSame('certificate.pdf', $created->json('attachments.0.name'));
        $this->get($url)->assertOk();
        $this->get(preg_replace('/signature=\w+/', 'signature=forged', $url))->assertForbidden();
    }

    public function test_maternity_leave_is_for_women_and_counts_every_calendar_day(): void
    {
        $this->ask($this->staff, 'maternity', '2026-10-05', '2026-10-18')->assertCreated()->assertJsonPath('days', 14);

        [$manUser] = $this->person('Vuthy', 'employee', ['gender' => 'male']);
        $this->ask($manUser, 'maternity', '2026-10-05', '2026-10-18')
            ->assertStatus(422)->assertJsonValidationErrors(['leave_type_id' => 'only for women']);

        [$unknownUser] = $this->person('Kim', 'employee');
        $this->ask($unknownUser, 'maternity', '2026-10-05')
            ->assertStatus(422)->assertJsonValidationErrors(['leave_type_id' => "Add Kim's gender"]);

        $this->ask($this->staff, 'maternity', '2026-11-01', '2027-02-28')
            ->assertStatus(422)->assertJsonValidationErrors(['end_date' => 'at most 90 days']);
    }

    public function test_overlapping_leave_is_refused_but_a_morning_and_an_afternoon_can_share_a_date(): void
    {
        $this->ask($this->staff, 'annual', '2026-10-08', '2026-10-09')->assertCreated();
        $this->ask($this->staff, 'unpaid', '2026-10-09')
            ->assertStatus(422)->assertJsonValidationErrors(['start_date' => 'Already Annual leave on Fri 9 Oct (pending).']);

        $this->ask($this->staff, 'annual', '2026-10-14', null, ['day_part' => 'am'])->assertCreated()->assertJsonPath('days', 0.5);
        $this->ask($this->staff, 'annual', '2026-10-14', null, ['day_part' => 'am'])->assertStatus(422);
        $this->ask($this->staff, 'unpaid', '2026-10-14', null, ['day_part' => 'pm'])->assertCreated();

        // A rejected request frees its dates again.
        $id = $this->ask($this->staff, 'unpaid', '2026-10-15')->assertCreated()->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/reject", ['notes' => 'No'])->assertOk();
        $this->ask($this->staff, 'unpaid', '2026-10-15')->assertCreated();
    }

    public function test_a_half_day_is_one_date_on_a_type_that_allows_it(): void
    {
        $this->ask($this->staff, 'annual', '2026-10-08', '2026-10-09', ['day_part' => 'am'])
            ->assertStatus(422)->assertJsonValidationErrors('day_part');
        $this->ask($this->staff, 'maternity', '2026-10-08', null, ['day_part' => 'am'])
            ->assertStatus(422)->assertJsonValidationErrors(['day_part' => 'whole days']);
    }

    // ───────────────────────────── attendance ─────────────────────────────

    public function test_leave_approved_afterwards_turns_a_past_absence_into_leave(): void
    {
        app(AttendanceRecorder::class)->recalculateRange($this->dara, '2026-10-01', '2026-10-01');
        $this->assertSame('absent', $this->attendanceDay($this->dara, '2026-10-01')->status);

        $id = $this->ask($this->staff, 'sick', '2026-10-01', null, ['attachment' => UploadedFile::fake()->create('note.pdf', 10, 'application/pdf')])->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        $this->assertNull($this->attendanceDay($this->dara, '2026-10-01'));
        $calendar = $this->as($this->staff)->getJson('/api/calendar?month=2026-10')->assertOk()->json();
        $day = collect($calendar['days'])->firstWhere('date', '2026-10-01');
        $this->assertSame('leave', $day['type']);
        $this->assertSame('Sick leave', $day['label']);
        $this->assertSame(['type' => 'Sick leave', 'part' => 'full'], $day['leave']);
        $this->assertNull($day['attendance']);
        $this->assertEquals(1, $calendar['summary']['leave_days']);

        // Cancelled again by HR: back to absent.
        $this->as($this->admin)->postJson("/api/requests/{$id}/cancel", ['reason' => 'Was at work after all'])->assertOk();
        $this->assertSame('absent', $this->attendanceDay($this->dara, '2026-10-01')->status);
    }

    public function test_a_morning_off_is_never_late_or_missing_and_only_the_afternoon_is_expected(): void
    {
        $id = $this->ask($this->staff, 'annual', '2026-10-01', null, ['day_part' => 'am'])->assertCreated()->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        $this->scan($this->dara, '2026-10-01 13:00');
        $this->scan($this->dara, '2026-10-01 17:00');
        app(AttendanceRecorder::class)->recalculateRange($this->dara, '2026-10-01', '2026-10-01');

        $day = $this->attendanceDay($this->dara, '2026-10-01');
        $this->assertSame('complete', $day->status);
        $this->assertSame(0, $day->late_minutes);
        $this->assertSame([], $day->exceptions);
        $this->assertSame(240, $day->scheduled_minutes);
        $this->assertSame(240, $day->worked_minutes);
        $this->assertStringContainsString('Annual leave (morning)', $day->label);
        $this->assertEquals(0.5, $this->balance($this->staff, 'annual')['used']);
    }

    public function test_a_single_shift_half_day_is_split_at_its_midpoint_without_the_break(): void
    {
        [$user, $employee] = $this->person('Rith', 'employee', ['hire_date' => '2020-01-01']);
        $single = $this->makeWorkSchedule($this->company, [['in', '08:00'], ['out', '17:00']], ['break_minutes' => 60], weekdays: [1, 2, 3, 4, 5]);
        \App\Models\EmployeeScheduleAssignment::query()->withoutGlobalScopes()->where('employee_id', $employee->id)->delete();
        $this->assignSchedule($employee, $single);

        $id = $this->ask($user, 'annual', '2026-10-01', null, ['day_part' => 'pm'])->assertCreated()->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        // Afternoon off: 08:00 – 12:30 expected, leaving at 12:30 is on time.
        $this->scan($employee, '2026-10-01 08:00');
        $this->scan($employee, '2026-10-01 12:30');
        app(AttendanceRecorder::class)->recalculateRange($employee, '2026-10-01', '2026-10-01');

        $day = $this->attendanceDay($employee, '2026-10-01');
        $this->assertSame('complete', $day->status);
        $this->assertSame(0, $day->early_leave_minutes);
        $this->assertSame(270, $day->scheduled_minutes);
    }

    public function test_payroll_summary_shows_paid_and_unpaid_leave(): void
    {
        foreach ([['annual', '2026-10-01', '2026-10-02'], ['unpaid', '2026-10-06', '2026-10-06']] as [$code, $start, $end]) {
            $id = $this->ask($this->staff, $code, $start, $end)->assertCreated()->json('id');
            $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();
        }
        $id = $this->ask($this->staff, 'annual', '2026-10-07', null, ['day_part' => 'pm'])->json('id');
        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")->assertOk();

        $row = collect($this->as($this->admin)->getJson('/api/attendance/summary?month=2026-10')->assertOk()->json('rows'))
            ->firstWhere('employee.id', $this->dara->id);

        $this->assertEquals(2.5, $row['paid_leave_days']);
        $this->assertEquals(1, $row['unpaid_leave_days']);
        $this->assertEquals(3.5, $row['leave_days']);
    }

    // ───────────────────────────── cancelling ─────────────────────────────

    public function test_staff_withdraw_a_waiting_request_or_approved_leave_that_has_not_started(): void
    {
        $sokha = $this->giveDaraALineManager();

        $waiting = $this->ask($this->staff, 'annual', '2026-10-08')->json('id');
        $this->as($this->staff)->postJson("/api/requests/{$waiting}/cancel")->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertNotNull($this->alerts($sokha, 'request.leave_requested')->sole()->resolved_at);
        $this->assertSame('🚫 Leave cancelled', $this->alerts($sokha, 'request.leave_cancelled')->sole()->title);

        $future = $this->ask($this->staff, 'annual', '2026-10-20')->json('id');
        $this->as($sokha)->postJson("/api/requests/{$future}/approve")->assertOk();
        $this->as($this->staff)->postJson("/api/requests/{$future}/cancel")->assertOk();
        $this->assertEquals(0, $this->balance($this->staff, 'annual')['used']);

        // Already started (or past): only an approver can cancel it.
        $past = $this->ask($this->staff, 'annual', '2026-10-01')->json('id');
        $this->as($sokha)->postJson("/api/requests/{$past}/approve")->assertOk();
        $this->as($this->staff)->getJson("/api/requests/{$past}")->assertJsonPath('can.cancel', false);
        $this->as($this->staff)->postJson("/api/requests/{$past}/cancel")
            ->assertStatus(422)->assertJsonValidationErrors(['status' => 'already started']);
        // A manager cancelling someone else's leave says why.
        $this->as($this->admin)->postJson("/api/requests/{$past}/cancel")->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->as($this->admin)->postJson("/api/requests/{$past}/cancel", ['reason' => 'Booked twice by mistake'])
            ->assertOk()->assertJsonPath('cancel_reason', 'Booked twice by mistake');
        $this->assertStringEndsWith('cancelled by Boss. Remark: Booked twice by mistake', $this->alerts($this->staff, 'request.leave_cancelled')->sole()->body);
    }

    public function test_a_locked_payroll_month_cannot_be_changed_by_leave(): void
    {
        $id = $this->ask($this->staff, 'annual', '2026-09-28')->assertCreated()->json('id');
        $this->as($this->admin)->postJson('/api/attendance/periods', ['month' => '2026-09', 'ignore_pending_overtime' => true])->assertSuccessful();

        $this->as($this->admin)->postJson("/api/requests/{$id}/approve")
            ->assertStatus(422)->assertJsonValidationErrors(['start_date' => 'September 2026 is locked']);
        $this->ask($this->staff, 'annual', '2026-09-29')
            ->assertStatus(422)->assertJsonValidationErrors(['start_date' => 'locked']);
    }

    // ───────────────────────────── privacy ─────────────────────────────

    public function test_staff_see_only_their_own_requests_and_other_companies_see_nothing(): void
    {
        $id = $this->ask($this->staff, 'annual', '2026-10-08')->json('id');
        [$colleague] = $this->person('Colleague', 'employee');

        $this->as($colleague)->getJson('/api/requests')->assertJsonCount(0, 'data');
        $this->as($colleague)->getJson("/api/requests/{$id}")->assertNotFound();
        $this->as($colleague)->postJson("/api/requests/{$id}/cancel")->assertNotFound();
        $this->as($colleague)->getJson('/api/requests?scope=all')->assertForbidden();
        $this->as($this->staff)->getJson('/api/requests')->assertJsonCount(1, 'data');

        $other = app(CompanyProvisioner::class)->provision('Other Co', 'Owner', 'owner@other.test', 'password123');
        Subscription::query()->create(['company_id' => $other->id, 'plan_id' => Plan::query()->where('code', 'starter')->firstOrFail()->id, 'status' => 'active']);
        $this->as($other->users()->first())->getJson("/api/requests/{$id}")->assertNotFound();
        $this->as($other->users()->first())->postJson("/api/requests/{$id}/approve")->assertNotFound();
    }
}
