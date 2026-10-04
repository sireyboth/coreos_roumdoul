<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeScheduleAssignment;
use App\Models\WorkSchedule;
use App\Services\ScheduleAssignmentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\ValidationException;

/**
 * Assigning work schedules to employees for a date range — one person, or
 * many at once. The timeline rules live in ScheduleAssignmentService.
 */
class ScheduleAssignmentController extends Controller
{
    public function __construct(private readonly ScheduleAssignmentService $assignments) {}

    /** Filter by employee_id and/or work_schedule_id; current_only=1 for those in force today. */
    public function index(Request $request)
    {
        $today = now($request->user()->company->timezone ?: config('attendance.default_timezone'))->toDateString();
        $manages = $request->user()->hasCompanyPermission('schedules.manage');

        return EmployeeScheduleAssignment::query()
            ->with(['workSchedule:id,name,is_active', 'employee:id,display_name,first_name,last_name,employee_code,employment_status'])
            // Through the employee, so the branch-access restriction applies — and
            // someone who can't manage the roster only ever sees their own.
            ->whereHas('employee', fn ($q) => $manages ? $q : $q->where('user_id', $request->user()->id))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->integer('employee_id')))
            ->when($request->filled('work_schedule_id'), fn ($q) => $q->where('work_schedule_id', $request->integer('work_schedule_id')))
            ->when($request->boolean('current_only'), fn ($q) => $q->covering($today))
            ->orderBy('employee_id')->orderByDesc('effective_from')
            ->limit(2000)
            ->get()
            ->map(fn (EmployeeScheduleAssignment $a) => $this->present($a, $today));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $employee = $this->employee($request, $data['employee_id']);

        $assignment = $this->assignments->assign(
            $employee, $this->schedule($data['work_schedule_id']),
            $data['effective_from'], $data['effective_to'] ?? null, $data['days_off'] ?? null, $data['notes'] ?? null,
        );

        return response()->json($this->present($assignment->load(['workSchedule', 'employee']), null), 201);
    }

    /**
     * The same schedule for many people. Each person is handled on their own:
     * someone who can't take it (e.g. a later assignment is already planned)
     * is reported and skipped, the rest are assigned.
     */
    public function bulk(Request $request)
    {
        $data = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1', 'max:500'],
            'employee_ids.*' => ['integer', 'distinct'],
            ...$this->rules($request, single: false),
        ]);

        $schedule = $this->schedule($data['work_schedule_id']);
        // Branch access applies: ids the caller can't see are simply not found.
        $employees = Employee::query()->whereIn('id', $data['employee_ids'])->get();

        if ($employees->count() !== count($data['employee_ids'])) {
            throw ValidationException::withMessages(['employee_ids' => ['Some of those employees couldn\'t be found.']]);
        }

        $assigned = 0;
        $skipped = [];

        foreach ($employees as $employee) {
            if ($employee->hasLeft()) {
                $skipped[] = ['employee_id' => $employee->id, 'name' => $employee->name, 'reason' => 'Has left the company.'];

                continue;
            }

            try {
                $this->assignments->assign($employee, $schedule, $data['effective_from'], $data['effective_to'] ?? null, $data['days_off'] ?? null, $data['notes'] ?? null);
                $assigned++;
            } catch (ValidationException $e) {
                $skipped[] = ['employee_id' => $employee->id, 'name' => $employee->name, 'reason' => collect($e->errors())->flatten()->first()];
            }
        }

        return ['assigned' => $assigned, 'skipped' => $skipped];
    }

    public function update(Request $request, EmployeeScheduleAssignment $scheduleAssignment)
    {
        $this->employee($request, $scheduleAssignment->employee_id);

        $data = $request->validate([
            'work_schedule_id' => ['sometimes', $this->ownSchedule($request)],
            'effective_from' => ['sometimes', 'date_format:Y-m-d'],
            'effective_to' => ['nullable', 'date_format:Y-m-d'],
            'days_off' => ['sometimes', 'nullable', 'array'],
            'days_off.*' => ['integer', 'between:0,6', 'distinct'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        if (isset($data['work_schedule_id'])) {
            $this->schedule($data['work_schedule_id']);
        }

        return $this->present($this->assignments->update($scheduleAssignment, $data)->load('employee'), null);
    }

    public function destroy(Request $request, EmployeeScheduleAssignment $scheduleAssignment)
    {
        $this->employee($request, $scheduleAssignment->employee_id);
        $this->assignments->remove($scheduleAssignment);

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'employee_id' => ['required', 'integer'],
            ...$this->rules($request, single: true),
        ]);
    }

    private function rules(Request $request, bool $single): array
    {
        return [
            'work_schedule_id' => ['required', $this->ownSchedule($request)],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'effective_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            // Left out: the schedule's suggested days off are used.
            'days_off' => ['nullable', 'array'],
            'days_off.*' => ['integer', 'between:0,6', 'distinct'],
            'notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    private function ownSchedule(Request $request): Exists
    {
        return Rule::exists('work_schedules', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at');
    }

    /** An inactive schedule can't be newly assigned. */
    private function schedule(int $id): WorkSchedule
    {
        $schedule = WorkSchedule::query()->findOrFail($id);

        if (! $schedule->is_active) {
            throw ValidationException::withMessages(['work_schedule_id' => ["\"{$schedule->name}\" is inactive. Set it back to active to assign it."]]);
        }

        return $schedule;
    }

    /** Goes through the company and branch-access scopes: someone you can't see can't be assigned. */
    private function employee(Request $request, int $id): Employee
    {
        $employee = Employee::query()->find($id);

        if (! $employee) {
            throw ValidationException::withMessages(['employee_id' => ['That employee couldn\'t be found.']]);
        }

        return $employee;
    }

    private function present(EmployeeScheduleAssignment $assignment, ?string $today): array
    {
        $from = $assignment->effective_from->toDateString();
        $to = $assignment->effective_to?->toDateString();

        return [
            'id' => $assignment->id,
            'employee_id' => $assignment->employee_id,
            'employee' => $assignment->employee ? [
                'id' => $assignment->employee->id,
                'name' => $assignment->employee->name,
                'employee_code' => $assignment->employee->employee_code,
                // Someone who left still has their assignment on record, but no longer "follows" it.
                'has_left' => $assignment->employee->hasLeft(),
            ] : null,
            'work_schedule' => $assignment->workSchedule ? [
                'id' => $assignment->workSchedule->id,
                'name' => $assignment->workSchedule->name,
                'is_active' => $assignment->workSchedule->is_active,
            ] : null,
            'effective_from' => $from,
            'effective_to' => $to,
            'days_off' => $assignment->daysOff(),
            'notes' => $assignment->notes,
            ...($today === null ? [] : [
                'state' => $from > $today ? 'upcoming' : ($to !== null && $to < $today ? 'ended' : 'current'),
            ]),
        ];
    }
}
