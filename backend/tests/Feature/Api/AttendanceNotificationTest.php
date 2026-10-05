<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceEvent;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\MembershipBranchAccess;
use App\Models\Notification;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\AttendanceService;
use App\Services\CompanyProvisioner;
use App\Services\NotificationService;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * In-app alerts around correction requests: who is told when one is made,
 * who is told the decision, and that the other managers' alerts close.
 */
class AttendanceNotificationTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private User $admin;

    private User $staff;

    private Employee $employee;

    private Branch $branchA;

    private Branch $branchB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Alert Co', 'Boss', 'boss@alert.test', 'password123');
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $this->admin = $this->company->users()->first();
        $this->branchA = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Branch A']);
        $this->branchB = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Branch B']);

        $this->staff = $this->createUserWithRole($this->company, 'employee');
        $this->employee = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Dara', 'user_id' => $this->staff->id]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $this->employee->id, 'branch_id' => $this->branchA->id, 'effective_from' => '2020-01-01',
        ]);
    }

    private function managerOf(?Branch $branch, array $attributes = []): User
    {
        $manager = $this->createUserWithRole($this->company, 'manager', $attributes);
        if ($branch) {
            MembershipBranchAccess::query()->create(['company_membership_id' => $manager->membership->id, 'branch_id' => $branch->id, 'created_at' => now()]);
        }

        return $manager;
    }

    private function requestCorrection(): AttendanceCorrection
    {
        $id = $this->actingAs($this->staff)->postJson('/api/attendance/corrections', [
            'date' => '2026-09-21',
            'reason' => 'Forgot to scan out',
            'scans' => ['2026-09-21T17:00'],
        ])->assertCreated()->json('id');

        return AttendanceCorrection::query()->withoutGlobalScopes()->findOrFail($id);
    }

    /** Attendance alerts only — the company owner also has a welcome notification from sign-up. */
    private function alertsFor(User $user, ?string $type = null)
    {
        return Notification::query()->withoutGlobalScopes()
            ->where('recipient_user_id', $user->id)
            ->where('notification_type', 'like', 'attendance.%')
            ->when($type, fn ($q) => $q->where('notification_type', $type))
            ->get();
    }

    public function test_a_manager_limited_to_another_branch_cannot_see_or_decide_the_request(): void
    {
        $otherBranch = $this->managerOf($this->branchB);
        $sameBranch = $this->managerOf($this->branchA);
        $correction = $this->requestCorrection();

        $this->actingAs($otherBranch)->getJson('/api/attendance/corrections')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($otherBranch)->postJson("/api/attendance/corrections/{$correction->id}/approve")->assertNotFound();
        $this->actingAs($otherBranch)->postJson("/api/attendance/corrections/{$correction->id}/reject")->assertNotFound();
        $this->assertSame('pending', $correction->fresh()->status);

        $this->actingAs($sameBranch)->getJson('/api/attendance/corrections')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($sameBranch)->postJson("/api/attendance/corrections/{$correction->id}/approve")->assertOk();

        // The decision is still in the audit log, with who made it.
        $audit = AuditLog::query()->withoutGlobalScopes()->where('event', 'attendance_correction.updated')->where('subject_id', $correction->id)->sole();
        $this->assertSame('approved', $audit->after_data['status']);
        $this->assertSame('pending', $audit->before_data['status']);
        $this->assertSame($sameBranch->id, $audit->after_data['reviewed_by']);
    }

    public function test_a_request_decided_meanwhile_is_never_applied_twice(): void
    {
        $correction = $this->requestCorrection();
        // Another manager approved it a moment ago; this copy was loaded before that.
        $stale = AttendanceCorrection::query()->withoutGlobalScopes()->findOrFail($correction->id);
        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$correction->id}/approve")->assertOk();

        $this->expectException(ValidationException::class);
        try {
            app(AttendanceService::class)->approveCorrection($stale, $this->admin->id);
        } finally {
            $this->assertSame(1, AttendanceEvent::query()->withoutGlobalScopes()->where('method', 'correction')->count());
        }
    }

    public function test_a_correction_request_alerts_the_managers_who_can_decide_it(): void
    {
        $sameBranch = $this->managerOf($this->branchA);
        $otherBranch = $this->managerOf($this->branchB);
        $inactive = $this->managerOf(null, ['is_active' => false]);

        $correction = $this->requestCorrection();

        $alert = $this->alertsFor($this->admin)->sole();
        $this->assertSame('attendance.correction_requested', $alert->notification_type);
        $this->assertSame('Correction request from Dara', $alert->title);
        $this->assertSame('Mon 21 Sep: add 17:00 — Forgot to scan out', $alert->body);
        $this->assertSame($this->staff->id, $alert->actor_user_id);
        $this->assertSame($correction->id, $alert->subject_id);
        $this->assertSame('/dashboard/attendance?tab=corrections', $alert->link);

        $this->assertCount(1, $this->alertsFor($sameBranch));
        $this->assertCount(0, $this->alertsFor($otherBranch), 'a manager limited to another branch is not told');
        $this->assertCount(0, $this->alertsFor($inactive), 'an inactive account is not told');
        $this->assertCount(0, $this->alertsFor($this->staff), 'the requester is not told about their own request');
    }

    public function test_approving_tells_the_requester_and_closes_the_other_managers_alerts(): void
    {
        $manager = $this->managerOf(null);
        $correction = $this->requestCorrection();

        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$correction->id}/approve", ['review_notes' => 'OK this time'])->assertOk();

        $decision = $this->alertsFor($this->staff, 'attendance.correction_decided')->sole();
        $this->assertSame('✅ Correction approved', $decision->title);
        $this->assertSame('Your correction for Mon 21 Sep was approved by Boss. Remark: OK this time', $decision->body);
        $this->assertSame($this->admin->id, $decision->actor_user_id);

        $other = $this->alertsFor($manager)->sole();
        $this->assertNotNull($other->resolved_at);
        $this->assertSame('approved', $other->resolution);
        $this->assertSame($this->admin->id, $other->resolved_by_user_id);

        $this->actingAs($manager)->getJson('/api/notifications')
            ->assertJsonPath('0.resolution', 'approved')
            ->assertJsonPath('0.resolved_by', 'Boss');
    }

    public function test_rejecting_tells_the_requester(): void
    {
        $correction = $this->requestCorrection();

        // A "no" always says why.
        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$correction->id}/reject")
            ->assertStatus(422)->assertJsonValidationErrors('review_notes');
        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$correction->id}/reject", ['review_notes' => 'The camera shows you left at 16:00'])
            ->assertOk()->assertJsonPath('review_notes', 'The camera shows you left at 16:00');

        $decision = $this->alertsFor($this->staff, 'attendance.correction_decided')->sole();
        $this->assertSame('❌ Correction rejected', $decision->title);
        $this->assertSame('Your correction for Mon 21 Sep was rejected by Boss. Remark: The camera shows you left at 16:00', $decision->body);
    }

    public function test_a_waiting_correction_can_be_cancelled_by_the_employee_or_by_a_manager_with_a_remark(): void
    {
        // The employee withdraws their own: no remark needed, the managers' alert closes.
        $mine = $this->requestCorrection();
        $this->actingAs($this->staff)->postJson("/api/attendance/corrections/{$mine->id}/cancel")->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertNotNull($this->alertsFor($this->admin, 'attendance.correction_requested')->sole()->resolved_at);
        $this->assertCount(0, $this->alertsFor($this->staff, 'attendance.correction_cancelled'));

        // A manager cancels one: the remark is required and reaches the employee.
        $other = AttendanceCorrection::query()->withoutGlobalScopes()->findOrFail(
            $this->actingAs($this->staff)->postJson('/api/attendance/corrections', ['date' => '2026-09-22', 'reason' => 'Forgot', 'scans' => ['2026-09-22T17:00']])->json('id')
        );
        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$other->id}/cancel")
            ->assertStatus(422)->assertJsonValidationErrors('review_notes');
        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$other->id}/cancel", ['review_notes' => 'Sent twice — keeping the other one'])
            ->assertOk()->assertJsonPath('reviewed_by.name', 'Boss');
        $this->assertSame(
            'Your correction for Tue 22 Sep was cancelled by Boss. Remark: Sent twice — keeping the other one',
            $this->alertsFor($this->staff, 'attendance.correction_cancelled')->sole()->body,
        );

        // Approved ones are final, and a colleague can't touch someone else's.
        $approved = $this->requestCorrection();
        $this->actingAs($this->admin)->postJson("/api/attendance/corrections/{$approved->id}/approve")->assertOk();
        $this->actingAs($this->staff)->postJson("/api/attendance/corrections/{$approved->id}/cancel")
            ->assertStatus(422)->assertJsonValidationErrors(['status' => 'already approved']);
        $colleague = $this->createUserWithRole($this->company, 'employee');
        $this->actingAs($colleague)->postJson("/api/attendance/corrections/{$other->id}/cancel")->assertNotFound();
    }

    public function test_the_same_event_never_alerts_twice(): void
    {
        $correction = $this->requestCorrection();
        $key = "attendance.correction_requested:{$correction->getMorphClass()}:{$correction->id}:{$this->admin->id}";

        NotificationService::send($this->admin, 'attendance.correction_requested', 'Again', dedupeKey: $key);

        $this->assertCount(1, $this->alertsFor($this->admin));
    }

    public function test_unread_count_and_marking_one_read(): void
    {
        $this->actingAs($this->admin)->postJson('/api/notifications/read-all')->assertNoContent(); // the welcome note
        $this->requestCorrection();

        $response = $this->actingAs($this->admin)->getJson('/api/notifications/unread-count')->assertJsonPath('count', 1);
        $this->actingAs($this->admin)->postJson('/api/notifications/'.$response->json('latest_id').'/read')->assertNoContent();

        $this->actingAs($this->admin)->getJson('/api/notifications/unread-count')->assertJsonPath('count', 0);
    }

    public function test_nobody_can_read_or_mark_someone_elses_alert(): void
    {
        $this->requestCorrection();
        $alert = $this->alertsFor($this->admin)->sole();

        $this->actingAs($this->staff)->getJson('/api/notifications')->assertJsonCount(0);
        $this->actingAs($this->staff)->postJson("/api/notifications/{$alert->id}/read")->assertNotFound();
        $this->assertNull($alert->fresh()->read_at);
    }

    public function test_old_read_alerts_are_pruned_but_unread_ones_are_kept(): void
    {
        $this->requestCorrection();
        $manager = $this->managerOf(null);
        $read = $this->alertsFor($this->admin)->sole();
        $read->update(['read_at' => now()->subDays(100), 'created_at' => now()->subDays(100)]);
        $unread = NotificationService::send($manager, 'test', 'Old but unread');
        $unread->update(['created_at' => now()->subDays(100)]);

        $this->artisan('model:prune', ['--model' => [Notification::class]])->assertSuccessful();

        $this->assertNull(Notification::query()->withoutGlobalScopes()->find($read->id));
        $this->assertNotNull(Notification::query()->withoutGlobalScopes()->find($unread->id));
    }
}
