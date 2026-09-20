<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyRole;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\CompanyUserService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()
            ->company
            ->users()
            ->with('membership.roles')
            ->get()
            ->map(fn (User $user) => $this->present($user));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in($this->companyRoleNames($request))],
        ]);

        $user = app(CompanyUserService::class)->create(
            $request->user()->company_id,
            $data['name'],
            $data['email'],
            $data['password'],
            $data['role'],
        );

        return response()->json($this->present($user), 201);
    }

    public function update(Request $request, User $user)
    {
        $this->authorizeSameCompany($request, $user);

        $data = $request->validate([
            'role' => ['required', Rule::in($this->companyRoleNames($request))],
        ]);

        $role = CompanyRole::query()
            ->where('company_id', $request->user()->company_id)
            ->where('name', $data['role'])
            ->firstOrFail();

        $user->membership->roles()->sync([$role->id => ['created_at' => now()]]);

        AuditLogger::record('user.role_changed', $user, ['role' => $data['role']]);

        return $this->present($user);
    }

    public function setActive(Request $request, User $user)
    {
        $this->authorizeSameCompany($request, $user);

        if ($user->is($request->user())) {
            throw ValidationException::withMessages([
                'user' => ['You cannot deactivate your own account.'],
            ]);
        }

        $data = $request->validate(['is_active' => ['required', 'boolean']]);

        $user->update(['is_active' => $data['is_active']]);

        AuditLogger::record($data['is_active'] ? 'user.reactivated' : 'user.deactivated', $user);

        return $this->present($user);
    }

    public function destroy(Request $request, User $user)
    {
        $this->authorizeSameCompany($request, $user);

        if ($user->is($request->user())) {
            throw ValidationException::withMessages([
                'user' => ['You cannot remove your own account.'],
            ]);
        }

        AuditLogger::record('user.removed', $user, ['name' => $user->name, 'email' => $user->email]);

        $user->delete();

        return response()->noContent();
    }

    /**
     * An empty/null branch_ids means unrestricted (every branch) — rows only
     * ever exist to restrict, per membership_branch_access's own convention.
     */
    public function setBranchAccess(Request $request, User $user)
    {
        $this->authorizeSameCompany($request, $user);

        $data = $request->validate([
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['integer', Rule::exists('branches', 'id')->where('company_id', $request->user()->company_id)],
        ]);

        $branchIds = $data['branch_ids'] ?? [];

        $user->membership->branchAccess()->delete();

        foreach ($branchIds as $branchId) {
            $user->membership->branchAccess()->create(['branch_id' => $branchId, 'created_at' => now()]);
        }

        AuditLogger::record('user.branch_access_changed', $user, ['branch_ids' => $branchIds]);

        return $this->present($user->fresh());
    }

    private function authorizeSameCompany(Request $request, User $user): void
    {
        abort_unless($user->company_id === $request->user()->company_id, 404);
    }

    private function companyRoleNames(Request $request): array
    {
        return CompanyRole::query()
            ->where('company_id', $request->user()->company_id)
            ->pluck('name')
            ->all();
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'role' => $user->membership?->roles?->first()?->name,
            // null = unrestricted (every branch); otherwise the exact set they can see.
            'branch_ids' => $user->membership?->accessibleBranchIds(),
        ];
    }
}
