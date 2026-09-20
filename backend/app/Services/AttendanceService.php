<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceEvent;
use App\Models\AttendanceSession;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\WorkLocation;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Owns the evidence-to-record pipeline: raw AttendanceEvent rows are never
 * edited, but this is what turns them into the AttendanceSession record
 * that History/Reports/Payroll actually read, and what applies an approved
 * correction on top of that record without touching the original evidence.
 */
class AttendanceService
{
    public function checkIn(Employee $employee, array $data): AttendanceEvent
    {
        $today = Carbon::today();

        $existing = AttendanceSession::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $today)
            ->first();

        if ($existing?->check_in_event_id) {
            throw ValidationException::withMessages([
                'event_type' => ['Already checked in today.'],
            ]);
        }

        $workLocation = $this->resolveWorkLocation($employee, $data);

        $event = AttendanceEvent::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_location_id' => $workLocation?->id ?? $data['work_location_id'] ?? null,
            'event_type' => 'check_in',
            'event_time' => now(),
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'device_id' => $data['device_id'] ?? null,
            'recorded_by' => $data['recorded_by'] ?? null,
        ]);

        $schedule = Schedule::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $today)
            ->with('shift')
            ->first();

        $lateMinutes = 0;

        if ($schedule) {
            $shiftStart = Carbon::parse($today->toDateString().' '.$schedule->shift->start_time);
            $graceEnd = $shiftStart->copy()->addMinutes($schedule->shift->grace_minutes);

            if ($event->event_time->gt($graceEnd)) {
                $lateMinutes = $graceEnd->diffInMinutes($event->event_time);
            }
        }

        AttendanceSession::query()->updateOrCreate(
            ['employee_id' => $employee->id, 'date' => $today],
            [
                'company_id' => $employee->company_id,
                'schedule_id' => $schedule?->id,
                'check_in_event_id' => $event->id,
                'late_minutes' => $lateMinutes,
                'status' => 'open',
            ],
        );

        return $event;
    }

    public function checkOut(Employee $employee, array $data): AttendanceEvent
    {
        // Deliberately not scoped to "today": an overnight shift can check
        // in before midnight and check out after it, so this looks up the
        // employee's still-open session (whichever date it was opened on)
        // rather than assuming check-in and check-out share a calendar day.
        $session = AttendanceSession::query()
            ->where('employee_id', $employee->id)
            ->whereNotNull('check_in_event_id')
            ->whereNull('check_out_event_id')
            ->latest('date')
            ->first();

        if (! $session?->check_in_event_id) {
            throw ValidationException::withMessages([
                'event_type' => ['You need to check in before you can check out.'],
            ]);
        }

        $workLocation = $this->resolveWorkLocation($employee, $data);

        $event = AttendanceEvent::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_location_id' => $workLocation?->id ?? $data['work_location_id'] ?? null,
            'event_type' => 'check_out',
            'event_time' => now(),
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'device_id' => $data['device_id'] ?? null,
            'recorded_by' => $data['recorded_by'] ?? null,
        ]);

        $checkIn = $session->checkInEvent;
        $breakMinutes = $session->schedule?->shift?->break_minutes ?? 0;
        $workedMinutes = max(0, $checkIn->event_time->diffInMinutes($event->event_time) - $breakMinutes);

        $session->update([
            'check_out_event_id' => $event->id,
            'worked_minutes' => $workedMinutes,
            'status' => 'completed',
        ]);

        return $event;
    }

    /**
     * A QR scan identifies the work location directly (proves presence at
     * that physical spot, GPS or not). A plain work_location_id + GPS pair
     * is the fallback for companies not using QR yet. Whenever both a
     * resolved location's own coordinates and the device's GPS are present,
     * the device must actually be within the location's radius — closing
     * the gap where GPS fields were recorded but never checked.
     */
    private function resolveWorkLocation(Employee $employee, array $data): ?WorkLocation
    {
        $workLocation = null;

        if (! empty($data['qr_token'])) {
            $workLocation = WorkLocation::query()
                ->where('company_id', $employee->company_id)
                ->where('qr_token', $data['qr_token'])
                ->first();

            if (! $workLocation) {
                throw ValidationException::withMessages([
                    'qr_token' => ['This QR code isn\'t recognized. Ask your manager for a fresh one.'],
                ]);
            }
        } elseif (! empty($data['work_location_id'])) {
            $workLocation = WorkLocation::query()
                ->where('company_id', $employee->company_id)
                ->find($data['work_location_id']);
        }

        if (
            $workLocation
            && $workLocation->latitude !== null
            && $workLocation->longitude !== null
            && isset($data['latitude'], $data['longitude'])
        ) {
            $distance = $workLocation->distanceInMetersTo((float) $data['latitude'], (float) $data['longitude']);

            if ($distance > $workLocation->radius_meters) {
                throw ValidationException::withMessages([
                    'latitude' => ["You're too far from {$workLocation->name} to check in (".round($distance)."m away)."],
                ]);
            }
        }

        return $workLocation;
    }

    public function approveCorrection(AttendanceCorrection $correction, int $reviewerId, ?string $notes = null): AttendanceSession
    {
        $session = AttendanceSession::query()->updateOrCreate(
            ['employee_id' => $correction->employee_id, 'date' => $correction->date],
            ['company_id' => $correction->company_id],
        );

        if ($correction->requested_check_in) {
            $checkInEvent = AttendanceEvent::query()->create([
                'company_id' => $correction->company_id,
                'employee_id' => $correction->employee_id,
                'event_type' => 'check_in',
                'event_time' => $correction->requested_check_in,
                'recorded_by' => $reviewerId,
                'notes' => "Correction #{$correction->id}: {$correction->reason}",
            ]);
            $session->check_in_event_id = $checkInEvent->id;
        }

        if ($correction->requested_check_out) {
            $checkOutEvent = AttendanceEvent::query()->create([
                'company_id' => $correction->company_id,
                'employee_id' => $correction->employee_id,
                'event_type' => 'check_out',
                'event_time' => $correction->requested_check_out,
                'recorded_by' => $reviewerId,
                'notes' => "Correction #{$correction->id}: {$correction->reason}",
            ]);
            $session->check_out_event_id = $checkOutEvent->id;
        }

        if ($session->checkInEvent && $session->checkOutEvent) {
            $session->worked_minutes = max(0, $session->checkInEvent->event_time->diffInMinutes($session->checkOutEvent->event_time));
            $session->status = 'completed';
        }

        $session->save();

        $correction->update([
            'session_id' => $session->id,
            'status' => 'approved',
            'reviewed_by' => $reviewerId,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);

        return $session;
    }
}
