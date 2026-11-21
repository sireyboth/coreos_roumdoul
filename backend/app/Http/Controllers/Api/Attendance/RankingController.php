<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Services\Attendance\EmployeeRanking;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Top employees for one month (EmployeeRanking).
 *
 * Who sees what:
 *  - Everyone with attendance access: the Top 10 (name, photo, job, branch,
 *    score — never anyone's absences or late minutes), the scoring rule,
 *    and their own rank with their own numbers.
 *  - attendance.manage: also the full list with each person's numbers,
 *    limited to the branches they may see.
 * Nobody is ever shown at the bottom of a public list.
 */
class RankingController extends Controller
{
    public const TOP = 10;

    /** How far back the ranking can be looked up. */
    public const MONTHS_BACK = 24;

    public function show(Request $request, EmployeeRanking $ranking)
    {
        $company = $request->user()->company;
        abort_unless($company instanceof Company, 404);

        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $thisMonth = CarbonImmutable::now($timezone)->format('Y-m');

        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m', 'before_or_equal:'.$thisMonth, 'after_or_equal:'.CarbonImmutable::now($timezone)->subMonths(self::MONTHS_BACK)->format('Y-m')],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('company_id', $company->id)],
        ]);

        $month = CarbonImmutable::createFromFormat('Y-m-d', ($data['month'] ?? $thisMonth).'-01', $timezone);
        $rows = $ranking->forMonth($company, $month, isset($data['branch_id']) ? (int) $data['branch_id'] : null);

        $mine = $rows->first(fn (array $row) => $row['employee']->user_id === $request->user()->id);

        return [
            'month' => $month->format('Y-m'),
            'rule' => [
                'attendance_weight' => EmployeeRanking::ATTENDANCE_WEIGHT,
                'on_time_weight' => EmployeeRanking::ON_TIME_WEIGHT,
                'min_days' => EmployeeRanking::MIN_DAYS,
            ],
            'ranked' => $rows->count(),
            'top' => $rows->take(self::TOP)->map(fn (array $row) => $this->publicRow($row))->values(),
            'me' => $mine ? [...$this->publicRow($mine), ...$this->numbers($mine)] : null,
            // Managers: everyone they may see, with the numbers behind each score.
            'all' => $request->user()->hasCompanyPermission('attendance.manage')
                ? $this->visibleToManager($rows)->map(fn (array $row) => [...$this->publicRow($row), ...$this->numbers($row)])->values()
                : null,
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
        ];
    }

    /** Safe for everyone to see: who, where, rank and score. */
    private function publicRow(array $row): array
    {
        /** @var Employee $employee */
        $employee = $row['employee'];

        return [
            'rank' => $row['rank'],
            'score' => $row['score'],
            'employee_id' => $employee->id,
            'name' => $employee->name,
            'name_km' => $employee->name_km,
            'job_title' => $employee->job_title,
            'branch' => EmployeeRanking::branchName($employee),
            'photo_url' => $employee->photo_url,
        ];
    }

    /** The numbers behind a score: only for that person, or a manager. */
    private function numbers(array $row): array
    {
        return [
            'scheduled_days' => $row['scheduled_days'],
            'present_days' => $row['present_days'],
            'on_time_days' => $row['on_time_days'],
            'late_minutes' => $row['late_minutes'],
        ];
    }

    /** A branch-limited manager sees only their branches' people (the Employee branch scope decides). */
    private function visibleToManager($rows)
    {
        $visible = Employee::query()->whereIn('id', $rows->map(fn (array $row) => $row['employee']->id))->pluck('id')->flip();

        return $rows->filter(fn (array $row) => $visible->has($row['employee']->id));
    }
}
