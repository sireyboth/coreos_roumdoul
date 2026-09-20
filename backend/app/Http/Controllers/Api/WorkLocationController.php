<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\WorkLocation;
use Illuminate\Http\Request;

class WorkLocationController extends Controller
{
    public function index()
    {
        return WorkLocation::query()->with('branch')->latest()->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['sometimes', 'integer', 'min:10', 'max:5000'],
            'is_active' => ['boolean'],
        ]);

        return response()->json(WorkLocation::query()->create($data), 201);
    }

    /** Invalidates this location's printed code and issues a new one. */
    public function regenerateQrCode(WorkLocation $workLocation)
    {
        $workLocation->regenerateQrToken();

        return $workLocation->fresh('branch');
    }

    public function show(WorkLocation $workLocation)
    {
        return $workLocation->load('branch');
    }

    public function update(Request $request, WorkLocation $workLocation)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['sometimes', 'integer', 'min:10', 'max:5000'],
            'is_active' => ['boolean'],
        ]);

        $workLocation->update($data);

        return $workLocation;
    }

    public function destroy(WorkLocation $workLocation)
    {
        if ($workLocation->branch()->exists()) {
            return response()->json([
                'message' => "This is {$workLocation->branch->name}'s check-in location — it's managed by the branch. Deactivate or delete the branch instead.",
                'code' => 'in_use',
            ], 422);
        }

        $upcoming = Schedule::query()->where('work_location_id', $workLocation->id)->whereDate('date', '>=', now()->toDateString())->count();

        if ($upcoming > 0) {
            return response()->json([
                'message' => "This location is used by {$upcoming} upcoming ".($upcoming === 1 ? 'schedule' : 'schedules').'. Remove those first.',
                'code' => 'in_use',
            ], 422);
        }

        $workLocation->delete();

        return response()->noContent();
    }
}
