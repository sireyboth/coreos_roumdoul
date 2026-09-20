<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Team;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function index()
    {
        return Team::query()->with('department')->latest()->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $team = Team::query()->create($data);

        return response()->json($team, 201);
    }

    public function show(Team $team)
    {
        return $team->load('department');
    }

    public function update(Request $request, Team $team)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $team->update($data);

        return $team;
    }

    public function destroy(Team $team)
    {
        $team->delete();

        return response()->noContent();
    }
}
