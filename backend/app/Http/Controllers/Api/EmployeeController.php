<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\EmployeeAssignmentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function __construct(private readonly EmployeeAssignmentService $assignments) {}

    /**
     * A membership restricted to specific branches (see
     * RestrictedToAccessibleBranches) shouldn't be able to write an employee
     * into a branch it can't otherwise see — the read-side scope alone would
     * leave that door open.
     */
    private function branchRule(Request $request): array
    {
        $branchIds = $request->user()->membership?->accessibleBranchIds();

        return $branchIds === null ? ['exists:branches,id'] : [Rule::in($branchIds)];
    }

    public function index()
    {
        return Employee::query()->with(['branch', 'department', 'team'])->latest()->paginate(25);
    }

    public function store(Request $request)
    {
        if ($request->user()->company->hasReachedEmployeeLimit()) {
            return response()->json([
                'message' => 'Your plan\'s employee limit has been reached. Upgrade your plan to add more.',
            ], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'employee_code' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['sometimes', 'in:active,on_leave,suspended,terminated'],
            'hire_date' => ['nullable', 'date'],
            'branch_id' => ['required', ...$this->branchRule($request)],
            'department_id' => ['nullable', 'exists:departments,id'],
            'team_id' => ['nullable', 'exists:teams,id'],
        ]);

        $employee = Employee::query()->create(
            collect($data)->except(['job_title', 'branch_id', 'department_id', 'team_id'])->all()
        );

        $this->assignments->open($employee, $data);

        return response()->json($employee->fresh(['branch', 'department', 'team']), 201);
    }

    public function show(Employee $employee)
    {
        return $employee->load(['branch', 'department', 'team']);
    }

    public function update(Request $request, Employee $employee)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'employee_code' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['sometimes', 'in:active,on_leave,suspended,terminated'],
            'hire_date' => ['nullable', 'date'],
            'termination_date' => ['nullable', 'date'],
            'branch_id' => ['nullable', ...$this->branchRule($request)],
            'department_id' => ['nullable', 'exists:departments,id'],
            'team_id' => ['nullable', 'exists:teams,id'],
        ]);

        $employee->update(
            collect($data)->except(['job_title', 'branch_id', 'department_id', 'team_id'])->all()
        );

        $this->assignments->reassign($employee, $data);

        return $employee->fresh(['branch', 'department', 'team']);
    }

    public function destroy(Employee $employee)
    {
        $employee->delete();

        return response()->noContent();
    }
}
