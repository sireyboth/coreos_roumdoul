<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class EmployeeIdentityAndPayrollTest extends TestCase
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

    private function employee(array $attributes = []): Employee
    {
        $id = $this->actingAs($this->admin)
            ->postJson('/api/employees', ['name' => 'Sok Dara', 'branch_id' => $this->branch->id, ...$attributes])
            ->assertCreated()
            ->json('id');

        return Employee::query()->findOrFail($id);
    }

    public function test_the_new_fields_are_saved_and_returned_to_an_admin(): void
    {
        $employee = $this->employee([
            'first_name' => 'Dara', 'last_name' => 'Sok', 'name_km' => 'សុខ ដារ៉ា',
            'nationality' => 'Cambodian', 'national_id_number' => '010203040', 'passport_number' => 'N1234567',
            'nssf_number' => 'NSSF-889', 'tax_id' => 'K001-123', 'bank_name' => 'ABA', 'bank_account_number' => '000 111 222',
            'base_salary' => 650, 'salary_currency' => 'USD',
        ]);

        $this->actingAs($this->admin)->getJson("/api/employees/{$employee->id}")
            ->assertOk()
            ->assertJsonPath('name_km', 'សុខ ដារ៉ា')
            ->assertJsonPath('first_name', 'Dara')
            ->assertJsonPath('national_id_number', '010203040')
            ->assertJsonPath('bank_name', 'ABA')
            ->assertJsonPath('base_salary', '650.00')
            ->assertJsonPath('salary_currency', 'USD');
    }

    public function test_first_and_last_name_are_enough_to_create_an_employee(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/employees', ['first_name' => 'Vy', 'last_name' => 'Chan', 'branch_id' => $this->branch->id])
            ->assertCreated()
            ->assertJsonPath('name', 'Vy Chan');

        $this->actingAs($this->admin)
            ->postJson('/api/employees', ['branch_id' => $this->branch->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_documents_and_bank_details_are_hidden_from_people_who_cant_manage_employees(): void
    {
        $employee = $this->employee(['name_km' => 'សុខ', 'national_id_number' => '010203040', 'bank_account_number' => '123', 'base_salary' => 500, 'salary_currency' => 'USD']);
        $staff = $this->createUserWithRole($this->company, 'employee');

        $json = $this->actingAs($staff)->getJson("/api/employees/{$employee->id}")->assertOk()->json();

        $this->assertSame('សុខ', $json['name_km']); // the Khmer name isn't private
        $this->assertArrayNotHasKey('national_id_number', $json);
        $this->assertArrayNotHasKey('bank_account_number', $json);
        $this->assertArrayNotHasKey('base_salary', $json);
    }

    public function test_salary_is_hidden_from_a_manager_without_the_salary_permission(): void
    {
        $employee = $this->employee(['national_id_number' => '010203040', 'base_salary' => 500, 'salary_currency' => 'USD']);
        $manager = $this->createUserWithRole($this->company, 'manager');

        $json = $this->actingAs($manager)->getJson("/api/employees/{$employee->id}")->assertOk()->json();

        $this->assertSame('010203040', $json['national_id_number']); // they manage employees, so they see documents
        $this->assertArrayNotHasKey('base_salary', $json);
        $this->assertArrayNotHasKey('salary_currency', $json);

        // Nor does it leak through the list, or rows that nest an employee.
        $listed = collect($this->actingAs($manager)->getJson('/api/employees')->json('data'))->firstWhere('id', $employee->id);
        $this->assertArrayNotHasKey('base_salary', $listed);
    }

    public function test_a_manager_without_the_salary_permission_cannot_set_pay_but_can_still_edit_the_rest(): void
    {
        $employee = $this->employee(['base_salary' => 500, 'salary_currency' => 'USD']);
        $manager = $this->createUserWithRole($this->company, 'manager');

        $this->actingAs($manager)
            ->putJson("/api/employees/{$employee->id}", ['base_salary' => 9000, 'salary_currency' => 'USD'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('base_salary');

        $this->actingAs($manager)
            ->postJson('/api/employees', ['name' => 'New', 'branch_id' => $this->branch->id, 'base_salary' => 100, 'salary_currency' => 'USD'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('base_salary');

        $this->actingAs($manager)
            ->putJson("/api/employees/{$employee->id}", ['phone' => '012 345 678', 'nssf_number' => 'NSSF-1'])
            ->assertOk();

        $this->assertSame('500.00', $employee->fresh()->base_salary);
    }

    public function test_a_salary_needs_a_currency_from_the_allowed_list(): void
    {
        $employee = $this->employee();

        $this->actingAs($this->admin)
            ->putJson("/api/employees/{$employee->id}", ['base_salary' => 1000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('salary_currency');

        $this->actingAs($this->admin)
            ->putJson("/api/employees/{$employee->id}", ['base_salary' => 1000, 'salary_currency' => 'EUR'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('salary_currency');

        $this->actingAs($this->admin)
            ->putJson("/api/employees/{$employee->id}", ['base_salary' => 2500000, 'salary_currency' => 'KHR'])
            ->assertOk()
            ->assertJsonPath('base_salary', '2500000.00');
    }

    public function test_the_salary_permission_appears_in_the_role_editor(): void
    {
        $groups = collect($this->actingAs($this->admin)->getJson('/api/permissions')->assertOk()->json());

        $this->assertSame(['salary.view', 'salary.manage'], $groups->firstWhere('resource', 'salary')['permissions']);
    }
}
