<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
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

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['This account has been deactivated.'],
            ]);
        }

        $company = $user->company;
        $companyStatus = $company?->status;

        if (in_array($companyStatus, ['suspended', 'cancelled'], true)) {
            throw ValidationException::withMessages([
                'email' => ["This company's account has been {$companyStatus}. Contact support."],
            ]);
        }

        if ($company?->isTrialExpired()) {
            throw ValidationException::withMessages([
                'email' => ['Your trial has ended. Please upgrade your plan to continue.'],
            ]);
        }

        return response()->json([
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $user->only('id', 'name', 'email', 'company_id'),
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $company = $user->company;
        $membership = $user->membership;

        return response()->json([
            'user' => $user->only('id', 'name', 'email', 'company_id'),
            'roles' => $membership?->roles()->pluck('name') ?? [],
            'permissions' => $membership?->permissionCodes() ?? [],
            'employee' => $user->employee?->only('id', 'name'),
            'company' => $company?->only('id', 'name', 'slug', 'status'),
            'modules' => $company
                ? \App\Models\Module::query()
                    ->where('status', 'active')
                    ->get()
                    ->mapWithKeys(fn ($module) => [$module->code => $company->hasModule($module->code)])
                : [],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
