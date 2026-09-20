<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceEvent;
use App\Models\AttendanceSession;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\Shift;
use App\Models\WorkLocation;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;

/**
 * Owns the evidence-to-record pipeline: raw AttendanceEvent rows are never
 * edited, but this is what turns them into the AttendanceSession record
 * that History/Reports/Payroll actually read, and what applies an approved
 * correction on top of that record without touching the original evidence.
 *
 * "Today", shift start times and the day a session belongs to are all read
 * in the company's own timezone — the server itself runs on UTC, which for
 * Cambodia (UTC+7) would put shift times seven hours off and roll the day
 * over at 7 AM.
 */
class AttendanceService
{
    public function checkIn(Employee $employee, array $data): AttendanceEvent
    {
        $this->assertEmployeeMayCheckIn($employee);
        $this->closeStaleSessions($employee);

        $timezone = $this->timezoneFor($employee);
        $localDate = now()->setTimezone($timezone)->toDateString();

        $existing = AttendanceSession::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $localDate)
            ->first();

        if ($existing?->check_in_event_id) {
            throw ValidationException::withMessages([
                'event_type' => [
                    $existing->status === 'missing_checkout'
                        ? 'Your earlier check-in today was never closed. Ask your manager to fix it with a correction request.'
                        : 'Already checked in today.',
                ],
            ]);
        }

        // A shift from an earlier day that's still open (e.g. a night shift
        // not yet checked out of) has to be closed before starting another.
        if ($open = $this->openSession($employee)) {
            throw ValidationException::withMessages([
                'event_type' => ["You're still checked in from {$open->date->toDateString()}. Check out first."],
            ]);
        }

        $schedule = Schedule::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $localDate)
            ->with('shift')
            ->first();

        // No roster entry means no defined start time, so lateness and worked
        // hours would be meaningless — the manager has to schedule them first.
        if (! $schedule && config('attendance.require_schedule')) {
            throw ValidationException::withMessages([
                'schedule' => ["You aren't scheduled for a shift today. Ask your manager to add you to the roster."],
            ]);
        }

        $workLocation = $this->resolveWorkLocation($employee, $data, forCheckIn: true, schedule: $schedule);

        $event = AttendanceEvent::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_location_id' => $workLocation->id,
            'event_type' => 'check_in',
            'method' => $this->methodFor($data),
            'event_time' => now(),
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'device_id' => $data['device_id'] ?? null,
            'recorded_by' => $data['recorded_by'] ?? null,
        ]);

        AttendanceSession::query()->updateOrCreate(
            ['employee_id' => $employee->id, 'date' => $localDate],
            [
                'company_id' => $employee->company_id,
                'schedule_id' => $schedule?->id,
                'check_in_event_id' => $event->id,
                'late_minutes' => $this->lateMinutes($schedule?->shift, $localDate, $event->event_time, $timezone),
                'status' => 'open',
            ],
        );

        return $event;
    }

    public function checkOut(Employee $employee, array $data): AttendanceEvent
    {
        $this->closeStaleSessions($employee);

        // Deliberately not scoped to "today": an overnight shift can check
        // in before midnight and check out after it, so this looks up the
        // employee's still-open session (whichever date it was opened on)
        // rather than assuming check-in and check-out share a calendar day.
        $session = $this->openSession($employee);

        if (! $session) {
            $forgotten = AttendanceSession::query()
                ->where('employee_id', $employee->id)
                ->where('status', 'missing_checkout')
                ->latest('date')
                ->first();

            throw ValidationException::withMessages([
                'event_type' => [
                    $forgotten
                        ? "Your check-in on {$forgotten->date->toDateString()} was never closed, so it can't be checked out of now. Ask your manager to fix it with a correction request, then check in as normal."
                        : 'You need to check in before you can check out.',
                ],
            ]);
        }

        $workLocation = $this->resolveWorkLocation($employee, $data, forCheckIn: false, schedule: $session->schedule);

        $event = AttendanceEvent::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_location_id' => $workLocation->id,
            'event_type' => 'check_out',
            'method' => $this->methodFor($data),
            'event_time' => now(),
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'device_id' => $data['device_id'] ?? null,
            'recorded_by' => $data['recorded_by'] ?? null,
        ]);

        $session->update([
            'check_out_event_id' => $event->id,
            'worked_minutes' => $this->workedMinutes($session->checkInEvent->event_time, $event->event_time, $session->schedule?->shift),
            'status' => 'completed',
        ]);

        return $event;
    }

    /**
     * Marks shifts that were never checked out of as "missing_checkout", so
     * a forgotten check-out stops blocking the employee's next check-in and
     * shows up for a manager to correct. Runs for one employee whenever they
     * check in/out, and for everyone on a schedule (attendance:close-stale).
     */
    public function closeStaleSessions(?Employee $employee = null): int
    {
        $cutoff = now()->subHours((int) config('attendance.stale_after_hours', 16));

        return AttendanceSession::query()
            ->when($employee, fn ($query) => $query->where('employee_id', $employee->id))
            ->where('status', 'open')
            ->whereNull('check_out_event_id')
            ->whereHas('checkInEvent', fn ($query) => $query->where('event_time', '<', $cutoff))
            ->get()
            ->each(fn (AttendanceSession $session) => $session->update(['status' => 'missing_checkout']))
            ->count();
    }

    private function openSession(Employee $employee): ?AttendanceSession
    {
        return AttendanceSession::query()
            ->where('employee_id', $employee->id)
            ->where('status', 'open')
            ->whereNotNull('check_in_event_id')
            ->whereNull('check_out_event_id')
            ->latest('date')
            ->first();
    }

    private function assertEmployeeMayCheckIn(Employee $employee): void
    {
        if (in_array($employee->employment_status, ['terminated', 'suspended'], true)) {
            throw ValidationException::withMessages([
                'employee' => ["Your employment status is \"{$employee->employment_status}\", so you can't check in. Ask your manager."],
            ]);
        }
    }

    private function methodFor(array $data): string
    {
        return ! empty($data['qr_token']) ? 'qr' : 'gps';
    }

    /**
     * Every check-in/out must prove presence, at a place the employee is
     * actually allowed to be:
     *  - a QR scan identifies the location directly (works with no GPS);
     *  - GPS on its own is matched to the nearest of THEIR locations and must
     *    be inside its radius;
     *  - whenever GPS comes along with a QR scan (or a location id), it must
     *    also be inside that location's radius.
     * Sending neither is rejected — there'd be nothing to check.
     */
    private function resolveWorkLocation(Employee $employee, array $data, bool $forCheckIn, ?Schedule $schedule): WorkLocation
    {
        $hasGps = isset($data['latitude'], $data['longitude']);
        $verb = $forCheckIn ? 'check in' : 'check out';
        $allowed = $this->allowedLocations($employee, $schedule);

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

            $this->assertLocationAllowed($employee, $allowed, $workLocation, $verb);
        } elseif (! empty($data['work_location_id']) && $hasGps) {
            $workLocation = WorkLocation::query()
                ->where('company_id', $employee->company_id)
                ->find($data['work_location_id']);

            if (! $workLocation) {
                throw ValidationException::withMessages(['work_location_id' => ['That location doesn\'t exist.']]);
            }

            $this->assertLocationAllowed($employee, $allowed, $workLocation, $verb);
        } elseif ($hasGps) {
            $workLocation = $this->nearestLocation($employee, $allowed, (float) $data['latitude'], (float) $data['longitude'], $forCheckIn);
        } else {
            throw ValidationException::withMessages([
                'verification' => ["Scan your branch's QR code or share your location to {$verb}."],
            ]);
        }

        if ($forCheckIn && ! $workLocation->is_active) {
            throw ValidationException::withMessages([
                'qr_token' => ["{$workLocation->name} is no longer active, so you can't check in there."],
            ]);
        }

        // A site that requires location won't accept a scan the phone couldn't
        // back with a position — that's what stops a photo of the poster
        // being used from home. The code lets the app fetch the position and retry.
        if ($workLocation->require_location && ! $hasGps) {
            $message = "{$workLocation->name} needs your location to {$verb}. Turn on location for this site and try again.";

            throw new HttpResponseException(response()->json([
                'message' => $message,
                'code' => 'location_required',
                'errors' => ['latitude' => [$message]],
            ], 422));
        }

        if ($hasGps && $workLocation->latitude !== null && $workLocation->longitude !== null) {
            $distance = $workLocation->distanceInMetersTo((float) $data['latitude'], (float) $data['longitude']);

            if ($distance > $workLocation->radius_meters) {
                throw ValidationException::withMessages([
                    'latitude' => ["You're too far from {$workLocation->name} to {$verb} (".round($distance).'m away).'],
                ]);
            }
        }

        return $workLocation;
    }

    /**
     * Where this employee may check in: their own branch, any location that
     * isn't tied to a branch (company-wide), and — so a manager can send them
     * elsewhere for a day — the location on that day's schedule. An employee
     * with no branch assignment isn't restricted.
     */
    private function allowedLocations(Employee $employee, ?Schedule $schedule): Builder
    {
        $query = WorkLocation::query()->where('company_id', $employee->company_id);
        $branchId = $employee->currentAssignment?->branch_id;

        if ($branchId === null) {
            return $query;
        }

        return $query->where(function (Builder $where) use ($branchId, $schedule) {
            $where->whereNull('branch_id')->orWhere('branch_id', $branchId);

            if ($schedule?->work_location_id) {
                $where->orWhere('id', $schedule->work_location_id);
            }
        });
    }

    private function assertLocationAllowed(Employee $employee, Builder $allowed, WorkLocation $workLocation, string $verb): void
    {
        if ((clone $allowed)->whereKey($workLocation->id)->exists()) {
            return;
        }

        $branch = $this->assignedBranchName($employee);

        throw ValidationException::withMessages([
            'qr_token' => ["This is the {$workLocation->name} code. You're assigned to {$branch}, so you can only {$verb} there."],
        ]);
    }

    private function assignedBranchName(Employee $employee): string
    {
        $branchId = $employee->currentAssignment?->branch_id;

        return ($branchId ? Branch::query()->find($branchId)?->name : null) ?? 'your branch';
    }

    /**
     * For a GPS-only check-in there's no branch to compare against, so use
     * the closest one of the employee's own — and insist the phone is
     * actually inside it.
     */
    private function nearestLocation(Employee $employee, Builder $allowed, float $latitude, float $longitude, bool $activeOnly): WorkLocation
    {
        $candidates = (clone $allowed)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->get();

        if ($candidates->isEmpty()) {
            throw ValidationException::withMessages([
                'latitude' => ['No check-in location is set up for your branch yet. Ask your admin.'],
            ]);
        }

        $nearest = $candidates->sortBy(fn (WorkLocation $location) => $location->distanceInMetersTo($latitude, $longitude))->first();
        $distance = $nearest->distanceInMetersTo($latitude, $longitude);

        if ($distance > $nearest->radius_meters) {
            throw ValidationException::withMessages([
                'latitude' => ["You're not near {$nearest->name} — you're ".round($distance).'m away.'],
            ]);
        }

        return $nearest;
    }

    private function timezoneFor(Employee $employee): string
    {
        return $employee->company?->timezone ?: config('attendance.default_timezone');
    }

    /**
     * Minutes past the shift's start plus its grace period. Zero with no
     * scheduled shift. The shift's "08:00" is 08:00 in the company's
     * timezone, not on the server's clock.
     */
    private function lateMinutes(?Shift $shift, string $localDate, Carbon $checkedInAt, string $timezone): int
    {
        if (! $shift) {
            return 0;
        }

        $graceEnd = Carbon::parse("{$localDate} {$shift->start_time}", $timezone)->addMinutes($shift->grace_minutes);

        return $checkedInAt->gt($graceEnd) ? (int) $graceEnd->diffInMinutes($checkedInAt) : 0;
    }

    /**
     * Time between check-in and check-out, less the shift's break — unless
     * that break is paid, in which case it counts as worked time.
     */
    private function workedMinutes(Carbon $checkedInAt, Carbon $checkedOutAt, ?Shift $shift): int
    {
        $unpaidBreak = $shift && ! $shift->is_break_paid ? $shift->break_minutes : 0;

        return max(0, (int) $checkedInAt->diffInMinutes($checkedOutAt) - $unpaidBreak);
    }

    public function approveCorrection(AttendanceCorrection $correction, int $reviewerId, ?string $notes = null): AttendanceSession
    {
        $timezone = $this->timezoneFor($correction->employee);
        $localDate = Carbon::parse($correction->date)->toDateString();

        $session = AttendanceSession::query()->updateOrCreate(
            ['employee_id' => $correction->employee_id, 'date' => $localDate],
            ['company_id' => $correction->company_id],
        );

        $schedule = Schedule::query()
            ->where('employee_id', $correction->employee_id)
            ->whereDate('date', $localDate)
            ->with('shift')
            ->first();

        if ($schedule) {
            $session->schedule_id = $schedule->id;
        }

        if ($correction->requested_check_in) {
            $checkInEvent = AttendanceEvent::query()->create([
                'company_id' => $correction->company_id,
                'employee_id' => $correction->employee_id,
                'event_type' => 'check_in',
                'method' => 'correction',
                'event_time' => $correction->requested_check_in,
                'recorded_by' => $reviewerId,
                'notes' => "Correction #{$correction->id}: {$correction->reason}",
            ]);
            $session->check_in_event_id = $checkInEvent->id;
            $session->late_minutes = $this->lateMinutes($schedule?->shift, $localDate, $checkInEvent->event_time, $timezone);
        }

        if ($correction->requested_check_out) {
            $checkOutEvent = AttendanceEvent::query()->create([
                'company_id' => $correction->company_id,
                'employee_id' => $correction->employee_id,
                'event_type' => 'check_out',
                'method' => 'correction',
                'event_time' => $correction->requested_check_out,
                'recorded_by' => $reviewerId,
                'notes' => "Correction #{$correction->id}: {$correction->reason}",
            ]);
            $session->check_out_event_id = $checkOutEvent->id;
        }

        if ($session->checkInEvent && $session->checkOutEvent) {
            $session->worked_minutes = $this->workedMinutes(
                $session->checkInEvent->event_time,
                $session->checkOutEvent->event_time,
                $schedule?->shift,
            );
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
