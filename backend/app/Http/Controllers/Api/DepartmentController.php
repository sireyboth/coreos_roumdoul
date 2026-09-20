<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Services\EmployeeAssignmentService;
use Illuminate\Support\Facades\DB;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentController extends Controller
{
    public function __construct(private readonly EmployeeAssignmentService $assignments) {}

    /**
     * Rules shared by create and update. The related ids are checked against
     * the caller's own company — a plain `exists:` would accept another
     * company's branch or department.
     */
    private function rules(Request $request, bool $creating): array
    {
        $companyId = $request->user()->company_id;

        return [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'parent_department_id' => ['nullable', Rule::exists('departments', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }

    /** A department can't sit under itself or anything beneath it. */
    private function assertNoCycle(Department $department, ?int $parentId): void
    {
        $cursor = $parentId;
        $seen = [];

        while ($cursor !== null && ! in_array($cursor, $seen, true)) {
            if ($cursor === $department->id) {
                throw ValidationException::withMessages([
                    'parent_department_id' => ['A department can\'t be placed under itself or one of its own sub-departments.'],
                ]);
            }

            $seen[] = $cursor;
            $cursor = Department::query()->whereKey($cursor)->value('parent_department_id');
        }
    }

    /** Current, non-terminated employees per department id. */
    private function memberCounts(array $ids, bool $everyone = false): array
    {
        return EmployeeAssignment::query()
            ->whereNull('effective_to')
            ->whereIn('department_id', $ids)
            ->whereHas('employee', function ($q) use ($everyone) {
                $q->where('employment_status', '!=', 'terminated');
                // A branch-limited manager sees their own headcount, but the
                // delete guard below must count everyone.
                if ($everyone) {
                    $q->withoutGlobalScope('branch_access');
                }
            })
            ->selectRaw('department_id, count(*) as total')
            ->groupBy('department_id')
            ->pluck('total', 'department_id')
            ->all();
    }

    public function index(Request $request)
    {
        $departments = Department::query()->with(['branch', 'parent'])->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 25), 1), 200));

        $ids = $departments->getCollection()->pluck('id')->all();
        $members = $this->memberCounts($ids);
        $teams = Team::query()->whereIn('department_id', $ids)
            ->selectRaw('department_id, count(*) as total')->groupBy('department_id')->pluck('total', 'department_id');

        $departments->getCollection()->each(function (Department $department) use ($members, $teams) {
            $department->setAttribute('members_count', (int) ($members[$department->id] ?? 0));
            $department->setAttribute('teams_count', (int) ($teams[$department->id] ?? 0));
        });

        return $departments;
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules($request, true));

        $department = Department::query()->create($data);

        return response()->json($department->load(['branch', 'parent']), 201);
    }

    public function show(Department $department)
    {
        return $department->load(['branch', 'parent']);
    }

    public function update(Request $request, Department $department)
    {
        $data = $request->validate($this->rules($request, false));

        if (array_key_exists('parent_department_id', $data)) {
            $this->assertNoCycle($department, $data['parent_department_id'] === null ? null : (int) $data['parent_department_id']);
        }

        $department->update($data);

        return $department->load(['branch', 'parent']);
    }

    public function destroy(Department $department)
    {
        $members = $this->memberCounts([$department->id], everyone: true)[$department->id] ?? 0;
        $teams = Team::query()->where('department_id', $department->id)->count();
        $children = Department::query()->where('parent_department_id', $department->id)->count();

        if ($members > 0 || $teams > 0 || $children > 0) {
            $parts = array_filter([
                $members > 0 ? "{$members} ".($members === 1 ? 'employee' : 'employees') : null,
                $teams > 0 ? "{$teams} ".($teams === 1 ? 'team' : 'teams') : null,
                $children > 0 ? "{$children} ".($children === 1 ? 'sub-department' : 'sub-departments') : null,
            ]);

            throw ValidationException::withMessages([
                'department' => ['This department still has '.implode(', ', $parts).'. Move them elsewhere first, or set the department to inactive instead.'],
            ]);
        }

        $department->delete();

        return response()->noContent();
    }

    /**
     * Adds several employees at once. Anyone already in another department is
     * moved (their history is kept). Ids the caller can't see are rejected.
     */
    public function addMembers(Request $request, Department $department)
    {
        if ($department->status !== 'active') {
            throw ValidationException::withMessages(['department' => ['This department is inactive. Set it back to active before adding people.']]);
        }

        $ids = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1', 'max:200'],
            'employee_ids.*' => ['integer', 'distinct'],
        ])['employee_ids'];

        // Goes through the company and branch-access scopes, so a manager
        // can only move people they can actually see.
        $employees = Employee::query()->with('currentAssignment.team')->whereIn('id', $ids)->get();

        if ($employees->count() !== count($ids)) {
            throw ValidationException::withMessages(['employee_ids' => ['Some of those employees couldn\'t be found.']]);
        }

        DB::transaction(fn () => $employees->each(fn (Employee $e) => $this->assignments->joinDepartment($e, $department)));

        return ['added' => $employees->count()];
    }

    public function removeMember(Department $department, Employee $employee)
    {
        if ($employee->currentAssignment?->department_id !== $department->id) {
            throw ValidationException::withMessages(['employee' => ['This employee isn\'t in that department.']]);
        }

        $employee->loadMissing('currentAssignment.team');
        $this->assignments->leaveDepartment($employee, $department);

        return response()->noContent();
    }
}
