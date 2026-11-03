<?php

namespace Tests\Feature\Api\Organization;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\User;
use App\Services\Company\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * Someone who manages employees can set a new password for an employee who
 * forgot theirs — but never their own here, and never a company admin's
 * unless they are a company admin themselves.
 */
class EmployeePasswordResetTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->admin = $this->company->users()->first();
        $this->branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function employeeWithLogin(): Employee
    {
        $id = $this->as($this->admin)->postJson('/api/employees', [
            'name' => 'Sokha', 'branch_id' => $this->branch->id, 'email' => 'sokha@acme.test', 'password' => 'old-pass-123',
        ])->assertCreated()->json('id');

        return Employee::query()->findOrFail($id);
    }

    private function reset(Employee $employee, string $password = 'new-pass-123', ?string $confirmation = null)
    {
        return $this->putJson("/api/employees/{$employee->id}/password", [
            'password' => $password, 'password_confirmation' => $confirmation ?? $password,
        ]);
    }

    public function test_an_admin_sets_a_new_password_and_the_employee_is_signed_out_everywhere(): void
    {
        $employee = $this->employeeWithLogin();
        $user = $employee->user;
        $user->createToken('phone');

        $this->as($this->admin);
        $this->reset($employee)->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-pass-123', $user->password));
        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseHas('audit_logs', ['event' => 'user.password_reset', 'subject_id' => $user->id]);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/login', ['email' => 'sokha@acme.test', 'password' => 'new-pass-123'])->assertOk();
    }

    public function test_the_password_must_be_confirmed_and_long_enough(): void
    {
        $employee = $this->employeeWithLogin();

        $this->as($this->admin);
        $this->reset($employee, 'short')->assertStatus(422)->assertJsonValidationErrors('password');
        $this->reset($employee, 'new-pass-123', 'different-123')->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_an_employee_without_a_login_cannot_be_reset(): void
    {
        $id = $this->as($this->admin)->postJson('/api/employees', ['name' => 'No Login', 'branch_id' => $this->branch->id])->json('id');

        $this->reset(Employee::query()->findOrFail($id))->assertStatus(422)->assertJsonValidationErrors('employee');
    }

    public function test_staff_without_employees_manage_cannot_reset_passwords(): void
    {
        $employee = $this->employeeWithLogin();
        $staff = $this->createUserWithRole($this->company, 'employee');

        $this->as($staff);
        $this->reset($employee)->assertForbidden();
    }

    public function test_your_own_password_is_changed_from_the_profile_not_here(): void
    {
        $self = Employee::query()->create(['company_id' => $this->company->id, 'branch_id' => $this->branch->id, 'name' => 'Boss', 'user_id' => $this->admin->id]);

        $this->as($this->admin);
        $this->reset($self)->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_a_manager_cannot_reset_a_company_admins_password(): void
    {
        $owner = Employee::query()->create(['company_id' => $this->company->id, 'branch_id' => $this->branch->id, 'name' => 'Boss', 'user_id' => $this->admin->id]);
        $manager = $this->createUserWithRole($this->company, 'manager');

        if (! $manager->hasCompanyPermission('employees.manage')) {
            $this->markTestSkipped('The built-in manager role cannot manage employees.');
        }

        $this->as($manager);
        $this->reset($owner)->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertTrue(Hash::check('password123', $this->admin->fresh()->password));
    }

    public function test_another_companys_employee_is_not_found(): void
    {
        $employee = $this->employeeWithLogin();
        $other = app(CompanyProvisioner::class)->provision('Other', 'Them', 'them@other.test', 'password123');

        $this->as($other->users()->first());
        $this->reset($employee)->assertNotFound();
    }
}
