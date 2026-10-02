<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\Schedule;
use App\Models\WorkSchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Reusable work schedules: per weekday, any number of IN/OUT slots, plus the
 * tolerance and overtime rules. Editing one changes what's expected from now
 * on; days already finished keep the expectation they were judged by.
 */
class WorkScheduleController extends Controller
{
    public function index(Request $request)
    {
        $today = now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();

        $schedules = WorkSchedule::query()->with('days.slots')->orderBy('name')->get();

        // How many people follow each one today — shown on the list, and why a delete may be refused.
        $current = EmployeeScheduleAssignment::query()->covering($today)
            ->whereHas('employee', fn ($q) => $q->whereNotIn('employment_status', Employee::LEFT_STATUSES))
            ->selectRaw('work_schedule_id, count(*) as total')->groupBy('work_schedule_id')
            ->pluck('total', 'work_schedule_id');

        return $schedules->map(fn (WorkSchedule $schedule) => $this->present($schedule, (int) ($current[$schedule->id] ?? 0)));
    }

    public function show(WorkSchedule $workSchedule)
    {
        return $this->present($workSchedule->load('days.slots'));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request, null);

        $schedule = DB::transaction(function () use ($data) {
            $schedule = WorkSchedule::query()->create(collect($data)->except('days')->all());
            $this->syncDays($schedule, $data['days']);

            return $schedule;
        });

        return response()->json($this->present($schedule->load('days.slots')), 201);
    }

    public function update(Request $request, WorkSchedule $workSchedule)
    {
        $data = $this->validated($request, $workSchedule);

        DB::transaction(function () use ($workSchedule, $data) {
            $workSchedule->update(collect($data)->except('days')->all());

            if (array_key_exists('days', $data)) {
                $this->syncDays($workSchedule, $data['days']);
            }
        });

        return $this->present($workSchedule->fresh()->load('days.slots'));
    }

    /**
     * A schedule people still follow (now or later), or that a future roster
     * override uses, can't be removed — set it inactive instead. Past use is
     * fine: finished days keep their own copy of what was expected.
     */
    public function destroy(Request $request, WorkSchedule $workSchedule)
    {
        $today = now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();

        $assigned = EmployeeScheduleAssignment::query()->where('work_schedule_id', $workSchedule->id)
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $today))
            ->count();
        $overrides = Schedule::query()->where('work_schedule_id', $workSchedule->id)->whereDate('date', '>=', $today)->count();

        if ($assigned > 0 || $overrides > 0) {
            $parts = array_filter([
                $assigned > 0 ? "{$assigned} ".($assigned === 1 ? 'person is' : 'people are').' assigned to it' : null,
                $overrides > 0 ? "{$overrides} upcoming roster ".($overrides === 1 ? 'day uses' : 'days use').' it' : null,
            ]);

            return response()->json([
                'message' => ucfirst(implode(' and ', $parts)).'. Move them to another schedule first, or set this one to inactive.',
                'code' => 'in_use',
            ], 422);
        }

        $workSchedule->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?WorkSchedule $schedule): array
    {
        $creating = $schedule === null;

        $data = $request->validate([
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255',
                Rule::unique('work_schedules', 'name')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')->ignore($schedule?->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'late_grace_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
            'early_leave_grace_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
            'break_minutes' => ['sometimes', 'integer', 'min:0', 'max:480'],
            'is_break_paid' => ['boolean'],
            'default_days_off' => ['sometimes', 'array'],
            'default_days_off.*' => ['integer', 'between:0,6', 'distinct'],
            'overtime_mode' => ['sometimes', Rule::in(WorkSchedule::OVERTIME_MODES)],
            'overtime_min_minutes' => ['sometimes', 'integer', 'min:0', 'max:480'],
            'overtime_count_early' => ['boolean'],
            'overtime_round_minutes' => ['sometimes', 'integer', Rule::in([0, 5, 10, 15, 30, 60])],
            'overtime_requires_approval' => ['boolean'],

            'days' => [$creating ? 'required' : 'sometimes', 'array', 'max:7'],
            'days.*.weekday' => ['required', 'integer', 'between:0,6', 'distinct'],
            'days.*.slots' => ['required', 'array', 'min:2', 'max:12'],
            'days.*.slots.*.type' => ['required', 'in:in,out'],
            'days.*.slots.*.time' => ['required', 'date_format:H:i'],
            'days.*.slots.*.next_day' => ['boolean'],
        ], [
            'days.*.slots.min' => 'Each working day needs at least one IN and one OUT.',
        ]);

        foreach ($data['days'] ?? [] as $i => $day) {
            $this->assertValidDay($day['slots'], "days.{$i}.slots");
        }

        if (array_key_exists('default_days_off', $data)) {
            $data['default_days_off'] = collect($data['default_days_off'])->map(fn ($d) => (int) $d)->sort()->values()->all();
        }

        return $data;
    }

    /**
     * A day's slots must make sense as a sequence of stretches of work: IN,
     * OUT, IN, OUT … — always starting with IN, ending with OUT — each later
     * than the one before (a "next day" slot counts as +24h), all within 24
     * hours of the first.
     */
    private function assertValidDay(array $slots, string $field): void
    {
        $previous = null;
        $first = null;

        foreach (array_values($slots) as $i => $slot) {
            $expectedType = $i % 2 === 0 ? 'in' : 'out';
            if ($slot['type'] !== $expectedType) {
                throw ValidationException::withMessages([$field => ['Slots must alternate IN, OUT, IN, OUT … starting with IN.']]);
            }

            [$hour, $minute] = array_map('intval', explode(':', $slot['time']));
            $minutes = $hour * 60 + $minute + (($slot['next_day'] ?? false) ? 1440 : 0);

            if ($previous !== null && $minutes <= $previous) {
                throw ValidationException::withMessages([$field => ["Each slot must be later than the one before it ({$slot['time']} isn't). Mark a slot after midnight as \"next day\"."]]);
            }

            $first ??= $minutes;
            $previous = $minutes;
        }

        if (count($slots) % 2 !== 0) {
            throw ValidationException::withMessages([$field => ['Every IN needs an OUT after it.']]);
        }
        if ($previous - $first >= 1440) {
            throw ValidationException::withMessages([$field => ['A day\'s slots must all fall within 24 hours.']]);
        }
    }

    /** Replaces the schedule's days and slots with exactly what was sent. */
    private function syncDays(WorkSchedule $schedule, array $days): void
    {
        $schedule->days()->delete(); // slots go with them (cascade)

        foreach ($days as $day) {
            $row = $schedule->days()->create(['weekday' => (int) $day['weekday']]);

            foreach (array_values($day['slots']) as $i => $slot) {
                $row->slots()->create([
                    'sequence' => $i + 1,
                    'type' => $slot['type'],
                    'time' => $slot['time'],
                    'next_day' => (bool) ($slot['next_day'] ?? false),
                ]);
            }
        }
    }

    private function present(WorkSchedule $schedule, ?int $assignedCount = null): array
    {
        $days = $schedule->days->map(fn ($day) => [
            'weekday' => $day->weekday,
            'slots' => $schedule->slotsFor($day->weekday),
        ])->values();

        return [
            'id' => $schedule->id,
            'name' => $schedule->name,
            'description' => $schedule->description,
            'is_active' => $schedule->is_active,
            ...$schedule->rules(),
            'default_days_off' => array_map('intval', $schedule->default_days_off ?? []),
            'days' => $days,
            // Scheduled minutes per week, for the list ("40h / week").
            'weekly_minutes' => $days->sum(fn (array $day) => $this->dayMinutes($day['slots'], $schedule)),
            ...($assignedCount === null ? [] : ['assigned_count' => $assignedCount]),
        ];
    }

    private function dayMinutes(array $slots, WorkSchedule $schedule): int
    {
        $total = 0;
        for ($i = 0; $i + 1 < count($slots); $i += 2) {
            $from = $this->minutesOf($slots[$i]);
            $total += $this->minutesOf($slots[$i + 1]) - $from;
        }

        if (count($slots) === 2 && ! $schedule->is_break_paid) {
            $total -= $schedule->break_minutes;
        }

        return max(0, $total);
    }

    private function minutesOf(array $slot): int
    {
        [$hour, $minute] = array_map('intval', explode(':', $slot['time']));

        return $hour * 60 + $minute + ($slot['next_day'] ? 1440 : 0);
    }
}
