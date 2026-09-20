<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    public function index()
    {
        return Holiday::query()->orderBy('date')->paginate(50);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date'],
            'is_recurring_yearly' => ['boolean'],
        ]);

        return response()->json(Holiday::query()->create($data), 201);
    }

    public function show(Holiday $holiday)
    {
        return $holiday;
    }

    public function update(Request $request, Holiday $holiday)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'date' => ['sometimes', 'date'],
            'is_recurring_yearly' => ['boolean'],
        ]);

        $holiday->update($data);

        return $holiday;
    }

    public function destroy(Holiday $holiday)
    {
        $holiday->delete();

        return response()->noContent();
    }
}
