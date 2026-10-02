<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Schedule;
use App\Services\Attendance\AttendanceRecorder;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * One-off days off for one person ("Dara is off on the 12th"). They beat the
 * person's schedule assignment for that date; a roster override and a day
 * off can't share a date.
 */
class DayOffController extends Controller
{
    public function __construct(private readonly AttendanceRecorder $recorder) {}

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
        $this->recorder->assertUnlocked($employee->company_id, $data['date']);

        if (DayOff::query()->where('employee_id', $employee->id)->whereDate('date', $data['date'])->exists()) {
            throw ValidationException::withMessages(['date' => ['This day is already marked as a day off.']]);
        }

        if (Schedule::query()->where('employee_id', $employee->id)->whereDate('date', $data['date'])->exists()) {
            throw ValidationException::withMessages([
                'date' => ['This employee has a roster entry on that day. Remove it from the roster first.'],
            ]);
        }

        $dayOff = DayOff::query()->create([
            'employee_id' => $employee->id,
            'date' => $data['date'],
            'reason' => $data['reason'] ?? null,
        ]);
        $this->recalculate($employee, $data['date']);

        return response()->json($dayOff, 201);
    }

    public function destroy(DayOff $dayOff)
    {
        $date = $dayOff->date->toDateString();
        $this->recorder->assertUnlocked($dayOff->company_id, $date);

        $employee = $dayOff->employee;
        $dayOff->delete();
        $this->recalculate($employee, $date);

        return response()->noContent();
    }

    private function recalculate(?Employee $employee, string $date): void
    {
        if ($employee && $date <= now($employee->company->timezone ?: config('attendance.default_timezone'))->toDateString()) {
            $this->recorder->recalculate($employee, $date);
        }
    }
}
