<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\WorkLocation;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    public function index()
    {
        return Branch::query()->with('workLocation')->latest()->paginate(25);
    }

    public function store(Request $request)
    {
        if ($request->user()->company->hasReachedBranchLimit()) {
            return response()->json([
                'message' => 'Your plan\'s branch limit has been reached. Upgrade your plan to add more.',
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
        ]);

        $branch = Branch::query()->create($data);

        $this->syncWorkLocation($branch);

        return response()->json($branch, 201);
    }

    public function show(Branch $branch)
    {
        return $branch;
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
        ]);

        $branch->update($data);

        $this->syncWorkLocation($branch);

        return $branch;
    }

    public function destroy(Branch $branch)
    {
        $branch->delete();

        return response()->noContent();
    }

    /**
     * Invalidates the branch's current QR code and issues a new one — for
     * when a printed poster is lost, damaged, or its photo has leaked.
     */
    public function regenerateQrCode(Branch $branch)
    {
        $this->syncWorkLocation($branch);

        $branch->refresh()->workLocation->regenerateQrToken();

        return $branch->fresh();
    }

    /**
     * Every branch gets a matching WorkLocation, GPS coordinates or not:
     * it's what check-in actually attaches to, and it's what holds the
     * QR check-in code — a branch with no GPS (common indoors/in malls)
     * still needs one so it can issue a QR code. Radius is only set on
     * first creation — never silently overridden if an admin has since
     * tuned it by hand.
     */
    private function syncWorkLocation(Branch $branch): void
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

        $workLocation->save();
    }
}
