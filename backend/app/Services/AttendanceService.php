<?php

namespace App\Services;

use App\Models\AttendanceCorrection;
use App\Models\AttendanceDay;
use App\Models\AttendanceEvent;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\WorkLocation;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\ExpectedDay;
use App\Services\Attendance\ScheduleResolver;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;

/**
 * Turns presence into evidence: a scan is checked (who, where, not a double
 * tap, not in a locked month) and stored as a raw AttendanceEvent, which is
 * never edited. The day it belongs to is then recalculated, which is where
 * the scan is matched to a slot — the employee never says whether a scan is
 * an IN or an OUT; the schedule does.
 *
 * Approved corrections add scans the same way (marked as corrections), so the
 * original evidence is never rewritten.
 *
 * "Today" and every schedule time are read in the company's own timezone —
 * the server runs on UTC, which for Cambodia (UTC+7) would put times seven
 * hours off and roll the day over at 7 AM.
 */
class AttendanceService
{
    public function __construct(private readonly AttendanceRecorder $recorder) {}

    /**
     * Records one scan and recalculates its day.
     *
     * @return array{event: AttendanceEvent, day: AttendanceDay|null, slot: array|null}
     *                                                                                  slot: the expected slot this scan answered (null if it matched none)
     */
    public function scan(Employee $employee, array $data): array
    {
        $this->assertEmployeeMayScan($employee);

        $now = CarbonImmutable::now();
        $resolver = ScheduleResolver::around($employee->company, $employee->id, $now->setTimezone($this->timezoneFor($employee))->toDateString());
        $workDate = $this->recorder->workDateFor($employee, $now, $resolver);
        $expected = $resolver->resolve($employee->id, $workDate);

        // Without a schedule there's nothing to judge the scan against — the
        // manager has to assign one first. Scans on a day off are allowed
        // (they're flagged as work on a day off).
        if ($expected->kind === 'unscheduled' && config('attendance.require_schedule')) {
            throw ValidationException::withMessages([
                'schedule' => ["You don't have a work schedule for today. Ask your manager to assign you one."],
            ]);
        }

        $this->recorder->assertUnlocked($employee->company_id, $workDate);
        $this->assertNotDoubleTap($employee, $now);

        $workLocation = $this->resolveWorkLocation($employee, $data, $expected);

        $event = AttendanceEvent::query()->create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'work_location_id' => $workLocation->id,
            'event_type' => null,
            'method' => $this->methodFor($data),
            'event_time' => $now,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'device_id' => $data['device_id'] ?? null,
            'recorded_by' => $data['recorded_by'] ?? null,
        ]);

        $day = $this->recorder->recalculate($employee, $workDate);
        $slot = collect($day?->slots ?? [])->firstWhere('scan_id', $event->id);
        // The day before may have closed since it was last looked at (e.g. a
        // forgotten OUT) — settle it now rather than waiting for the hourly job.
        $this->recorder->settlePreviousDay($employee, $workDate);

        return ['event' => $event, 'day' => $day, 'slot' => $slot];
    }

    /**
     * Today's plan for the person, for the scan screen: what's expected, what's
     * been scanned, and which slot comes next.
     */
    public function today(Employee $employee): array
    {
        $now = CarbonImmutable::now();
        $resolver = ScheduleResolver::around($employee->company, $employee->id, $now->setTimezone($this->timezoneFor($employee))->toDateString());
        $workDate = $this->recorder->workDateFor($employee, $now, $resolver);
        $expected = $resolver->resolve($employee->id, $workDate);
        $day = $this->recorder->recalculate($employee, $workDate);

        $slots = $day?->slots ?? array_map(fn (array $slot) => [
            'sequence' => $slot['sequence'],
            'type' => $slot['type'],
            'expected_at' => $slot['at']->toIso8601String(),
            'scan_id' => null,
            'actual_at' => null,
            'status' => 'pending',
            'late_minutes' => 0,
            'early_minutes' => 0,
        ], $expected->slots);

        return [
            'date' => $workDate,
            'kind' => $expected->kind,
            'label' => $expected->label,
            'schedule' => $expected->scheduleName,
            'slots' => $slots,
            'next' => collect($slots)->first(fn (array $slot) => $slot['actual_at'] === null && $slot['status'] !== 'missing'),
            'day' => $day,
        ];
    }

    /**
     * Applies an approved correction: each requested time becomes a scan
     * (marked as a correction, attributed to the reviewer), then the day is
     * recalculated. Nothing already recorded is changed or removed.
     */
    public function approveCorrection(AttendanceCorrection $correction, int $reviewerId, ?string $notes = null): ?AttendanceDay
    {
        $employee = $correction->employee;
        $date = Carbon::parse($correction->date)->toDateString();
        $this->recorder->assertUnlocked($employee->company_id, $date, 'status');

        foreach ($correction->requestedTimes() as $time) {
            AttendanceEvent::query()->create([
                'company_id' => $correction->company_id,
                'employee_id' => $correction->employee_id,
                'event_type' => null,
                'method' => 'correction',
                'event_time' => $time,
                'recorded_by' => $reviewerId,
                'notes' => "Correction #{$correction->id}: {$correction->reason}",
            ]);
        }

        $correction->update([
            'status' => 'approved',
            'reviewed_by' => $reviewerId,
            'reviewed_at' => now(),
            'review_notes' => $notes,
        ]);

        // A night shift's correction can add a scan on the next calendar day; recalculate both.
        $days = $this->recorder->recalculateRange($employee, $date, CarbonImmutable::parse($date)->addDay()->toDateString());

        return $days->get($date);
    }

    private function assertEmployeeMayScan(Employee $employee): void
    {
        if (in_array($employee->employment_status, ['terminated', 'suspended'], true)) {
            throw ValidationException::withMessages([
                'employee' => ["Your employment status is \"{$employee->employment_status}\", so you can't check in. Ask your manager."],
            ]);
        }
    }

    /** A second tap within a couple of minutes is a mistake, not a new scan. */
    private function assertNotDoubleTap(Employee $employee, CarbonImmutable $now): void
    {
        $window = (int) config('attendance.duplicate_scan_minutes', 2);
        $last = AttendanceEvent::query()
            ->where('employee_id', $employee->id)
            ->where('event_time', '>', $now->subMinutes($window))
            ->latest('event_time')
            ->first();

        if ($last) {
            $time = $last->event_time->setTimezone($this->timezoneFor($employee))->format('H:i');

            throw ValidationException::withMessages([
                'scan' => ["You already scanned at {$time}. Wait a moment before scanning again."],
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
    private function resolveWorkLocation(Employee $employee, array $data, ExpectedDay $expected): WorkLocation
    {
        $hasGps = isset($data['latitude'], $data['longitude']);
        // One action now covers both; the schedule decides which it was.
        $verb = 'check in or out';
        $allowed = $this->allowedLocations($employee, $expected->workLocationId);

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
            $workLocation = $this->nearestLocation($employee, $allowed, (float) $data['latitude'], (float) $data['longitude'], true);
        } else {
            throw ValidationException::withMessages([
                'verification' => ["Scan your branch's QR code or share your location to {$verb}."],
            ]);
        }

        if (! $workLocation->is_active) {
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
     * elsewhere for a day — the location set on that day's roster override. An employee
     * with no branch assignment isn't restricted.
     */
    private function allowedLocations(Employee $employee, ?int $overrideLocationId): Builder
    {
        $query = WorkLocation::query()->where('company_id', $employee->company_id);
        $branchId = $employee->currentAssignment?->branch_id;

        if ($branchId === null) {
            return $query;
        }

        return $query->where(function (Builder $where) use ($branchId, $overrideLocationId) {
            $where->whereNull('branch_id')->orWhere('branch_id', $branchId);

            if ($overrideLocationId) {
                $where->orWhere('id', $overrideLocationId);
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
}
