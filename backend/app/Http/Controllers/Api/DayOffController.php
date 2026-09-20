<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DayOffController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        // findOrFail goes through the company and branch-access scopes, so a
        // manager can only mark days off for people they can actually see.
        $employee = Employee::query()->findOrFail($data['employee_id']);

        if (DayOff::query()->where('employee_id', $employee->id)->whereDate('date', $data['date'])->exists()) {
            throw ValidationException::withMessages(['date' => ['This day is already marked as a day off.']]);
        }

        if (Schedule::query()->where('employee_id', $employee->id)->whereDate('date', $data['date'])->exists()) {
            throw ValidationException::withMessages([
                'date' => ['This employee has a shift on that day. Remove it from the schedule first.'],
            ]);
        }

        return response()->json(DayOff::query()->create([
            'employee_id' => $employee->id,
            'date' => $data['date'],
            'reason' => $data['reason'] ?? null,
        ]), 201);
    }

    public function destroy(DayOff $dayOff)
    {
        $dayOff->delete();

        return response()->noContent();
    }
}
