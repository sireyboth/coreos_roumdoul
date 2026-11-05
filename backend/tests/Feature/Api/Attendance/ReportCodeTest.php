<?php

namespace Tests\Feature\Api\Attendance;

use App\Models\Company;
use App\Models\LeaveType;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Company\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/** Each company sets how every status looks, in one place; the meaning never changes. */
class ReportCodeTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = $this->company('Acme', 'boss@acme.test');
        $this->admin = $this->company->users()->first();
    }

    private function company(string $name, string $email): Company
    {
        $company = app(CompanyProvisioner::class)->provision($name, 'Boss', $email, 'password123');
        Subscription::query()->create([
            'company_id' => $company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);

        return $company;
    }

    private function type(string $code): LeaveType
    {
        return LeaveType::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->where('code', $code)->firstOrFail();
    }

    /** The current day statuses with some changed (+ optional leave changes by type id). */
    private function page(array $statuses, array $leave = []): array
    {
        $current = $this->actingAs($this->admin)->getJson('/api/attendance/report-codes')->json('statuses');

        return ['statuses' => array_replace_recursive($current, $statuses), 'leave' => $leave];
    }

    private function save(array $statuses, array $leave = [])
    {
        $page = $this->page($statuses, $leave);

        return $this->actingAs($this->admin)->putJson('/api/attendance/report-codes', $page);
    }

    public function test_day_statuses_and_leave_types_are_set_in_one_place_and_reset(): void
    {
        $this->actingAs($this->admin)->getJson('/api/v1/attendance/report-codes')
            ->assertOk()
            ->assertJsonPath('statuses.L', ['code' => 'L', 'color' => 'amber', 'text' => 'auto', 'bold' => true])
            ->assertJsonPath('leave.0.report_code', 'AL')
            ->assertJsonPath('leave.0.text', 'auto');

        $annual = $this->type('annual');
        // Typed in any case, kept upper case; Khmer works too; text colour and bold go with it.
        $this->save(
            ['L' => ['code' => 'lt', 'color' => 'red', 'text' => 'white', 'bold' => false], 'A' => ['code' => 'អ']],
            [$annual->id => ['code' => 'an', 'color' => 'teal', 'text' => 'dark', 'bold' => false]],
        )
            ->assertOk()
            ->assertJsonPath('statuses.L', ['code' => 'LT', 'color' => 'red', 'text' => 'white', 'bold' => false])
            ->assertJsonPath('statuses.A.code', 'អ')
            ->assertJsonPath('leave.0', fn (array $l) => [$l['report_code'], $l['color'], $l['text'], $l['bold']] === ['AN', 'teal', 'dark', false]);

        // Staff who see attendance read the company's look; only managers change it.
        $staff = $this->createUserWithRole($this->company, 'employee');
        $unchanged = $this->page([]);
        $this->actingAs($staff)->getJson('/api/attendance/report-codes')->assertOk()->assertJsonPath('statuses.L.code', 'LT');
        $this->actingAs($staff)->putJson('/api/attendance/report-codes', $unchanged)->assertForbidden();

        // Another company keeps its own.
        $other = $this->company('Other', 'boss@other.test');
        $this->actingAs($other->users()->first())->getJson('/api/attendance/report-codes')->assertJsonPath('statuses.L.code', 'L')->assertJsonPath('leave.0.report_code', 'AL');

        // Reset brings back the usual look for both.
        $this->actingAs($this->admin)->deleteJson('/api/attendance/report-codes')
            ->assertOk()
            ->assertJsonPath('statuses.L', ['code' => 'L', 'color' => 'amber', 'text' => 'auto', 'bold' => true])
            ->assertJsonPath('leave.0', fn (array $l) => [$l['report_code'], $l['color'], $l['text'], $l['bold']] === ['AL', 'violet', 'auto', true]);
        $this->assertNull($this->company->fresh()->report_codes);
    }

    public function test_one_code_means_one_thing(): void
    {
        // Two statuses can't share a code, and none may be empty, too long, LV, or an unknown colour.
        $this->save(['E' => ['code' => 'L']])->assertJsonValidationErrors(['statuses.E.code', 'statuses.L.code']);
        $this->save(['P' => ['code' => '']])->assertJsonValidationErrors('statuses.P.code');
        $this->save(['P' => ['code' => 'PRES']])->assertJsonValidationErrors('statuses.P.code');
        $this->save(['P' => ['code' => 'LV']])->assertJsonValidationErrors('statuses.P.code');
        $this->save(['P' => ['color' => 'violet']])->assertJsonValidationErrors('statuses.P.color');
        $this->save(['P' => ['text' => 'pinkish']])->assertJsonValidationErrors('statuses.P.text');

        // A leave type's code can't be a status's, even one not sent with the page.
        $this->save(['L' => ['code' => 'AL']])->assertJsonValidationErrors(['statuses.L.code' => 'Annual leave']);
        $sick = $this->type('sick');
        $this->save([], [$sick->id => ['code' => 'P', 'color' => 'pink', 'text' => 'auto', 'bold' => true]])->assertJsonValidationErrors("leave.{$sick->id}.code");
        $this->save(['L' => ['code' => 'LT']])->assertOk();

        // Leave Policy checks the same: the company's own codes and the defaults stay taken.
        $this->actingAs($this->admin)->putJson("/api/leave-types/{$sick->id}", ['report_code' => 'LT'])->assertJsonValidationErrors('report_code');
        $this->actingAs($this->admin)->putJson("/api/leave-types/{$sick->id}", ['report_code' => 'L'])->assertJsonValidationErrors('report_code');
    }
}
