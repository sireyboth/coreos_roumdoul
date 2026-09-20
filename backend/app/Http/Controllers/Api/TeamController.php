<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\Team;
use App\Services\EmployeeAssignmentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TeamController extends Controller
{
    public function __construct(private readonly EmployeeAssignmentService $assignments) {}

    private function rules(Request $request, bool $creating): array
    {
        return [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('company_id', $request->user()->company_id)->whereNull('deleted_at')],
            'status' => ['sometimes', 'in:active,inactive'],
        ];
    }

    /** Current, non-terminated employees per team id. */
    private function memberCounts(array $ids, bool $everyone = false): array
    {
        return EmployeeAssignment::query()
            ->whereNull('effective_to')
            ->whereIn('team_id', $ids)
            ->whereHas('employee', function ($q) use ($everyone) {
                $q->where('employment_status', '!=', 'terminated');
                if ($everyone) {
                    $q->withoutGlobalScope('branch_access');
                }
            })
            ->selectRaw('team_id, count(*) as total')
            ->groupBy('team_id')
            ->pluck('total', 'team_id')
            ->all();
    }

    public function index(Request $request)
    {
        $teams = Team::query()->with('department')->orderBy('name')
            ->paginate(min(max($request->integer('per_page', 25), 1), 200));

        $members = $this->memberCounts($teams->getCollection()->pluck('id')->all());
        $teams->getCollection()->each(fn (Team $team) => $team->setAttribute('members_count', (int) ($members[$team->id] ?? 0)));

        return $teams;
    }

    public function store(Request $request)
    {
        $team = Team::query()->create($request->validate($this->rules($request, true)));

        return response()->json($team->load('department'), 201);
    }

    public function show(Team $team)
    {
        return $team->load('department');
    }

    public function update(Request $request, Team $team)
    {
        $team->update($request->validate($this->rules($request, false)));

        return $team->load('department');
    }

    public function destroy(Team $team)
    {
        $members = $this->memberCounts([$team->id], everyone: true)[$team->id] ?? 0;

        if ($members > 0) {
            throw ValidationException::withMessages([
                'team' => ["This team still has {$members} ".($members === 1 ? 'employee' : 'employees').'. Move them to another team first, or set the team to inactive instead.'],
            ]);
        }

        $team->delete();

        return response()->noContent();
    }

    /** Adds several employees at once; they also join the team's department. */
    public function addMembers(Request $request, Team $team)
    {
        if ($team->status !== 'active') {
            throw ValidationException::withMessages(['team' => ['This team is inactive. Set it back to active before adding people.']]);
        }

        $ids = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1', 'max:200'],
            'employee_ids.*' => ['integer', 'distinct'],
        ])['employee_ids'];

        $employees = Employee::query()->with('currentAssignment')->whereIn('id', $ids)->get();

        if ($employees->count() !== count($ids)) {
            throw ValidationException::withMessages(['employee_ids' => ['Some of those employees couldn\'t be found.']]);
        }

        DB::transaction(fn () => $employees->each(fn (Employee $e) => $this->assignments->joinTeam($e, $team)));

        return ['added' => $employees->count()];
    }

    public function removeMember(Team $team, Employee $employee)
    {
        if ($employee->currentAssignment?->team_id !== $team->id) {
            throw ValidationException::withMessages(['employee' => ['This employee isn\'t in that team.']]);
        }

        $this->assignments->leaveTeam($employee);

        return response()->noContent();
    }
}
