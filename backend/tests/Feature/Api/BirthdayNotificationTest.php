<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Company;
use App\Models\CompanyModuleEntitlement;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\Module;
use App\Models\Notification;
use App\Models\User;
use App\Services\BirthdayNotifier;
use App\Services\CompanyProvisioner;
use Carbon\CarbonImmutable;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * Birthday alerts: the birthday person and their branch are told, from 8:00
 * local time, once — and only when the company has the birthdays module.
 */
class BirthdayNotificationTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private Branch $branchA;

    private Branch $branchB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Party Co', 'Boss', 'boss@party.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh']);
        $this->enableModule();

        $this->branchA = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Branch A']);
        $this->branchB = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Branch B']);
    }

    private function enableModule(bool $enabled = true): void
    {
        CompanyModuleEntitlement::query()->updateOrCreate(
            ['company_id' => $this->company->id, 'module_id' => Module::query()->where('code', 'birthdays')->value('id')],
            ['is_enabled' => $enabled],
        );
    }

    /** @return array{0: Employee, 1: User|null} */
    private function employee(string $name, ?Branch $branch, ?string $dateOfBirth = null, bool $login = true, string $status = 'active'): array
    {
        $user = $login ? $this->createUserWithRole($this->company, 'employee') : null;
        $employee = Employee::query()->create([
            'company_id' => $this->company->id,
            'name' => $name,
            'user_id' => $user?->id,
            'date_of_birth' => $dateOfBirth,
            'employment_status' => $status,
        ]);

        if ($branch) {
            EmployeeAssignment::query()->withoutGlobalScopes()->create([
                'company_id' => $this->company->id, 'employee_id' => $employee->id, 'branch_id' => $branch->id, 'effective_from' => '2020-01-01',
            ]);
        }

        return [$employee, $user];
    }

    private function notifyAt(string $localTime): int
    {
        return app(BirthdayNotifier::class)->run($this->company->fresh(), CarbonImmutable::parse($localTime, 'Asia/Phnom_Penh'));
    }

    private function birthdayAlerts(User $user)
    {
        return Notification::query()->withoutGlobalScopes()->where('recipient_user_id', $user->id)->where('notification_type', 'birthday')->get();
    }

    public function test_birthday_person_and_their_branch_are_told(): void
    {
        [$dara, $daraUser] = $this->employee('Dara', $this->branchA, '1995-10-10');
        [, $sameBranch] = $this->employee('Sok', $this->branchA);
        [, $otherBranch] = $this->employee('Vanna', $this->branchB);

        $this->assertSame(2, $this->notifyAt('2026-10-10 08:05'));

        $own = $this->birthdayAlerts($daraUser)->sole();
        $this->assertSame('🎂 Happy birthday, Dara!', $own->title);
        $this->assertTrue($own->data['is_self']);
        $this->assertSame("/dashboard?birthday={$dara->id}", $own->link);

        $colleague = $this->birthdayAlerts($sameBranch)->sole();
        $this->assertSame("🎉 It's Dara's birthday today", $colleague->title);
        $this->assertFalse($colleague->data['is_self']);

        $this->assertCount(0, $this->birthdayAlerts($otherBranch));
    }

    public function test_sent_once_and_not_before_eight_local_time(): void
    {
        [, $daraUser] = $this->employee('Dara', $this->branchA, '1995-10-10');

        $this->assertSame(0, $this->notifyAt('2026-10-10 07:59'));
        $this->assertSame(1, $this->notifyAt('2026-10-10 08:00'));
        $this->notifyAt('2026-10-10 09:00');
        $this->notifyAt('2026-10-10 15:00');

        $this->assertCount(1, $this->birthdayAlerts($daraUser));
    }

    public function test_nothing_is_sent_without_the_module(): void
    {
        $this->enableModule(false);
        [, $daraUser] = $this->employee('Dara', $this->branchA, '1995-10-10');

        $this->assertSame(0, $this->notifyAt('2026-10-10 09:00'));
        $this->assertCount(0, $this->birthdayAlerts($daraUser));
    }

    public function test_people_who_left_are_neither_celebrated_nor_told(): void
    {
        [, $leftUser] = $this->employee('Former', $this->branchA, '1995-10-10', status: 'resigned');
        [, $colleague] = $this->employee('Sok', $this->branchA, status: 'resigned');
        [, $current] = $this->employee('Dara', $this->branchA);

        $this->assertSame(0, $this->notifyAt('2026-10-10 09:00'));
        $this->assertCount(0, $this->birthdayAlerts($leftUser));
        $this->assertCount(0, $this->birthdayAlerts($colleague));
        $this->assertCount(0, $this->birthdayAlerts($current));
    }

    public function test_leap_day_birthdays_fall_on_feb_28_in_other_years(): void
    {
        [, $user] = $this->employee('Leap', $this->branchA, '2000-02-29');

        $this->assertSame(1, $this->notifyAt('2027-02-28 09:00'));
        $this->assertSame(0, $this->notifyAt('2028-02-28 09:00'));
        $this->assertSame(1, $this->notifyAt('2028-02-29 09:00'));
        $this->assertCount(2, $this->birthdayAlerts($user));
    }

    public function test_colleagues_are_told_even_when_birthday_person_has_no_login(): void
    {
        $this->employee('Dara', $this->branchA, '1995-10-10', login: false);
        [, $colleague] = $this->employee('Sok', $this->branchA);

        $this->assertSame(1, $this->notifyAt('2026-10-10 09:00'));
        $this->assertCount(1, $this->birthdayAlerts($colleague));
    }

    public function test_command_runs(): void
    {
        $this->artisan('birthdays:notify')->assertSuccessful();
    }
}
