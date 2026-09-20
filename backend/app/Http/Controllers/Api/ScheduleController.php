<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ScheduleController extends Controller
{
    public function index(Request $request)
    {
        $query = Schedule::query()->with(['employee', 'shift', 'workLocation']);

        // Someone who can't manage the roster only ever sees their own —
        // e.g. a rank-and-file employee checking when they're on shift.
        if (! $request->user()->hasCompanyPermission('schedules.manage')) {
            $query->whereHas('employee', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->date('to'));
        }

        return $query->orderBy('date')->paginate(50);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'shift_id' => ['required', 'exists:shifts,id'],
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->assertNotDoubleBooked($data['employee_id'], $data['date']);

        return response()->json(Schedule::query()->create($data)->load(['employee', 'shift', 'workLocation']), 201);
    }

    public function show(Schedule $schedule)
    {
        return $schedule->load(['employee', 'shift', 'workLocation']);
    }

    public function update(Request $request, Schedule $schedule)
    {
        $data = $request->validate([
            'employee_id' => ['sometimes', 'exists:employees,id'],
            'shift_id' => ['sometimes', 'exists:shifts,id'],
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'date' => ['sometimes', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $this->assertNotDoubleBooked(
            $data['employee_id'] ?? $schedule->employee_id,
            $data['date'] ?? $schedule->date,
            ignoreScheduleId: $schedule->id,
        );

        $schedule->update($data);

        return $schedule->load(['employee', 'shift', 'workLocation']);
    }

    public function destroy(Schedule $schedule)
    {
        $schedule->delete();

        return response()->noContent();
    }

    /**
     * Checked with whereDate() rather than a plain "unique" validation rule:
     * the "date" column stores through Eloquent's date cast, which doesn't
     * necessarily match a raw request string byte-for-byte, so whereDate()
     * (which normalizes both sides) is the reliable way to catch a real
     * double-booking instead of occasionally missing one.
     */
    private function assertNotDoubleBooked(int $employeeId, string $date, ?int $ignoreScheduleId = null): void
    {
        $exists = Schedule::query()
            ->where('employee_id', $employeeId)
            ->whereDate('date', $date)
            ->when($ignoreScheduleId, fn ($query) => $query->where('id', '!=', $ignoreScheduleId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'date' => ['This employee already has a schedule for that date.'],
            ]);
        }
    }
}
