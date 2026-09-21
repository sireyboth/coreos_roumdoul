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
    private function reveal(Request $request, Employee $employee, ?bool $canManage = null): Employee
    {
        // A list passes the answer in, so it's worked out once — not once per row.
        $canManage ??= $request->user()->hasCompanyPermission('employees.manage');

        // Every response built here is one that shows the person, so it carries the avatar link.
        $employee->append('photo_url');

        return $canManage ? $employee->makeVisible(Employee::PERSONAL_FIELDS) : $employee;
    }

    /**
     * Optional filters: department_id / team_id (a member list — people who
     * have left are left out, matching the headcounts) and per_page (max 200,
     * so pickers can load everyone instead of the first 25).
     */
    public function index(Request $request)
    {
        // currentAssignment is loaded up front: the job_title field reads it, and
        // without this every row would run its own query.
        $employees = Employee::query()->with(['branch', 'department', 'team', 'currentAssignment'])
            ->when($request->filled('department_id'), fn ($q) => $q
                ->where('employment_status', '!=', 'terminated')
                ->whereHas('currentAssignment', fn ($a) => $a->where('department_id', $request->integer('department_id'))))
            ->when($request->filled('team_id'), fn ($q) => $q
                ->where('employment_status', '!=', 'terminated')
                ->whereHas('currentAssignment', fn ($a) => $a->where('team_id', $request->integer('team_id'))))
            ->orderBy('display_name')->orderBy('id')
            ->paginate(min(max($request->integer('per_page', 25), 1), 500));
        $canManage = $request->user()->hasCompanyPermission('employees.manage');
        $employees->getCollection()->each(fn (Employee $e) => $this->reveal($request, $e, $canManage));

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
        // One way to sign in, never both: their email, or their employee ID.
        $method = $withLogin ? $this->loginMethod($request) : null;

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            ...$this->profileRules($request),
            'login_method' => ['nullable', 'in:email,employee_id'],
            // With an email login the email is the sign-in; otherwise it is just a contact detail.
            'email' => $method === 'email'
                ? ['required', 'email', 'max:255', Rule::unique('users', 'email')]
                : ['nullable', 'email', 'max:255'],
            // With an ID login the employee code is the sign-in, so it must exist and not be taken.
            ...($method === 'employee_id' ? ['employee_code' => $this->employeeIdRules($request)] : []),
            'password' => ['nullable', 'string', 'min:8'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['sometimes', 'in:active,on_leave,suspended,terminated'],
            'branch_id' => ['required', ...$this->branchRule($request)],
            'department_id' => ['nullable', $this->ownDepartment($request)],
            'team_id' => ['nullable', $this->ownTeam($request)],
        ]);

        $this->assertTeamFitsDepartment($data, null);

        $employee = DB::transaction(function () use ($request, $data, $withLogin, $method) {
            $employee = Employee::query()->create(
                collect($data)->except(['password', 'login_method', 'job_title', 'branch_id', 'department_id', 'team_id'])->all()
            );

            $this->assignments->open($employee, $data);

            if ($withLogin) {
                $this->linkNewLogin($request, $employee, $method, $data['password']);
            }

            return $employee;
        });

        return response()->json($this->withLoginInfo($request, $this->reveal($request, $employee->fresh(['branch', 'department', 'team']))), 201);
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

        $method = $this->loginMethod($request);

        $data = $request->validate([
            'login_method' => ['nullable', 'in:email,employee_id'],
            'password' => ['required', 'string', 'min:8'],
            ...($method === 'email'
                ? ['email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')]]
                // An ID login signs in with the employee code; if they have none yet, one is given here.
                : ['employee_code' => $this->employeeIdRules($request, $employee)]),
        ]);

        // An existing code is the ID; it can't be swapped for a different one here.
        if ($method === 'employee_id' && $employee->employee_code && mb_strtolower($employee->employee_code) !== mb_strtolower($data['employee_code'])) {
            throw ValidationException::withMessages([
                'employee_code' => ["This employee's ID is {$employee->employee_code}. Change it on their profile first if it's wrong."],
            ]);
        }

        DB::transaction(function () use ($request, $employee, $data, $method) {
            if ($method === 'employee_id') {
                $employee->update(['employee_code' => $data['employee_code']]);
            } else {
                $employee->update(['email' => $data['email']]);
            }

            $this->linkNewLogin($request, $employee, $method, $data['password']);
        });

        return $this->withLoginInfo($request, $this->reveal($request, $employee->fresh(['branch', 'department', 'team'])));
    }

    /**
     * Someone who signs in with their employee ID keeps signing in with the ID they
     * were given. If the code on their profile could change, their sign-in would
     * quietly stop matching it — so it is locked while that login exists.
     */
    private function assertSignInIdUnchanged(Employee $employee, array $data): void
    {
        if (! array_key_exists('employee_code', $data) || $employee->user_id === null) {
            return;
        }

        $loginId = $employee->user()->first()?->membership?->login_id;

        if ($loginId !== null && CompanyUserService::normaliseLoginId((string) $data['employee_code']) !== $loginId) {
            throw ValidationException::withMessages([
                'employee_code' => ["This employee signs in with the employee ID {$employee->employee_code}, so it can't be changed here."],
            ]);
        }
    }

    /** "email" (the default, as before) or "employee_id". */
    private function loginMethod(Request $request): string
    {
        return $request->input('login_method') === 'employee_id' ? 'employee_id' : 'email';
    }

    /**
     * The employee code doubles as the sign-in, so it has to be present and not
     * already used to sign in within this company (compared case-insensitively).
     */
    private function employeeIdRules(Request $request, ?Employee $employee = null): array
    {
        return [
            'required', 'string', 'max:50',
            Rule::unique('employees', 'employee_code')->where('company_id', $request->user()->company_id)->ignore($employee?->id),
            function (string $attribute, mixed $value, \Closure $fail) use ($request) {
                $taken = \App\Models\CompanyMembership::query()
                    ->where('company_id', $request->user()->company_id)
                    ->where('login_id', CompanyUserService::normaliseLoginId((string) $value))
                    ->exists();

                if ($taken) {
                    $fail('Someone in your company already signs in with that ID.');
                }
            },
        ];
    }

    /**
     * How this person signs in, for the people who manage employees (they have to
     * tell the employee): the method, the ID or email, and the company code.
     */
    private function withLoginInfo(Request $request, Employee $employee): Employee
    {
        if ($employee->user_id === null || ! $request->user()->hasCompanyPermission('employees.manage')) {
            return $employee;
        }

        $user = $employee->user()->with('membership')->first();
        $byId = $user?->membership?->login_id !== null;

        $employee->setAttribute('login', [
            'method' => $byId ? 'employee_id' : 'email',
            'identifier' => $byId ? $employee->employee_code : $user?->email,
            'company_code' => $request->user()->company->slug,
        ]);

        return $employee;
    }

    private function linkNewLogin(Request $request, Employee $employee, string $method, string $password): void
    {
        $byId = $method === 'employee_id';

        $user = app(CompanyUserService::class)->create(
            $request->user()->company_id,
            $employee->name,
            $byId ? null : $employee->email,
            $password,
            'employee',
            $byId ? $employee->employee_code : null,
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
        return $this->withLoginInfo($request, $this->reveal($request, $employee->load(['branch', 'department', 'team'])));
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
        $this->assertSignInIdUnchanged($employee, $data);

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
