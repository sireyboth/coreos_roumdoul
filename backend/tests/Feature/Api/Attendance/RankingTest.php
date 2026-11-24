<?php

namespace Tests\Feature\Api\Attendance;

use App\Models\AttendanceDay;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\MembershipBranchAccess;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Attendance\EmployeeRanking;
use App\Services\Company\CompanyProvisioner;
use Carbon\Carbon;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * Top employees: a month of attendance turned into a score
 * (60 × attendance + 40 × on time), with the Top 10 for everyone and the
 * numbers only for the person themselves or a manager.
 *
 * "Today" is Monday 2 November 2026 in Phnom Penh, so October is finished.
 */
class RankingTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private User $admin;

    private Branch $main;

    private Branch $riverside;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        $this->seed(ModuleSeeder::class);
        $this->seed(PlanSeeder::class);
        $this->travelTo(Carbon::parse('2026-11-02 10:00', 'Asia/Phnom_Penh'));

        $this->company = app(CompanyProvisioner::class)->provision('Sovanna Trading', 'Boss', 'boss@sovanna.test', 'password123');
        $this->company->update(['timezone' => 'Asia/Phnom_Penh']);
        Subscription::query()->create([
            'company_id' => $this->company->id,
            'plan_id' => Plan::query()->where('code', 'growth')->firstOrFail()->id,
            'status' => 'active',
        ]);
        $this->admin = $this->company->users()->first();
        $this->main = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Main']);
        $this->riverside = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'Riverside']);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private function person(string $name, ?Branch $branch = null, array $attributes = []): Employee
    {
        $employee = Employee::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'display_name' => $name, 'hire_date' => '2024-01-01', ...$attributes,
        ]);
        EmployeeAssignment::query()->withoutGlobalScopes()->create([
            'company_id' => $this->company->id, 'employee_id' => $employee->id,
            'branch_id' => ($branch ?? $this->main)->id, 'effective_from' => '2020-01-01',
        ]);

        return $employee;
    }

    /**
     * Work days from 1 October: "P" on time, "L" late 10 min, "A" absent.
     * Other kinds of day (leave, holiday) via $kind.
     */
    private function days(Employee $employee, string $pattern, string $start = '2026-10-01', string $kind = 'work', bool $auto = false): void
    {
        $date = Carbon::parse($start);
        foreach (str_split($pattern) as $code) {
            AttendanceDay::query()->withoutGlobalScopes()->create([
                'company_id' => $this->company->id, 'employee_id' => $employee->id, 'date' => $date->toDateString(),
                'kind' => $kind, 'status' => match ($code) {
                    'A' => 'absent', default => 'complete'
                },
                'late_minutes' => $code === 'L' ? 10 : 0,
                'expected' => ['kind' => $kind, 'rules' => ['auto_attendance' => $auto]],
            ]);
            $date = $date->addDay();
        }
    }

    private function ranking(User $as, array $query = ['month' => '2026-10'])
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($as)->getJson('/api/attendance/ranking?'.http_build_query($query));
    }

    private function staffFor(Employee $employee): User
    {
        $user = $this->createUserWithRole($this->company, 'employee', ['name' => $employee->name]);
        $employee->update(['user_id' => $user->id]);

        return $user;
    }

    // ───────────────────────────── scoring ─────────────────────────────

    public function test_everyone_is_ranked_by_attendance_and_being_on_time(): void
    {
        $this->days($this->person('Dara'), 'PPPPPPPPPP');      // 10/10 came, all on time → 100
        $this->days($this->person('Sokha'), 'PPPPPPPPPA');     // 9/10 came, all on time  → 54 + 40 = 94
        $this->days($this->person('Vanna'), 'PPPPPLLLLL');     // 10/10 came, half late   → 60 + 20 = 80

        $response = $this->ranking($this->admin)->assertOk();

        $this->assertSame(['Dara', 'Sokha', 'Vanna'], array_column($response->json('top'), 'name'));
        $this->assertEquals([100, 94, 80], array_column($response->json('top'), 'score'));
        $this->assertSame([1, 2, 3], array_column($response->json('top'), 'rank'));
        $this->assertSame(['attendance_weight' => 60, 'on_time_weight' => 40, 'min_days' => 5], $response->json('rule'));
    }

    public function test_automatic_attendance_days_are_not_ranked(): void
    {
        $this->days($this->person('Boss'), 'PPPPPPPPPP', auto: true);     // auto all month → not ranked
        $mixed = $this->person('Mixed');
        $this->days($mixed, 'PPPPP', '2026-10-01', auto: true);           // 5 auto days, left out
        $this->days($mixed, 'PPPPL', '2026-10-06');                       // 5 real days, one late
        $this->days($this->person('Dara'), 'PPPPPPPPPA');

        $all = $this->ranking($this->admin)->assertOk()->json('all');

        $this->assertSame(['Dara', 'Mixed'], array_column($all, 'name'));
        $this->assertSame([5, 4], [$all[1]['scheduled_days'], $all[1]['on_time_days']]);
    }

    public function test_leave_holidays_and_today_never_count_against_anyone(): void
    {
        $this->travelTo(Carbon::parse('2026-11-10 10:00', 'Asia/Phnom_Penh'));
        $dara = $this->person('Dara');
        $this->days($dara, 'PPPPPP', '2026-11-03');           // 3–8 Nov, all fine
        $this->days($dara, 'P', '2026-11-09', 'leave');       // a day of approved leave
        $this->days($dara, 'P', '2026-11-01', 'holiday');     // a public holiday
        $this->days($dara, 'A', '2026-11-10');                // today: not over yet, not counted

        $me = $this->ranking($this->admin, ['month' => '2026-11'])->assertOk()->json('all.0');

        $this->assertSame([100, 6, 6], [(int) $me['score'], $me['scheduled_days'], $me['present_days']]);
    }

    public function test_new_starters_and_people_who_left_are_not_ranked(): void
    {
        $this->days($this->person('Dara'), 'PPPPPP');
        $this->days($this->person('New starter'), 'PPPP');                                  // under 5 days
        $this->days($this->person('Leaver', attributes: ['employment_status' => 'resigned']), 'PPPPPPPPPP');

        $response = $this->ranking($this->admin)->assertOk();

        $this->assertSame(['Dara'], array_column($response->json('top'), 'name'));
        $this->assertSame(1, $response->json('ranked'));
    }

    public function test_steady_attendance_breaks_a_tie_and_equal_records_share_a_rank(): void
    {
        $this->days($this->person('Twelve days'), 'PPPPPPPPPPPP');
        $this->days($this->person('Ten days A'), 'PPPPPPPPPP');
        $this->days($this->person('Ten days B'), 'PPPPPPPPPP');
        $this->days($this->person('Late once'), 'PPPPPPPPPL');

        $top = $this->ranking($this->admin)->assertOk()->json('top');

        $this->assertSame(['Twelve days', 'Ten days A', 'Ten days B', 'Late once'], array_column($top, 'name'));
        $this->assertSame([1, 2, 2, 4], array_column($top, 'rank'));
    }

    public function test_the_score_formula(): void
    {
        $this->assertSame(0.0, EmployeeRanking::score(0, 0, 0));
        $this->assertSame(0.0, EmployeeRanking::score(10, 0, 0));
        $this->assertSame(95.0, EmployeeRanking::score(12, 11, 11));  // 60 × 11/12 + 40 × 11/11
        $this->assertSame(86.0, EmployeeRanking::score(20, 20, 13));  // 60 × 20/20 + 40 × 13/20
        $this->assertSame(80.0, EmployeeRanking::score(15, 10, 10));  // 60 × 10/15 + 40 × 10/10 = 40 + 40
        $this->assertSame(90.0, EmployeeRanking::score(12, 12, 9));   // 60 × 12/12 + 40 × 9/12  = 60 + 30
        $this->assertSame(94.3, EmployeeRanking::score(7, 7, 6));     // 60 + 40 × 6/7 = 94.2857… → one decimal
    }

    // ───────────────────────────── who sees what ─────────────────────────────

    public function test_staff_see_the_top_10_and_their_own_rank_but_nobody_elses_numbers(): void
    {
        foreach (range(1, 11) as $i) {
            $this->days($this->person("Star {$i}"), 'PPPPPPPPPP');
        }
        $vanna = $this->person('Vanna');
        $this->days($vanna, 'PPPPPLLLLL');

        $response = $this->ranking($this->staffFor($vanna))->assertOk();

        $this->assertCount(10, $response->json('top'));
        $this->assertArrayNotHasKey('present_days', $response->json('top.0'));
        $this->assertArrayNotHasKey('late_minutes', $response->json('top.0'));
        $this->assertSame(['rank' => 12, 'present_days' => 10, 'on_time_days' => 5, 'late_minutes' => 50],
            array_intersect_key($response->json('me'), array_flip(['rank', 'present_days', 'on_time_days', 'late_minutes'])));
        $this->assertNull($response->json('all'));
        $this->assertSame(12, $response->json('ranked'));
    }

    public function test_a_branch_manager_sees_everyone_in_their_branches_with_numbers(): void
    {
        $this->days($this->person('Dara'), 'PPPPPPPPPP');
        $this->days($this->person('Rina', $this->riverside), 'PPPPPPPPPP');
        $manager = $this->createUserWithRole($this->company, 'manager');
        MembershipBranchAccess::query()->create(['company_membership_id' => $manager->membership->id, 'branch_id' => $this->main->id, 'created_at' => now()]);

        $response = $this->ranking($manager)->assertOk();

        // The public Top 10 is company-wide; the detailed list follows their branch access.
        $this->assertEqualsCanonicalizing(['Dara', 'Rina'], array_column($response->json('top'), 'name'));
        $this->assertSame(['Dara'], array_column($response->json('all'), 'name'));
        $this->assertSame(10, $response->json('all.0.present_days'));
    }

    public function test_a_branch_can_be_ranked_on_its_own(): void
    {
        $this->days($this->person('Dara'), 'PPPPPPPPPA');
        $this->days($this->person('Rina', $this->riverside), 'PPPPPPPPPP');

        $top = $this->ranking($this->admin, ['month' => '2026-10', 'branch_id' => $this->main->id])->assertOk()->json('top');

        $this->assertSame([['Dara', 1, 'Main']], array_map(fn ($r) => [$r['name'], $r['rank'], $r['branch']], $top));
    }

    public function test_future_months_old_months_and_other_companies_branches_are_refused(): void
    {
        $elsewhere = app(CompanyProvisioner::class)->provision('Other Co', 'Owner', 'owner@other.test', 'password123');
        $theirs = Branch::query()->withoutGlobalScopes()->create(['company_id' => $elsewhere->id, 'name' => 'Theirs']);

        $this->ranking($this->admin, ['month' => '2026-12'])->assertUnprocessable()->assertJsonValidationErrors('month');
        $this->ranking($this->admin, ['month' => '2020-01'])->assertUnprocessable()->assertJsonValidationErrors('month');
        $this->ranking($this->admin, ['month' => '2026-10', 'branch_id' => $theirs->id])->assertUnprocessable()->assertJsonValidationErrors('branch_id');
        // No month = this month (nothing finished yet on the 2nd except the 1st).
        $this->ranking($this->admin, [])->assertOk()->assertJson(['month' => '2026-11', 'ranked' => 0, 'top' => []]);
    }
}
