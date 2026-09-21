<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\User;
use App\Services\CompanyUserService;
use App\Services\CompanyProvisioner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request, CompanyProvisioner $provisioner)
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $company = $provisioner->provision(
            $data['company_name'],
            $data['name'],
            $data['email'],
            $data['password'],
        );

        $user = $company->users()->where('email', $data['email'])->firstOrFail();

        return response()->json([
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $user->only('id', 'name', 'email'),
            'company' => $company->only('id', 'name', 'slug', 'status'),
        ], 201);
    }

    /**
     * A valid bcrypt hash of a throwaway string. When no account matches, we still
     * check the password against this, so "no such account" takes as long as
     * "wrong password" and the response time doesn't reveal which accounts exist.
     */
    private const DUMMY_HASH = '$2y$12$2TUXGa6SMjm65e8LEhkFe.sgTZ9WJ2MZ6qcf/oc6.CFrpKNdaJB2a';

    /**
     * Sign in with an email, or with a company code + employee ID — one or the other.
     * (An employee ID is only unique inside its company, hence the company code.)
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['nullable', 'email', 'required_without:employee_id'],
            'employee_id' => ['nullable', 'string', 'max:50', 'required_without:email'],
            'company' => ['nullable', 'string', 'max:255', 'required_with:employee_id'],
            'password' => ['required', 'string'],
        ]);

        $byId = ! empty($data['employee_id']);

        if ($byId && ! empty($data['email'])) {
            throw ValidationException::withMessages([
                'email' => ['Sign in with either an email or an employee ID, not both.'],
            ]);
        }

        // Errors are reported on the field the person actually used.
        $field = $byId ? 'employee_id' : 'email';

        $user = $byId ? $this->userByEmployeeId($data['company'], $data['employee_id']) : User::query()->where('email', $data['email'])->first();

        if (! $user) {
            password_verify($data['password'], self::DUMMY_HASH);
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                $field => ['These credentials do not match our records.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                $field => ['This account has been deactivated.'],
            ]);
        }

        $company = $user->company;
        $companyStatus = $company?->status;

        if (in_array($companyStatus, ['suspended', 'cancelled'], true)) {
            throw ValidationException::withMessages([
                $field => ["This company's account has been {$companyStatus}. Contact support."],
            ]);
        }

        if ($company?->isTrialExpired()) {
            throw ValidationException::withMessages([
                $field => ['Your trial has ended. Please upgrade your plan to continue.'],
            ]);
        }

        return response()->json([
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $user->only('id', 'name', 'email', 'company_id'),
        ]);
    }

    private function userByEmployeeId(string $companyCode, string $employeeId): ?User
    {
        $company = Company::query()->where('slug', mb_strtolower(trim($companyCode)))->first();

        if (! $company) {
            return null;
        }

        $membership = CompanyMembership::query()
            ->where('company_id', $company->id)
            ->where('login_id', CompanyUserService::normaliseLoginId($employeeId))
            ->first();

        return $membership ? User::query()->find($membership->user_id) : null;
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $company = $user->company;
        $membership = $user->membership;

        return response()->json([
            'user' => $user->only('id', 'name', 'email', 'company_id') + ['login_id' => $membership?->login_id],
            'roles' => $membership?->roles()->pluck('name') ?? [],
            'permissions' => $membership?->permissionCodes() ?? [],
            'employee' => $user->employee?->only('id', 'name'),
            'company' => $company?->only('id', 'name', 'slug', 'status', 'trial_ends_at'),
            'plan' => $company?->subscription?->plan?->only('name', 'max_employees', 'max_branches'),
            'usage' => $company ? [
                'employees' => $company->employeeCount(),
                'branches' => $company->branchCount(),
            ] : null,
            'modules' => $company ? $company->moduleAccess() : [],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
