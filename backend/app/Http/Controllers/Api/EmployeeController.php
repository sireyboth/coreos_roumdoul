<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\CompanyUserService;
use App\Services\EmployeeAssignmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
                'code' => 'plan_limit_reached',
            ], 422);
        }

        $withLogin = $request->filled('password');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'employee_code' => ['nullable', 'string', 'max:255'],
            // The email doubles as the login when a password is given.
            'email' => $withLogin
                ? ['required', 'email', 'max:255', Rule::unique('users', 'email')]
                : ['nullable', 'email', 'max:255'],
            'password' => ['nullable', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['sometimes', 'in:active,on_leave,suspended,terminated'],
            'hire_date' => ['nullable', 'date'],
            'branch_id' => ['required', ...$this->branchRule($request)],
            'department_id' => ['nullable', 'exists:departments,id'],
            'team_id' => ['nullable', 'exists:teams,id'],
        ]);

        $employee = DB::transaction(function () use ($request, $data, $withLogin) {
            $employee = Employee::query()->create(
                collect($data)->except(['password', 'job_title', 'branch_id', 'department_id', 'team_id'])->all()
            );

            $this->assignments->open($employee, $data);

            if ($withLogin) {
                $this->linkNewLogin($request, $employee, $data['email'], $data['password']);
            }

            return $employee;
        });

        return response()->json($employee->fresh(['branch', 'department', 'team']), 201);
    }

    /**
     * Gives an employee who was added without a login one after the fact —
     * without it they can never sign in, so check-in has nothing to link to.
     */
    public function createLogin(Request $request, Employee $employee)
    {
        if ($employee->user_id !== null) {
            throw ValidationException::withMessages([
                'employee' => ['This employee already has a login.'],
            ]);
        }

        $data = $request->validate([
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
        ]);

        DB::transaction(function () use ($request, $employee, $data) {
            $this->linkNewLogin($request, $employee, $data['email'], $data['password']);

            $employee->update(['email' => $data['email']]);
        });

        return $employee->fresh(['branch', 'department', 'team']);
    }

    private function linkNewLogin(Request $request, Employee $employee, string $email, string $password): void
    {
        $user = app(CompanyUserService::class)->create(
            $request->user()->company_id,
            $employee->name,
            $email,
            $password,
            'employee',
        );

        $employee->update(['user_id' => $user->id]);
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
