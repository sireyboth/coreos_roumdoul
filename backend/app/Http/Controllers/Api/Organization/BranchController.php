<?php

namespace App\Http\Controllers\Api\Organization;

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

    private function canSeeQr(Request $request, Branch $branch): bool
    {
        return $request->user()->hasCompanyPermission('branches.manage') && $this->inReach($request, $branch);
    }

    /** Someone limited to some branches changes only those, and gets only their QR codes. */
    private function inReach(Request $request, Branch $branch): bool
    {
        $branchIds = $request->user()->membership?->accessibleBranchIds();

        return $branchIds === null || in_array($branch->id, array_map('intval', $branchIds), true);
    }

    public function index(Request $request)
    {
        $branches = Branch::query()->with('workLocation')->inDisplayOrder()->paginate(25);
        $branches->getCollection()->each(fn (Branch $branch) => $this->present($branch, $this->canSeeQr($request, $branch)));

        return $branches;
    }

    public function store(Request $request)
    {
        if ($request->user()->company->hasReachedBranchLimit()) {
            return response()->json([
                'message' => __('Your plan\'s branch limit has been reached. Upgrade your plan to add more.'),
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
            ...Branch::displayOrderRules(),
        ]);

        $branch = Branch::query()->create(Arr::except($data, 'require_location'));

        $this->syncWorkLocation($branch, $data['require_location'] ?? null);

        return response()->json($this->present($branch->refresh(), $this->canSeeQr($request, $branch)), 201);
    }

    public function show(Request $request, Branch $branch)
    {
        return $this->present($branch->load('workLocation'), $this->canSeeQr($request, $branch));
    }

    public function update(Request $request, Branch $branch)
    {
        abort_unless($this->inReach($request, $branch), 404);

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
            ...Branch::displayOrderRules(),
        ]);

        $branch->update(Arr::except($data, 'require_location'));

        $this->syncWorkLocation($branch, $data['require_location'] ?? null);

        return $this->present($branch->refresh(), $this->canSeeQr($request, $branch));
    }

    public function destroy(Request $request, Branch $branch)
    {
        abort_unless($this->inReach($request, $branch), 404);

        $employees = EmployeeAssignment::query()
            ->where('branch_id', $branch->id)
            ->whereNull('effective_to')
            ->whereHas('employee', fn ($query) => $query->withoutGlobalScope('branch_access'))
            ->count();

        if ($employees > 0) {
            return response()->json([
                'message' => $employees === 1
                    ? __(':name still has :n employee. Move them to another branch first.', ['name' => $branch->name, 'n' => $employees])
                    : __(':name still has :n employees. Move them to another branch first.', ['name' => $branch->name, 'n' => $employees]),
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
        abort_unless($this->inReach($request, $branch), 404);

        $this->syncWorkLocation($branch);

        $branch->refresh()->workLocation->regenerateQrToken();

        return $this->present($branch->fresh('workLocation'), $this->canSeeQr($request, $branch));
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
