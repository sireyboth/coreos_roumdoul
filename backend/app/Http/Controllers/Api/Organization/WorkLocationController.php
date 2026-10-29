<?php

namespace App\Http\Controllers\Api\Organization;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\WorkLocation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\ValidationException;

class WorkLocationController extends Controller
{
    /** "Require location" is meaningless for a place with no coordinates to check against. */
    private function assertCanRequireLocation(bool $require, mixed $latitude, mixed $longitude): void
    {
        if ($require && ($latitude === null || $longitude === null)) {
            throw ValidationException::withMessages([
                'require_location' => [__('Set this location\'s latitude and longitude first — there is nothing to check the scan against without them.')],
            ]);
        }
    }

    /** The token is hidden on the model; only people who manage locations get it back. */
    private function reveal(Request $request, WorkLocation $location): WorkLocation
    {
        return $request->user()->hasCompanyPermission('work_locations.manage') && $this->inReach($request, $location) ? $location->makeVisible('qr_token') : $location;
    }

    /**
     * Someone limited to some branches changes only those branches' locations
     * (and gets only their QR codes); company-wide ones are left to people
     * who cover every branch.
     */
    private function inReach(Request $request, WorkLocation $location): bool
    {
        $branchIds = $request->user()->membership?->accessibleBranchIds();

        return $branchIds === null || in_array((int) $location->branch_id, array_map('intval', $branchIds), true);
    }

    public function index(Request $request)
    {
        $locations = WorkLocation::query()->with('branch')->inDisplayOrder()->paginate(25);

        $locations->getCollection()->each(fn (WorkLocation $location) => $this->reveal($request, $location));

        return $locations;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'branch_id' => ['nullable', $this->ownBranch($request)],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['sometimes', 'integer', 'min:10', 'max:5000'],
            'require_location' => ['boolean'],
            'is_active' => ['boolean'],
            ...WorkLocation::displayOrderRules(),
        ]);

        $this->assertCanRequireLocation($data['require_location'] ?? false, $data['latitude'] ?? null, $data['longitude'] ?? null);

        return response()->json($this->reveal($request, WorkLocation::query()->create($data)->fresh()), 201);
    }

    /** Invalidates this location's printed code and issues a new one. */
    public function regenerateQrCode(Request $request, WorkLocation $workLocation)
    {
        abort_unless($this->inReach($request, $workLocation), 404);
        $workLocation->regenerateQrToken();

        return $this->reveal($request, $workLocation->fresh('branch'));
    }

    public function show(Request $request, WorkLocation $workLocation)
    {
        return $this->reveal($request, $workLocation->load('branch'));
    }

    public function update(Request $request, WorkLocation $workLocation)
    {
        abort_unless($this->inReach($request, $workLocation), 404);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'branch_id' => ['nullable', $this->ownBranch($request)],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['sometimes', 'integer', 'min:10', 'max:5000'],
            'require_location' => ['boolean'],
            'is_active' => ['boolean'],
            ...WorkLocation::displayOrderRules(),
        ]);

        $this->assertCanRequireLocation(
            $data['require_location'] ?? $workLocation->require_location,
            array_key_exists('latitude', $data) ? $data['latitude'] : $workLocation->latitude,
            array_key_exists('longitude', $data) ? $data['longitude'] : $workLocation->longitude,
        );

        $workLocation->update($data);

        return $this->reveal($request, $workLocation);
    }

    public function destroy(Request $request, WorkLocation $workLocation)
    {
        abort_unless($this->inReach($request, $workLocation), 404);

        if ($workLocation->branch()->exists()) {
            return response()->json([
                'message' => __('This is :branch\'s check-in location — it\'s managed by the branch. Deactivate or delete the branch instead.', ['branch' => $workLocation->branch->name]),
                'code' => 'in_use',
            ], 422);
        }

        $upcoming = Schedule::query()->where('work_location_id', $workLocation->id)->whereDate('date', '>=', now()->toDateString())->count();

        if ($upcoming > 0) {
            return response()->json([
                'message' => $upcoming === 1
                    ? __('This location is used by :n upcoming schedule. Remove those first.', ['n' => $upcoming])
                    : __('This location is used by :n upcoming schedules. Remove those first.', ['n' => $upcoming]),
                'code' => 'in_use',
            ], 422);
        }

        $workLocation->delete();

        return response()->noContent();
    }

    /** A branch of the caller's own company (an exists: rule alone would accept anyone's). */
    private function ownBranch(Request $request): Exists
    {
        return Rule::exists('branches', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at');
    }
}
