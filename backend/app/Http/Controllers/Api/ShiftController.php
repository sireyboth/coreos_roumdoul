<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\Shift;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function index()
    {
        return Shift::query()->latest()->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'break_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
            'is_break_paid' => ['boolean'],
            'grace_minutes' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'is_active' => ['boolean'],
        ]);

        return response()->json(Shift::query()->create($data), 201);
    }

    public function show(Shift $shift)
    {
        return $shift;
    }

    public function update(Request $request, Shift $shift)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'start_time' => ['sometimes', 'date_format:H:i'],
            'end_time' => ['sometimes', 'date_format:H:i'],
            'break_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
            'is_break_paid' => ['boolean'],
            'grace_minutes' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'is_active' => ['boolean'],
        ]);

        $shift->update($data);

        return $shift;
    }

    public function destroy(Request $request, Shift $shift)
    {
        $today = now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();

        $upcoming = Schedule::query()->where('shift_id', $shift->id)->whereDate('date', '>=', $today)->count();

        if ($upcoming > 0) {
            return response()->json([
                'message' => "\"{$shift->name}\" is still scheduled on {$upcoming} upcoming ".($upcoming === 1 ? 'day' : 'days').'. Remove those schedules first, or deactivate the shift instead.',
                'code' => 'in_use',
            ], 422);
        }

        $shift->delete();

        return response()->noContent();
    }
}
