<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DayOff;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\Schedule;
use App\Models\WorkSchedule;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\ValidationException;

/**
 * The roster: one-day overrides on top of each person's assigned schedule —
 * "on this date, Dara works the Split Shift". An entry wins over the
 * assignment (and over a holiday: it's how a manager opens on one). Every
 * change recalculates the day it touches; a locked month can't be changed.
 */
class ScheduleController extends Controller
{
    private const WITH = ['employee.currentAssignment', 'workSchedule.days.slots', 'workLocation'];

    public function __construct(private readonly AttendanceRecorder $recorder) {}

    public function index(Request $request)
    {
        $query = Schedule::query()->with(self::WITH)->whereNotNull('work_schedule_id');

        // Someone who can't manage the roster only ever sees their own —
        // e.g. a rank-and-file employee checking when they're working.
        if (! $request->user()->hasCompanyPermission('schedules.manage')) {
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

        // per_page (max 2000) lets a month view load a whole company's roster at once.
        return $query->orderBy('date')->orderBy('id')->paginate(min(max($request->integer('per_page', 50), 1), 2000));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer'],
            'work_schedule_id' => ['required', $this->ownSchedule($request)],
            'work_location_id' => ['nullable', $this->ownLocation($request)],
            'date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $employee = $this->employee($data['employee_id']);
        $this->assertActiveSchedule($data['work_schedule_id']);
        $this->recorder->assertUnlocked($employee->company_id, $data['date']);
        $this->assertNotDoubleBooked($employee->id, $data['date']);
        $this->assertNotOnDayOff($employee->id, $data['date']);

        $schedule = Schedule::query()->create($data);
        $this->recalculate($employee, [$data['date']]);

        return response()->json($schedule->load(self::WITH), 201);
    }

    /**
     * Rosters many employees at once: every chosen employee gets the schedule
     * on every date in the range that falls on a chosen weekday. Days that
     * can't take it are skipped and counted, never overwritten or failed on —
     * a holiday, a day off, someone who has left, a date that already has an
     * entry, or a weekday the schedule has no hours on. With dry_run it only
     * reports what it would do.
     */
    public function bulk(Request $request)
    {
        $companyId = $request->user()->company_id;
        $maxDays = 93;
        $maxEntries = 3000;

        $data = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1', 'max:100'],
            'employee_ids.*' => ['integer', 'distinct'],
            'work_schedule_id' => ['required', $this->ownSchedule($request)],
            'work_location_id' => ['nullable', $this->ownLocation($request)],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'weekdays' => ['nullable', 'array'],
            'weekdays.*' => ['integer', 'between:0,6', 'distinct'],
            'skip_holidays' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:255'],
            'dry_run' => ['boolean'],
        ]);

        $workSchedule = $this->assertActiveSchedule($data['work_schedule_id'])->load('days.slots');

        $from = CarbonImmutable::createFromFormat('Y-m-d', $data['from'])->startOfDay();
        $to = CarbonImmutable::createFromFormat('Y-m-d', $data['to'])->startOfDay();

        if ($from->diffInDays($to) + 1 > $maxDays) {
            throw ValidationException::withMessages(['to' => ["Pick a range of at most {$maxDays} days at a time."]]);
        }

        for ($month = $from->startOfMonth(); $month->lte($to); $month = $month->addMonth()) {
            $this->recorder->assertUnlocked($companyId, $month->toDateString(), 'from');
        }

        // Through the company and branch-access scopes, so ids the caller
        // can't see (or that belong to another company) are rejected.
        $employees = Employee::query()->whereIn('id', $data['employee_ids'])->get();
        if ($employees->count() !== count($data['employee_ids'])) {
            throw ValidationException::withMessages(['employee_ids' => ['Some of those employees couldn\'t be found.']]);
        }

        $weekdays = $data['weekdays'] ?? [0, 1, 2, 3, 4, 5, 6];
        $dates = [];
        for ($day = $from; $day <= $to; $day = $day->addDay()) {
            if (in_array($day->dayOfWeek, $weekdays, true)) {
                $dates[] = $day;
            }
        }

        if (count($dates) === 0) {
            throw ValidationException::withMessages(['weekdays' => ['None of the chosen weekdays fall inside that date range.']]);
        }

        if (count($dates) * $employees->count() > $maxEntries) {
            throw ValidationException::withMessages(['employee_ids' => ["That would create more than {$maxEntries} entries at once. Use fewer people or a shorter range."]]);
        }

        $ids = $employees->pluck('id');
        $fromDate = $from->toDateString();
        $toDate = $to->toDateString();

        // whereDate keeps this identical across databases (see assertNotDoubleBooked).
        $taken = Schedule::query()->whereIn('employee_id', $ids)
            ->whereDate('date', '>=', $fromDate)->whereDate('date', '<=', $toDate)->get()
            ->mapWithKeys(fn (Schedule $s) => [$s->employee_id.'|'.$s->date->toDateString() => true]);
        $off = DayOff::query()->whereIn('employee_id', $ids)
            ->whereDate('date', '>=', $fromDate)->whereDate('date', '<=', $toDate)->get()
            ->mapWithKeys(fn (DayOff $d) => [$d->employee_id.'|'.$d->date->toDateString() => true]);

        $holidays = ($data['skip_holidays'] ?? true)
            ? Holiday::query()->where(fn ($q) => $q->whereDate('date', '>=', $fromDate)->whereDate('date', '<=', $toDate)->orWhere('is_recurring_yearly', true))->get()
            : collect();
        $isHoliday = fn (CarbonImmutable $day) => $holidays->contains(fn (Holiday $h) => $h->is_recurring_yearly
            ? $h->date->format('m-d') === $day->format('m-d')
            : $h->date->toDateString() === $day->toDateString());

        $skipped = ['holiday' => 0, 'day_off' => 0, 'already_scheduled' => 0, 'employee_left' => 0, 'no_hours' => 0];
        $rows = [];
        $now = now();

        foreach ($employees as $employee) {
            if ($employee->employment_status === 'terminated') {
                $skipped['employee_left'] += count($dates);

                continue;
            }

            foreach ($dates as $day) {
                $date = $day->toDateString();

                if ($workSchedule->slotsFor($day->dayOfWeek) === []) {
                    $skipped['no_hours']++;
                } elseif ($isHoliday($day)) {
                    $skipped['holiday']++;
                } elseif ($off->has($employee->id.'|'.$date)) {
                    $skipped['day_off']++;
                } elseif ($taken->has($employee->id.'|'.$date)) {
                    $skipped['already_scheduled']++;
                } else {
                    $rows[] = [
                        'company_id' => $companyId,
                        'employee_id' => $employee->id,
                        'work_schedule_id' => $workSchedule->id,
                        'work_location_id' => $data['work_location_id'] ?? null,
                        'date' => $date,
                        'notes' => $data['notes'] ?? null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        $dryRun = (bool) ($data['dry_run'] ?? false);

        if (! $dryRun && $rows !== []) {
            DB::transaction(function () use ($rows) {
                // insertOrIgnore: if someone else booked a date a moment ago,
                // the unique (employee, date) rule skips it instead of aborting.
                foreach (array_chunk($rows, 500) as $chunk) {
                    Schedule::query()->insertOrIgnore($chunk);
                }
            });

            // One audit entry for the whole batch (the bulk insert bypasses per-row auditing).
            AuditLogger::record('schedule.bulk_created', $workSchedule, [
                'employees' => $employees->count(), 'from' => $fromDate, 'to' => $toDate, 'created' => count($rows),
            ], $companyId);

            // Days already passed now have a different plan.
            foreach (collect($rows)->groupBy('employee_id') as $employeeId => $entries) {
                $this->recalculate($employees->firstWhere('id', $employeeId), $entries->pluck('date')->all());
            }
        }

        return [
            'dry_run' => $dryRun,
            'created' => count($rows),
            'skipped' => $skipped,
        ];
    }

    public function show(Schedule $schedule)
    {
        return $schedule->load(self::WITH);
    }

    public function update(Request $request, Schedule $schedule)
    {
        $data = $request->validate([
            'employee_id' => ['sometimes', 'integer'],
            'work_schedule_id' => ['sometimes', $this->ownSchedule($request)],
            'work_location_id' => ['nullable', $this->ownLocation($request)],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $before = ['employee' => $schedule->employee, 'date' => $schedule->date->toDateString()];
        $employee = isset($data['employee_id']) ? $this->employee($data['employee_id']) : $schedule->employee;
        $date = $data['date'] ?? $before['date'];

        if (isset($data['work_schedule_id']) && (int) $data['work_schedule_id'] !== $schedule->work_schedule_id) {
            $this->assertActiveSchedule($data['work_schedule_id']);
        }
        $this->recorder->assertUnlocked($employee->company_id, $before['date']);
        $this->recorder->assertUnlocked($employee->company_id, $date);
        $this->assertNotDoubleBooked($employee->id, $date, ignoreScheduleId: $schedule->id);
        $this->assertNotOnDayOff($employee->id, $date);

        $schedule->update($data);

        $this->recalculate($before['employee'], [$before['date']]);
        $this->recalculate($employee, [$date]);

        return $schedule->load(self::WITH);
    }

    public function destroy(Schedule $schedule)
    {
        $date = $schedule->date->toDateString();
        $this->recorder->assertUnlocked($schedule->company_id, $date);

        $employee = $schedule->employee;
        $schedule->delete();
        $this->recalculate($employee, [$date]);

        return response()->noContent();
    }

    /** Recalculates the given dates that have already started (future days have nothing recorded). */
    private function recalculate(?Employee $employee, array $dates): void
    {
        if (! $employee) {
            return;
        }

        $today = now($employee->company->timezone ?: config('attendance.default_timezone'))->toDateString();
        $past = collect($dates)->filter(fn (string $date) => $date <= $today)->sort()->values();

        if ($past->isNotEmpty()) {
            // One pass over the span is cheaper than one per date for a bulk roster.
            $this->recorder->recalculateRange($employee, $past->first(), $past->last());
        }
    }

    private function ownSchedule(Request $request): Exists
    {
        return Rule::exists('work_schedules', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at');
    }

    private function ownLocation(Request $request): Exists
    {
        return Rule::exists('work_locations', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at');
    }

    private function assertActiveSchedule(int $id): WorkSchedule
    {
        $schedule = WorkSchedule::query()->findOrFail($id);

        if (! $schedule->is_active) {
            throw ValidationException::withMessages(['work_schedule_id' => ["\"{$schedule->name}\" is inactive. Pick an active schedule."]]);
        }

        return $schedule;
    }

    /** Through the company and branch-access scopes: someone you can't see can't be rostered. */
    private function employee(int $id): Employee
    {
        $employee = Employee::query()->find($id);

        if (! $employee) {
            throw ValidationException::withMessages(['employee_id' => ['That employee couldn\'t be found.']]);
        }

        return $employee;
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
                'date' => ['This employee already has a roster entry for that date.'],
            ]);
        }
    }

    private function assertNotOnDayOff(int $employeeId, mixed $date): void
    {
        if (DayOff::query()->where('employee_id', $employeeId)->whereDate('date', $date)->exists()) {
            throw ValidationException::withMessages([
                'date' => ['This employee is marked as off that day. Remove the day off first.'],
            ]);
        }
    }
}
