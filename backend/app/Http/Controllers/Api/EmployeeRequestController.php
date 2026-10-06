<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Models\EmployeeRequestDay;
use App\Models\LeaveType;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Requests\ApprovalChain;
use App\Services\Requests\EmployeeRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Requests (leave for now): send your own, see your own; approve the ones
 * waiting on you. Who may decide is ApprovalChain's call — a line manager
 * needs no extra permission to decide their own team's requests.
 *
 * Lists (`scope`):
 *  - mine       requests about me
 *  - approvals  waiting for a decision I can make (never my own)
 *  - all        everything in the branches I cover (requests.manage)
 */
class EmployeeRequestController extends Controller
{
    public function __construct(
        private readonly EmployeeRequestService $requests,
        private readonly ApprovalChain $chain,
    ) {}

    public function index(Request $request)
    {
        $data = $request->validate([
            'scope' => ['nullable', Rule::in(['mine', 'approvals', 'all'])],
            'status' => ['nullable', Rule::in(EmployeeRequest::STATUSES)],
            'employee_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);
        $user = $request->user();
        $scope = $data['scope'] ?? 'mine';

        $query = EmployeeRequest::query()->with($this->relations());

        match ($scope) {
            'mine' => $query->whereHas('employee', fn (Builder $q) => $q->withoutGlobalScope('branch_access')->where('user_id', $user->id)),
            'approvals' => $this->waitingOn($query, $user),
            'all' => $user->hasCompanyPermission(ApprovalChain::MANAGE) ? $query->whereHas('employee') : abort(403),
        };

        $page = $query
            ->when($data['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($data['employee_id'] ?? null, fn (Builder $q, int $id) => $q->where('employee_id', $id))
            // Overlapping the period, not only starting in it.
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('end_date', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('start_date', '<=', $to))
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('start_date')->orderByDesc('id')
            ->paginate($data['per_page'] ?? 50);

        $page->getCollection()->transform(fn (EmployeeRequest $r) => $this->present($r, $user));

        return $page;
    }

    /** How many are waiting on me — for the menu badge. */
    public function waitingCount(Request $request)
    {
        return ['count' => $this->waitingOn(EmployeeRequest::query(), $request->user())->count()];
    }

    public function show(Request $request, EmployeeRequest $employeeRequest)
    {
        $employeeRequest->load($this->relations());
        abort_unless($this->canSee($request->user(), $employeeRequest), 404);

        return $this->present($employeeRequest, $request->user());
    }

    /** The days, balance and problems a request would have — nothing is saved. */
    public function preview(Request $request)
    {
        [$employee, $type, $data] = $this->input($request, withFile: false);

        return $type === null
            ? $this->requests->previewLateEarly($employee, $data)
            : $this->requests->preview($request->user(), $employee, $type, $data);
    }

    public function store(Request $request)
    {
        [$employee, $type, $data] = $this->input($request, withFile: true);

        $approveNow = (bool) ($data['approve'] ?? false);
        $created = $type === null
            ? $this->requests->submitLateEarly($request->user(), $employee, $data, $request->file('attachment'), $approveNow)
            : $this->requests->submit($request->user(), $employee, $type, $data, $request->file('attachment'), $approveNow);

        return response()->json($this->present($created->load($this->relations()), $request->user()), 201);
    }

    public function approve(Request $request, EmployeeRequest $employeeRequest)
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:500']]);
        $this->assertVisible($request->user(), $employeeRequest);

        $done = $this->requests->approve($request->user(), $employeeRequest, $data['notes'] ?? null);

        return $this->present($done->load($this->relations()), $request->user());
    }

    public function reject(Request $request, EmployeeRequest $employeeRequest)
    {
        // A "no" always comes with a reason the employee can read.
        $data = $request->validate(['notes' => ['required', 'string', 'max:500']]);
        $this->assertVisible($request->user(), $employeeRequest);

        $done = $this->requests->reject($request->user(), $employeeRequest, $data['notes']);

        return $this->present($done->load($this->relations()), $request->user());
    }

    public function cancel(Request $request, EmployeeRequest $employeeRequest)
    {
        $this->assertVisible($request->user(), $employeeRequest);
        // Withdrawing your own needs no reason; cancelling someone else's leave needs a remark they can read.
        $own = $this->chain->isAbout($request->user(), $employeeRequest) || $employeeRequest->requested_by === $request->user()->id;
        $data = $request->validate(['reason' => [$own ? 'nullable' : 'required', 'string', 'max:500']]);

        $done = $this->requests->cancel($request->user(), $employeeRequest, $data['reason'] ?? null);

        return $this->present($done->load($this->relations()), $request->user());
    }

    /** Permanently removes the chosen requests (e.g. test data). All are checked first, so either all go or none do. */
    public function destroyMany(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['required', 'integer', 'distinct'],
        ]);

        $requests = EmployeeRequest::query()->with($this->relations())->whereKey($data['ids'])->get()
            ->filter(fn (EmployeeRequest $r) => $this->chain->covers($request->user(), $r->employee));
        if ($requests->count() !== count($data['ids'])) {
            throw ValidationException::withMessages(['ids' => ['Some of those requests no longer exist or are outside your branches. Reload and try again.']]);
        }

        $locked = $requests->where('status', 'approved')
            ->map(fn (EmployeeRequest $r) => $this->requests->lockedMonth($r->employee, $r->start_date->toDateString(), $r->end_date->toDateString()))
            ->filter()->first();
        if ($locked) {
            throw ValidationException::withMessages(['ids' => [$locked]]);
        }

        foreach ($requests as $employeeRequest) {
            AuditLogger::record('request.deleted', $employeeRequest, [], $employeeRequest->company_id, [
                'employee' => $employeeRequest->employee?->name,
                'type' => $employeeRequest->label(),
                'status' => $employeeRequest->status,
                'start_date' => $employeeRequest->start_date->toDateString(),
                'end_date' => $employeeRequest->end_date->toDateString(),
            ]);
            $this->requests->delete($employeeRequest);
        }

        return response()->json(['deleted' => $requests->count()]);
    }

    /** A request's file, through the short-lived signed link in its `url`. */
    public function attachment(Request $request, int $attachment)
    {
        $file = Attachment::query()->withoutGlobalScopes()->findOrFail($attachment);

        return Storage::disk($file->disk)->response($file->path, $file->original_name, [
            'Content-Type' => $file->mime,
            'Cache-Control' => 'private, max-age=600',
            // Shown in the browser (a PDF or photo), never run as a page.
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        ], 'inline');
    }

    /** Pending requests I can decide: my reports' (as their line manager) and my branches' (requests.manage) — never my own. */
    private function waitingOn(Builder $query, User $user): Builder
    {
        return $query->where('status', 'pending')
            ->where(function (Builder $q) use ($user) {
                $q->whereHas('approval.steps', fn (Builder $s) => $s->where('status', 'pending')->where('kind', 'manager')->where('approver_user_id', $user->id));

                if ($user->hasCompanyPermission(ApprovalChain::MANAGE)) {
                    // Through Employee, so the branch limit applies.
                    $q->orWhereHas('employee');
                }
            })
            ->whereHas('employee', fn (Builder $e) => $e->withoutGlobalScope('branch_access')
                ->where(fn (Builder $x) => $x->whereNull('user_id')->orWhere('user_id', '!=', $user->id)));
    }

    /**
     * @return array{0: Employee, 1: ?LeaveType, 2: array<string, mixed>} the leave type is null for a late / early request
     */
    private function input(Request $request, bool $withFile): array
    {
        $user = $request->user();
        $lateEarly = $request->input('type') === 'late_early';
        $data = $request->validate([
            'type' => ['nullable', Rule::in(EmployeeRequest::TYPES)],
            'employee_id' => ['nullable', 'integer'],
            // Late arrival / early leave: one date, which end of the day, and the time.
            'kind' => [$lateEarly ? 'required' : 'prohibited', Rule::in(['late', 'early'])],
            'time' => [$lateEarly ? 'required' : 'prohibited', 'date_format:H:i'],
            'leave_type_id' => [$lateEarly ? 'prohibited' : 'required', 'integer', Rule::exists('leave_types', 'id')->where('company_id', $user->company_id)],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'day_part' => ['nullable', Rule::in(EmployeeRequest::DAY_PARTS)],
            // Leave may say why; asking to come late or leave early always does (checked when sending, not previewing).
            'reason' => [$lateEarly && $withFile ? 'required' : 'nullable', 'string', 'max:1000'],
            'approve' => ['nullable', 'boolean'],
            ...($withFile ? ['attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240']] : []),
        ]);

        $own = $user->employee;
        $employeeId = $data['employee_id'] ?? $own?->id;

        if (! $employeeId) {
            throw ValidationException::withMessages(['employee_id' => ['Your account isn\'t linked to an employee record yet.']]);
        }

        // Unscoped lookup: a line manager may be in another branch, yet only
        // someone who covers the employee may send a request for them.
        $employee = Employee::query()->withoutGlobalScope('branch_access')->with('currentAssignment', 'company')->findOrFail($employeeId);

        if ($employee->id !== $own?->id && ! $this->chain->covers($user, $employee)) {
            abort(403, 'You can only send requests for yourself.');
        }

        return [$employee, $lateEarly ? null : LeaveType::query()->findOrFail($data['leave_type_id']), $data];
    }

    private function canSee(User $user, EmployeeRequest $request): bool
    {
        return $this->chain->isAbout($user, $request)
            || $request->requested_by === $user->id
            || $this->chain->covers($user, $request->employee)
            || $request->approval?->steps->contains('approver_user_id', $user->id);
    }

    private function assertVisible(User $user, EmployeeRequest $request): void
    {
        $request->load($this->relations());
        abort_unless($this->canSee($user, $request), 404);
    }

    private function relations(): array
    {
        return [
            'employee' => fn ($q) => $q->withoutGlobalScope('branch_access')->with('currentAssignment', 'branch'),
            'leaveType', 'requestedBy', 'decidedBy', 'cancelledBy', 'dates', 'attachments',
            'approval.steps.approverUser', 'approval.steps.actedBy',
        ];
    }

    private function present(EmployeeRequest $r, User $viewer): array
    {
        $step = $this->chain->currentStep($r);
        $person = fn (?User $u) => $u ? ['id' => $u->id, 'name' => $u->name] : null;
        $isOwn = $this->chain->isAbout($viewer, $r) || $r->requested_by === $viewer->id;
        $today = now($r->employee->company?->timezone ?: config('attendance.default_timezone'))->toDateString();

        return [
            'id' => $r->id,
            'type' => $r->type,
            // In words: "Annual leave", "Late arrival", "Early leave".
            'label' => $r->label(),
            // late_early: {kind, time, minutes}.
            'details' => $r->details,
            'status' => $r->status,
            'employee' => ['id' => $r->employee->id, 'name' => $r->employee->name, 'branch' => $r->employee->branch?->name],
            'leave_type' => $r->leaveType ? [
                'id' => $r->leaveType->id, 'code' => $r->leaveType->code, 'name' => $r->leaveType->name,
                'name_km' => $r->leaveType->name_km, 'pay_percent' => $r->leaveType->pay_percent,
            ] : null,
            'start_date' => $r->start_date->toDateString(),
            'end_date' => $r->end_date->toDateString(),
            'day_part' => $r->day_part,
            'days' => $r->days,
            'dates' => $r->dates->map(fn (EmployeeRequestDay $d) => ['date' => $d->date->toDateString(), 'portion' => $d->portion, 'part' => $d->part])->values(),
            'reason' => $r->reason,
            'attachments' => $r->attachments->map(fn (Attachment $a) => [
                'id' => $a->id, 'name' => $a->original_name, 'mime' => $a->mime, 'size' => $a->size, 'url' => $a->url,
            ])->values(),
            'requested_by' => $person($r->requestedBy),
            'created_at' => $r->created_at?->toIso8601String(),
            // Who it is waiting on, in words: a named manager or "an approver".
            'waiting_on' => $r->isPending() && $step ? ($step->kind === 'manager' ? $person($step->approverUser) : null) : null,
            'decided_by' => $person($r->decidedBy),
            'decided_at' => $r->decided_at?->toIso8601String(),
            'decision_notes' => $r->decision_notes,
            'cancelled_by' => $person($r->cancelledBy),
            'cancelled_at' => $r->cancelled_at?->toIso8601String(),
            'cancel_reason' => $r->cancel_reason,
            'can' => [
                'decide' => $this->chain->canDecide($viewer, $r),
                'cancel' => in_array($r->status, EmployeeRequest::ACTIVE_STATUSES, true)
                    && ($this->chain->covers($viewer, $r->employee)
                        || ($isOwn && ($r->isPending() || $r->start_date->toDateString() > $today))),
                'delete' => $this->chain->covers($viewer, $r->employee),
            ],
        ];
    }
}
