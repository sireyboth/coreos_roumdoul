<?php

namespace Tests\Feature\Api;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Company;
use App\Models\CompanyPermission;
use App\Models\CompanyRole;
use App\Models\MembershipBranchAccess;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    private Branch $north;

    private Branch $south;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->admin = $this->company->users()->first();
        $this->north = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'North']);
        $this->south = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'South']);
        // Setting up the company is logged too; each test starts from an empty log.
        AuditLog::query()->delete();
    }

    /** A user whose role has exactly these permissions, optionally limited to some branches. */
    private function viewer(array $permissions, array $branches = []): User
    {
        $code = 'role-'.count(CompanyRole::all());
        $role = CompanyRole::query()->create(['company_id' => $this->company->id, 'name' => $code, 'code' => $code]);
        $role->permissions()->attach(CompanyPermission::query()->whereIn('code', $permissions)->pluck('id'));
        $user = $this->createUserWithRole($this->company, $code);

        foreach ($branches as $branch) {
            MembershipBranchAccess::query()->create(['company_membership_id' => $user->membership->id, 'branch_id' => $branch->id, 'created_at' => now()]);
        }

        return $user;
    }

    private function log(string $event, ?Branch $branch, ?Company $company = null): AuditLog
    {
        return AuditLog::query()->withoutCompanyScope()->create([
            'company_id' => ($company ?? $this->company)->id,
            'branch_id' => $branch?->id,
            'event' => $event,
            'subject_label' => $event,
        ]);
    }

    private function events(User $user, array $query = []): array
    {
        return collect($this->actingAs($user)->getJson('/api/audit-logs?'.http_build_query($query))->assertOk()->json('data'))
            ->pluck('event')->all();
    }

    public function test_a_change_records_who_what_when_and_where(): void
    {
        $id = $this->actingAs($this->admin)
            ->withHeader('User-Agent', 'Mozilla/5.0 (iPhone)')
            ->postJson('/api/employees', ['name' => 'Alice', 'branch_id' => $this->north->id])
            ->assertCreated()->json('id');

        $row = collect($this->actingAs($this->admin)->getJson('/api/audit-logs')->assertOk()->json('data'))
            ->firstWhere('event', 'employee.created');

        $this->assertSame(['type' => 'user', 'id' => $this->admin->id, 'name' => $this->admin->name], $row['actor']);
        $this->assertSame(['type' => 'Employee', 'id' => $id, 'label' => 'Alice'], $row['subject']);
        // The employee's branch is set after the employee row, in the same transaction.
        $this->assertSame(['id' => $this->north->id, 'name' => 'North'], $row['branch']);
        $this->assertSame('people', $row['module']);
        $this->assertSame('POST', $row['method']);
        $this->assertSame('/api/employees', $row['path']);
        $this->assertSame('Mozilla/5.0 (iPhone)', $row['user_agent']);
        $this->assertNotNull($row['created_at']);
    }

    public function test_a_deleted_employee_keeps_their_branch_and_name_in_the_log(): void
    {
        $id = $this->actingAs($this->admin)->postJson('/api/employees', ['name' => 'Bob', 'branch_id' => $this->south->id])->json('id');
        $this->actingAs($this->admin)->deleteJson("/api/employees/{$id}")->assertSuccessful();

        $log = AuditLog::query()->where('event', 'employee.deleted')->firstOrFail();

        $this->assertSame($this->south->id, $log->branch_id);
        $this->assertSame('Bob', $log->subject_label);
    }

    public function test_another_companys_activity_is_never_shown(): void
    {
        $other = app(CompanyProvisioner::class)->provision('Other', 'Them', 'them@other.test', 'password123');
        $this->log('ours.updated', $this->north);
        $this->log('theirs.updated', null, $other);

        $this->assertContains('ours.updated', $this->events($this->admin));
        $this->assertNotContains('theirs.updated', $this->events($this->admin));
    }

    public function test_a_viewer_limited_to_one_branch_sees_only_that_branch(): void
    {
        $this->log('north.updated', $this->north);
        $this->log('south.updated', $this->south);
        $this->log('role.updated', null);

        $limited = $this->viewer(['audit.view'], [$this->north]);
        $this->assertSame(['north.updated'], $this->events($limited));
        // Asking for another branch directly doesn't get around it.
        $this->assertSame([], $this->events($limited, ['branch_id' => $this->south->id]));
        $this->assertSame(['North'], collect($this->actingAs($limited)->getJson('/api/audit-logs/options')->json('branches'))->pluck('name')->all());

        // Someone with every branch also sees the company-wide rows.
        $this->assertEqualsCanonicalizing(['north.updated', 'south.updated', 'role.updated'], $this->events($this->viewer(['audit.view'])));
    }

    public function test_pay_activity_needs_the_pay_permission(): void
    {
        $this->log('employee_salary.created', $this->north);
        $this->log('pay_run.approved', null);
        $this->log('employee.updated', $this->north);

        $this->assertSame(['employee.updated'], $this->events($this->viewer(['audit.view'])));
        $this->assertEqualsCanonicalizing(['employee_salary.created', 'employee.updated'], $this->events($this->viewer(['audit.view', 'salary.view'])));
        $this->assertCount(3, $this->events($this->viewer(['audit.view', 'salary.view', 'payroll.view'])));
    }

    public function test_secrets_are_never_sent(): void
    {
        AuditLog::query()->create(['company_id' => $this->company->id, 'event' => 'user.updated', 'after_data' => ['name' => 'X', 'password' => 'hash', 'remember_token' => 'abc']]);

        $after = $this->actingAs($this->admin)->getJson('/api/audit-logs')->json('data.0.after');

        $this->assertSame(['name' => 'X'], $after);
    }

    public function test_filters_narrow_the_list(): void
    {
        $this->log('employee.created', $this->north);
        $this->log('employee.deleted', $this->south);
        $this->log('role.created', null);

        $this->assertEqualsCanonicalizing(['employee.created', 'employee.deleted'], $this->events($this->admin, ['module' => 'people']));
        $this->assertEqualsCanonicalizing(['employee.created', 'role.created'], $this->events($this->admin, ['action' => 'created']));
        $this->assertSame(['employee.deleted'], $this->events($this->admin, ['branch_id' => $this->south->id]));
        $this->assertSame([], $this->events($this->admin, ['from' => now()->addDays(2)->toDateString()]));
    }

    public function test_reading_the_log_needs_its_own_permission(): void
    {
        $this->actingAs($this->createUserWithRole($this->company, 'manager'))->getJson('/api/audit-logs')->assertForbidden();
        $this->actingAs($this->admin)->getJson('/api/audit-logs')->assertOk();
    }
}
