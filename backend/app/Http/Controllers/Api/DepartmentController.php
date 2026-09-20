<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        return Department::query()->with('branch')->latest()->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'parent_department_id' => ['nullable', 'exists:departments,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $department = Department::query()->create($data);

        return response()->json($department, 201);
    }

    public function show(Department $department)
    {
        return $department->load('branch');
    }

    public function update(Request $request, Department $department)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'parent_department_id' => ['nullable', 'exists:departments,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $department->update($data);

        return $department;
    }

    public function destroy(Department $department)
    {
        $department->delete();

        return response()->noContent();
    }
}
