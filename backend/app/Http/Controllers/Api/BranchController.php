<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\EmployeeAssignment;
use App\Models\WorkLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class BranchController extends Controller
{
    /**
     * What a branch response carries beyond its own columns: whether a scan
     * must come with the phone's location (a setting of its check-in point),
     * and — for people who manage branches and so print the poster — the QR
     * token. Nobody else ever receives the token.
     */
    private function present(Branch $branch, bool $canSeeQr): Branch
    {
        $branch->setAttribute('require_location', (bool) $branch->workLocation?->require_location);

        return $canSeeQr ? $branch->append('qr_token') : $branch;
    }

    private function canSeeQr(Request $request): bool
    {
        return $request->user()->hasCompanyPermission('branches.manage');
    }

    public function index(Request $request)
    {
        $branches = Branch::query()->with('workLocation')->latest()->paginate(25);
        $canSeeQr = $this->canSeeQr($request);

        $branches->getCollection()->each(fn (Branch $branch) => $this->present($branch, $canSeeQr));

        return $branches;
    }

    public function store(Request $request)
    {
        if ($request->user()->company->hasReachedBranchLimit()) {
            return response()->json([
                'message' => 'Your plan\'s branch limit has been reached. Upgrade your plan to add more.',
                'code' => 'plan_limit_reached',
            ], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            // Required so this branch can always be checked as "too far",
            // whenever an employee's GPS is available at check-in — set
            // once here, not something a daily check-in depends on.
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'require_location' => ['boolean'],
        ]);

        $branch = Branch::query()->create(Arr::except($data, 'require_location'));

        $this->syncWorkLocation($branch, $data['require_location'] ?? null);

        return response()->json($this->present($branch->refresh(), $this->canSeeQr($request)), 201);
    }

    public function show(Request $request, Branch $branch)
    {
        return $this->present($branch->load('workLocation'), $this->canSeeQr($request));
    }

    public function update(Request $request, Branch $branch)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            // Present but empty is rejected — a branch can't be edited back
            // into having no coordinates once it has them.
            'latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'require_location' => ['boolean'],
        ]);

        $branch->update(Arr::except($data, 'require_location'));

        $this->syncWorkLocation($branch, $data['require_location'] ?? null);

        return $this->present($branch->refresh(), $this->canSeeQr($request));
    }

    public function destroy(Branch $branch)
    {
        $employees = EmployeeAssignment::query()
            ->where('branch_id', $branch->id)
            ->whereNull('effective_to')
            ->whereHas('employee', fn ($query) => $query->withoutGlobalScope('branch_access'))
            ->count();

        if ($employees > 0) {
            return response()->json([
                'message' => "{$branch->name} still has {$employees} ".($employees === 1 ? 'employee' : 'employees').'. Move them to another branch first.',
                'code' => 'in_use',
            ], 422);
        }

        // Its check-in location (and QR code) goes with it. Any access
        // restrictions naming this branch are left alone on purpose: removing
        // them would turn a restricted manager into an unrestricted one.
        DB::transaction(function () use ($branch) {
            $branch->workLocation?->delete();
            $branch->delete();
        });

        return response()->noContent();
    }

    /**
     * Invalidates the branch's current QR code and issues a new one — for
     * when a printed poster is lost, damaged, or its photo has leaked.
     */
    public function regenerateQrCode(Request $request, Branch $branch)
    {
        $this->syncWorkLocation($branch);

        $branch->refresh()->workLocation->regenerateQrToken();

        return $this->present($branch->fresh('workLocation'), $this->canSeeQr($request));
    }

    /**
     * Every branch gets a matching WorkLocation, GPS coordinates or not:
     * it's what check-in actually attaches to, and it's what holds the
     * QR check-in code — a branch with no GPS (common indoors/in malls)
     * still needs one so it can issue a QR code. Radius is only set on
     * first creation — never silently overridden if an admin has since
     * tuned it by hand.
     */
    private function syncWorkLocation(Branch $branch, ?bool $requireLocation = null): void
    {
        $workLocation = WorkLocation::query()->firstOrNew(['branch_id' => $branch->id]);

        $workLocation->fill([
            'company_id' => $branch->company_id,
            'name' => $branch->name,
            'address' => $branch->address,
            'latitude' => $branch->latitude,
            'longitude' => $branch->longitude,
            'is_active' => $branch->is_active ?? true,
        ]);

        if (! $workLocation->exists) {
            $workLocation->radius_meters = 100;
        }

        // Only changed when the request says so — an edit that doesn't mention
        // it must never quietly switch the setting off.
        if ($requireLocation !== null) {
            $workLocation->require_location = $requireLocation;
        }

        $workLocation->save();
    }
}
