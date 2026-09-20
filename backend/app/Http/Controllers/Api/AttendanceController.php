<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSession;
use App\Services\AttendanceService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $query = AttendanceSession::query()->with([
            'employee.branch',
            'schedule.shift',
            'checkInEvent.workLocation',
            'checkInEvent.recordedBy:id,name',
            'checkOutEvent.workLocation',
            'checkOutEvent.recordedBy:id,name',
        ]);

        if (! $request->user()->hasCompanyPermission('attendance.manage')) {
            $query->whereHas('employee', fn ($q) => $q->where('user_id', $request->user()->id));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('date', '<=', $request->date('to'));
        }

        return $query->orderByDesc('date')->paginate(50);
    }

    public function checkIn(Request $request, AttendanceService $attendance)
    {
        $employee = $this->requireEmployee($request);

        $data = $request->validate([
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'qr_token' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ]);

        $event = $attendance->checkIn($employee, $data);

        return response()->json($event, 201);
    }

    public function checkOut(Request $request, AttendanceService $attendance)
    {
        $employee = $this->requireEmployee($request);

        $data = $request->validate([
            'work_location_id' => ['nullable', 'exists:work_locations,id'],
            'qr_token' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'device_id' => ['nullable', 'string', 'max:255'],
        ]);

        $event = $attendance->checkOut($employee, $data);

        return response()->json($event, 201);
    }

    private function requireEmployee(Request $request)
    {
        $employee = $request->user()->employee;

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee' => ['Your account isn\'t linked to an employee record yet.'],
            ]);
        }

        return $employee;
    }
}
