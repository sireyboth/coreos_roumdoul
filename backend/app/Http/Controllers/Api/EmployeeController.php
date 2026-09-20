<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\Team;
use App\Services\AuditLogger;
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

        return $branchIds === null
            ? [Rule::exists('branches', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')]
            : [Rule::in($branchIds)];
    }

    /** Departments and teams must belong to the caller's own company (and not be deleted). */
    private function ownDepartment(Request $request): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists('departments', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at');
    }

    private function ownTeam(Request $request): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists('teams', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at');
    }

    /**
     * A team that belongs to a department can only be used together with that
     * department. Only checked when the request touches either field, so
     * editing a phone number never trips over older, inconsistent data.
     */
    private function assertTeamFitsDepartment(array $data, ?Employee $employee): void
    {
        if (! array_key_exists('team_id', $data) && ! array_key_exists('department_id', $data)) {
            return;
        }

        $current = $employee?->currentAssignment;
        $departmentId = array_key_exists('department_id', $data) ? $data['department_id'] : $current?->department_id;
        $teamId = array_key_exists('team_id', $data) ? $data['team_id'] : $current?->team_id;

        if ($teamId === null) {
            return;
        }

        $teamDepartment = Team::query()->whereKey($teamId)->value('department_id');

        if ($teamDepartment !== null && (int) $teamDepartment !== (int) $departmentId) {
            throw ValidationException::withMessages([
                'team_id' => ['That team belongs to a different department. Pick a team from the employee\'s department.'],
            ]);
        }
    }

    /** Rules for the profile fields shared by create and update. */
    private function profileRules(Request $request, ?Employee $employee = null): array
    {
        return [
            // Unique per company (the table has a matching unique index) —
            // checked here so a duplicate is a form error, not a 500.
            'employee_code' => [
                'nullable', 'string', 'max:50',
                Rule::unique('employees', 'employee_code')
                    ->where('company_id', $request->user()->company_id)
                    ->ignore($employee?->id),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'gender' => ['nullable', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'address' => ['nullable', 'string', 'max:1000'],
            'employment_type' => ['nullable', 'in:full_time,part_time,contract,temporary'],
            'hire_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Personal details (gender, date of birth, address, notes) are only for
     * people who can manage employees; everyone else gets the work profile.
     */
    private function reveal(Request $request, Employee $employee): Employee
    {
        return $request->user()->hasCompanyPermission('employees.manage')
            ? $employee->makeVisible(Employee::PERSONAL_FIELDS)
            : $employee;
    }

    /**
     * Optional filters: department_id / team_id (a member list — people who
     * have left are left out, matching the headcounts) and per_page (max 200,
     * so pickers can load everyone instead of the first 25).
     */
    public function index(Request $request)
    {
        $employees = Employee::query()->with(['branch', 'department', 'team'])
            ->when($request->filled('department_id'), fn ($q) => $q
                ->where('employment_status', '!=', 'terminated')
                ->whereHas('currentAssignment', fn ($a) => $a->where('department_id', $request->integer('department_id'))))
            ->when($request->filled('team_id'), fn ($q) => $q
                ->where('employment_status', '!=', 'terminated')
                ->whereHas('currentAssignment', fn ($a) => $a->where('team_id', $request->integer('team_id'))))
            ->orderBy('display_name')->orderBy('id')
            ->paginate(min(max($request->integer('per_page', 25), 1), 200));
        $employees->getCollection()->each(fn (Employee $e) => $this->reveal($request, $e));

        return $employees;
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
            ...$this->profileRules($request),
            // The email doubles as the login when a password is given.
            'email' => $withLogin
                ? ['required', 'email', 'max:255', Rule::unique('users', 'email')]
                : ['nullable', 'email', 'max:255'],
            'password' => ['nullable', 'string', 'min:8'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['sometimes', 'in:active,on_leave,suspended,terminated'],
            'branch_id' => ['required', ...$this->branchRule($request)],
            'department_id' => ['nullable', $this->ownDepartment($request)],
            'team_id' => ['nullable', $this->ownTeam($request)],
        ]);

        $this->assertTeamFitsDepartment($data, null);

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

        return response()->json($this->reveal($request, $employee->fresh(['branch', 'department', 'team'])), 201);
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

        return $this->reveal($request, $employee->fresh(['branch', 'department', 'team']));
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

        // A new login only sees its own branch (an admin can widen it on the
        // Users page). Without this it would default to *every* branch.
        if ($branchId = $employee->currentAssignment()->value('branch_id')) {
            app(CompanyUserService::class)->restrictToBranch($user, $branchId);
        }
    }

    public function show(Request $request, Employee $employee)
    {
        return $this->reveal($request, $employee->load(['branch', 'department', 'team']));
    }

    public function update(Request $request, Employee $employee)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            ...$this->profileRules($request, $employee),
            'email' => ['nullable', 'email', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['sometimes', 'in:active,on_leave,suspended,terminated'],
            'termination_date' => ['nullable', 'date'],
            'branch_id' => ['nullable', ...$this->branchRule($request)],
            'department_id' => ['nullable', $this->ownDepartment($request)],
            'team_id' => ['nullable', $this->ownTeam($request)],
        ]);

        $this->assertTeamFitsDepartment($data, $employee);

        $employee->update(
            collect($data)->except(['job_title', 'branch_id', 'department_id', 'team_id'])->all()
        );

        $branchBefore = $employee->currentAssignment()->value('branch_id');

        $this->assignments->reassign($employee, $data);

        if ($employee->user) {
            app(CompanyUserService::class)->followEmployeeBranch(
                $employee->user,
                $branchBefore,
                $employee->currentAssignment()->value('branch_id'),
            );
        }

        return $this->reveal($request, $employee->fresh(['branch', 'department', 'team']));
    }

    public function destroy(Request $request, Employee $employee)
    {
        $today = now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();

        DB::transaction(function () use ($employee, $today) {
            // A removed employee must not keep a working login or a future rota.
            Schedule::query()->where('employee_id', $employee->id)->whereDate('date', '>=', $today)->delete();

            if ($user = $employee->user) {
                $user->update(['is_active' => false]);
                $user->tokens()->delete();
                AuditLogger::record('user.deactivated', $user, ['reason' => 'employee removed']);
            }

            $employee->delete();
        });

        return response()->noContent();
    }
}
