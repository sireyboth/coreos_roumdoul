<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyPermission;
use App\Models\CompanyRole;
use App\Services\AuditLogger;
use App\Support\CompanyPermissions;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoleController extends Controller
{
    /**
     * "company-admin" is protected: every company needs at least one role
     * that can always manage users and roles, or a company could strip its
     * own way to ever fix a permissions mistake without platform support.
     */
    private const PROTECTED_ROLE = 'company-admin';

    public function index(Request $request)
    {
        return CompanyRole::query()
            ->where('company_id', $request->user()->company_id)
            ->with('permissions')
            ->inDisplayOrder()
            ->get()
            ->map(fn (CompanyRole $role) => $this->present($role));
    }

    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('company_roles', 'name')->where(fn ($query) => $query->where('company_id', $companyId)),
            ],
            'permissions' => ['array'],
            'permissions.*' => [Rule::in(CompanyPermissions::all())],
            ...CompanyRole::displayOrderRules(),
        ]);

        $role = CompanyRole::query()->create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'code' => $data['name'],
            'sort_order' => $data['sort_order'] ?? null,
        ]);

        $this->syncPermissions($role, $data['permissions'] ?? []);

        AuditLogger::record('role.created', $role, ['name' => $role->name, 'permissions' => $data['permissions'] ?? []]);

        return response()->json($this->present($role), 201);
    }

    public function update(Request $request, CompanyRole $role)
    {
        $this->authorizeSameCompany($request, $role);

        $companyId = $request->user()->company_id;

        $data = $request->validate([
            'name' => [
                'sometimes', 'string', 'max:255',
                Rule::unique('company_roles', 'name')->where(fn ($query) => $query->where('company_id', $companyId))->ignore($role->id),
            ],
            'permissions' => ['array'],
            ...CompanyRole::displayOrderRules(),
        ]);

        // company-admin's name and permissions are locked; only where it sits in lists can change.
        if ($role->code === self::PROTECTED_ROLE && (isset($data['name']) || isset($data['permissions']))) {
            throw ValidationException::withMessages([
                'role' => ['The company-admin role\'s permissions cannot be changed.'],
            ]);
        }

        if (array_key_exists('sort_order', $data)) {
            $role->update(['sort_order' => $data['sort_order']]);
        }

        if (isset($data['permissions'])) {
            $this->syncPermissions($role, $data['permissions']);
        }

        if (isset($data['name'])) {
            $role->update(['name' => $data['name']]);
        }

        AuditLogger::record('role.updated', $role, $data);

        return $this->present($role->fresh('permissions'));
    }

    public function destroy(Request $request, CompanyRole $role)
    {
        $this->authorizeSameCompany($request, $role);

        if ($role->code === self::PROTECTED_ROLE) {
            throw ValidationException::withMessages([
                'role' => ['The company-admin role cannot be deleted.'],
            ]);
        }

        if ($role->memberships()->exists()) {
            throw ValidationException::withMessages([
                'role' => ['This role is still assigned to a user. Reassign them first.'],
            ]);
        }

        AuditLogger::record('role.deleted', null, ['name' => $role->name]);

        $role->delete();

        return response()->noContent();
    }

    public function permissions()
    {
        return CompanyPermissions::grouped();
    }

    private function authorizeSameCompany(Request $request, CompanyRole $role): void
    {
        abort_unless($role->company_id === $request->user()->company_id, 404);
    }

    /**
     * @param  array<int, string>  $codes
     */
    private function syncPermissions(CompanyRole $role, array $codes): void
    {
        $permissionIds = CompanyPermission::query()
            ->whereIn('code', $codes)
            ->pluck('id', 'code');

        foreach ($codes as $code) {
            if (! $permissionIds->has($code)) {
                CompanyPermission::query()->create(['code' => $code, 'name' => $code]);
            }
        }

        $ids = CompanyPermission::query()->whereIn('code', $codes)->pluck('id');

        $role->permissions()->sync($ids);
    }

    private function present(CompanyRole $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'protected' => $role->code === self::PROTECTED_ROLE,
            'sort_order' => $role->sort_order,
            'permissions' => $role->permissions->pluck('code'),
        ];
    }
}
