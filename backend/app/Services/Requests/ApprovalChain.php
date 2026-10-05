<?php

namespace App\Services\Requests;

use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Models\User;
use App\Services\Attendance\AttendanceNotifier;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Who decides a request. Worked out once, when it is sent, and kept — a
 * manager who changes later doesn't move requests already waiting.
 *
 *  - The employee's line manager, if they have one with an active login.
 *  - Otherwise anyone with requests.manage who covers the employee's branch.
 *
 * Nobody ever decides their own request: a line manager asking for their own
 * leave goes to the branch approvers. And nobody is stuck waiting on an
 * absent manager — anyone with requests.manage for the branch can step in on
 * the manager's step too; the step records who actually acted.
 */
final class ApprovalChain
{
    public const MANAGE = 'requests.manage';

    public function __construct(private readonly AttendanceNotifier $directory) {}

    public function start(EmployeeRequest $request): ApprovalStep
    {
        $approval = ApprovalRequest::query()->create([
            'company_id' => $request->company_id,
            'approvable_type' => $request->getMorphClass(),
            'approvable_id' => $request->id,
            'requested_by_user_id' => $request->requested_by ?? $request->employee->user_id,
            'status' => 'pending',
        ]);

        $manager = $this->lineManagerUser($request->employee);
        $selfApproval = $manager && in_array($manager->id, array_filter([$request->requested_by, $request->employee->user_id]), true);

        return $approval->steps()->create($manager && ! $selfApproval
            ? ['step_number' => 1, 'kind' => 'manager', 'approver_user_id' => $manager->id, 'status' => 'pending']
            : ['step_number' => 1, 'kind' => 'permission', 'approver_user_id' => null, 'status' => 'pending']);
    }

    public function currentStep(EmployeeRequest $request): ?ApprovalStep
    {
        return $request->approval?->steps->firstWhere('status', 'pending');
    }

    /** May $user approve or reject this request now? */
    public function canDecide(User $user, EmployeeRequest $request): bool
    {
        if (! $request->isPending() || $this->isAbout($user, $request)) {
            return false;
        }

        $step = $this->currentStep($request);

        return ($step?->kind === 'manager' && $step->approver_user_id === $user->id)
            || $this->covers($user, $request->employee);
    }

    /** Can $user act for the company on this employee's requests (requests.manage, their branch)? */
    public function covers(User $user, Employee $employee): bool
    {
        if (! $user->hasCompanyPermission(self::MANAGE) || $user->company_id !== $employee->company_id) {
            return false;
        }

        $branches = $user->membership?->accessibleBranchIds();
        $branchId = $employee->currentAssignment?->branch_id;

        return $branches === null || ($branchId !== null && in_array($branchId, $branches, true));
    }

    /** True when the request is about $user themselves. */
    public function isAbout(User $user, EmployeeRequest $request): bool
    {
        return $request->employee?->user_id === $user->id;
    }

    /**
     * Who should hear that a request is waiting: the line manager on their
     * step, otherwise the branch approvers — never the employee themselves.
     *
     * @return Collection<int, User>
     */
    public function approversToNotify(EmployeeRequest $request): Collection
    {
        // The waiting step — or, once it is over (e.g. withdrawn), the step it was waiting on.
        $step = $this->currentStep($request) ?? $request->approval?->steps->last();

        $people = $step?->kind === 'manager' && $step->approverUser?->is_active
            ? collect([$step->approverUser])
            : $this->directory->managersFor($request->employee, permission: self::MANAGE);

        return $people
            ->reject(fn (User $user) => in_array($user->id, array_filter([$request->employee->user_id, $request->requested_by]), true))
            ->values();
    }

    /** Closes the chain with the final decision; the step records who acted. */
    public function finish(EmployeeRequest $request, string $decision, User $by, ?string $comment = null): void
    {
        $approval = $request->approval;

        if (! $approval) {
            return;
        }

        $this->currentStep($request)?->update([
            'status' => $decision, 'acted_at' => now(), 'acted_by_user_id' => $by->id, 'comment' => $comment === null ? null : Str::limit($comment, 250),
        ]);
        $approval->update(['status' => $decision]);
    }

    private function lineManagerUser(Employee $employee): ?User
    {
        $managerId = $employee->currentAssignment?->manager_employee_id;

        if (! $managerId) {
            return null;
        }

        $user = Employee::query()->withoutGlobalScopes()->whereKey($managerId)->first()?->user;

        return $user?->is_active && $user->membership?->status === 'active' ? $user : null;
    }
}
