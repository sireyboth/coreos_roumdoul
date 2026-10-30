<?php

namespace Tests\Feature\Api\Account;

use App\Models\Branch;
use App\Models\Employee;
use App\Services\Company\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/** An employee's nickname: HR sets it, and the employee can change their own. */
class NicknameTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    public function test_hr_and_the_employee_themselves_can_set_the_nickname(): void
    {
        $this->seed(PermissionSeeder::class);
        $company = app(CompanyProvisioner::class)->provision('Nick Co', 'Boss', 'boss@nick.test', 'password123');
        $admin = $company->users()->first();
        $branch = Branch::query()->create(['company_id' => $company->id, 'name' => 'HQ']);

        $staff = $this->createUserWithRole($company, 'employee', ['name' => 'Sreyna Moeun']);
        $own = Employee::query()->create(['company_id' => $company->id, 'branch_id' => $branch->id, 'name' => 'Sreyna Moeun', 'user_id' => $staff->id]);

        // HR sets it from the employee form, and the employee page shows it.
        $this->actingAs($admin)->putJson("/api/employees/{$own->id}", ['name' => 'Sreyna Moeun', 'nickname' => 'Kim'])->assertOk();
        $this->actingAs($admin)->getJson("/api/employees/{$own->id}")->assertJsonPath('nickname', 'Kim');

        // The employee changes their own from the profile, without HR permission.
        $this->app['auth']->forgetGuards();
        $this->actingAs($staff)->putJson('/api/v1/profile', ['name' => 'Sreyna Moeun', 'email' => $staff->email, 'nickname' => ' Kimmy '])
            ->assertOk()->assertJsonPath('nickname', 'Kimmy');
        $this->actingAs($staff)->getJson('/api/me')->assertJsonPath('employee.nickname', 'Kimmy');

        // An older app that doesn't send nickname leaves it alone; an empty one clears it.
        $this->actingAs($staff)->putJson('/api/profile', ['name' => 'Sreyna Moeun', 'email' => $staff->email])->assertOk();
        $this->assertSame('Kimmy', $own->fresh()->nickname);
        $this->actingAs($staff)->putJson('/api/profile', ['name' => 'Sreyna Moeun', 'email' => $staff->email, 'nickname' => ''])->assertOk();
        $this->assertNull($own->fresh()->nickname);

        $this->actingAs($staff)->putJson('/api/profile', ['name' => 'Sreyna Moeun', 'email' => $staff->email, 'nickname' => str_repeat('x', 101)])
            ->assertStatus(422)->assertJsonValidationErrors('nickname');
    }
}
