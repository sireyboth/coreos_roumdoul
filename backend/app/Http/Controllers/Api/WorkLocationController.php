<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $workLocation->delete();

        return response()->noContent();
    }
}
