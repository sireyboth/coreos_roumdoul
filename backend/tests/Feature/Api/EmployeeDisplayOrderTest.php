<?php

namespace Tests\Feature\Api;

use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The display order set on each employee: lowest number first in every list,
 * people without one after everyone numbered, ties by name.
 */
class EmployeeDisplayOrderTest extends TestCase
{
    use RefreshDatabase;

    private $company;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);

        $this->company = app(CompanyProvisioner::class)->provision('Order Co', 'Boss', 'boss@order.test', 'password123');
        $this->admin = $this->company->users()->first();
        // Attendance is a paid module.
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
    }

    private function employee(string $name, ?int $order): Employee
    {
        return Employee::query()->create(['company_id' => $this->company->id, 'name' => $name, 'sort_order' => $order]);
    }

    public function test_the_employee_list_puts_the_lowest_number_first_and_unnumbered_people_last(): void
    {
        $this->employee('Zara (no order)', null);
        $this->employee('Anna (no order)', null);
        $this->employee('Staff', 10);
        $this->employee('Manager B', 2);
        $this->employee('Director', 1);
        $this->employee('Manager A', 2);

        $names = collect($this->actingAs($this->admin)->getJson('/api/employees?per_page=50')->json('data'))->pluck('name')->all();

        $this->assertSame(['Director', 'Manager A', 'Manager B', 'Staff', 'Anna (no order)', 'Zara (no order)'], $names);
    }

    public function test_the_order_can_be_set_and_cleared_on_the_profile(): void
    {
        $employee = $this->employee('Sokha', null);

        $this->actingAs($this->admin)->putJson("/api/employees/{$employee->id}", ['sort_order' => 3])->assertOk();
        $this->assertSame(3, $employee->fresh()->sort_order);

        $this->actingAs($this->admin)->putJson("/api/employees/{$employee->id}", ['sort_order' => null])->assertOk();
        $this->assertNull($employee->fresh()->sort_order);

        $this->actingAs($this->admin)->putJson("/api/employees/{$employee->id}", ['sort_order' => -1])->assertJsonValidationErrors('sort_order');
    }

    public function test_attendance_lists_each_person_together_in_display_order_newest_day_first(): void
    {
        $staff = $this->employee('Staff', 5);
        $director = $this->employee('Director', 1);
        $nobody = $this->employee('Unnumbered', null);

        foreach (['2026-10-01', '2026-10-02'] as $date) {
            foreach ([$nobody, $staff, $director] as $employee) {
                AttendanceDay::query()->create([
                    'company_id' => $this->company->id, 'employee_id' => $employee->id, 'date' => $date,
                    'kind' => 'work', 'status' => 'complete', 'slots' => [], 'scans' => [], 'extra_scans' => [], 'exceptions' => [],
                ]);
            }
        }

        $rows = collect($this->actingAs($this->admin)->getJson('/api/attendance?from=2026-10-01&to=2026-10-02')->json('data'))
            ->map(fn (array $day) => $day['date'].' '.$day['employee']['name'])->all();

        $this->assertSame([
            '2026-10-02 Director', '2026-10-01 Director',
            '2026-10-02 Staff', '2026-10-01 Staff',
            '2026-10-02 Unnumbered', '2026-10-01 Unnumbered',
        ], $rows);
    }
}
