<?php

namespace App\Services\Attendance;

use App\Models\AttendanceCorrection;
use App\Models\CompanyMembership;
use App\Models\Employee;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * In-app alerts for attendance requests that wait on a decision.
 *
 *  - A new request alerts everyone who can decide it: active users with
 *    attendance.manage who can see the employee's branch — never the
 *    requester, and never a manager limited to other branches.
 *  - A decision alerts the requester (and the employee, if someone asked
 *    on their behalf), and resolves the other managers' alerts so nobody
 *    acts on it twice.
 *
 * Alerts are sent only after the surrounding transaction commits, so a
 * request that failed to save never alerts anyone; each has a dedupe key,
 * so a retry never alerts twice.
 */
class AttendanceNotifier
{
    public const LINK_CORRECTIONS = '/dashboard/attendance?tab=corrections';

    public function correctionRequested(AttendanceCorrection $correction, User $requester): void
    {
        $employee = $correction->employee;
        $timezone = $this->timezone($employee);
        $times = collect($correction->requestedTimes())->map(fn (Carbon $time) => $time->copy()->setTimezone($timezone)->format('H:i'))->join(', ');

        $this->requestCreated(
            subject: $correction,
            employee: $employee,
            requester: $requester,
            type: 'attendance.correction_requested',
            title: "Correction request from {$employee->name}",
            body: $this->dateLabel($correction->date).": add {$times} — {$correction->reason}",
            link: self::LINK_CORRECTIONS,
        );
    }

    public function correctionDecided(AttendanceCorrection $correction, User $reviewer): void
    {
        $this->requestDecided(
            subject: $correction,
            employee: $correction->employee,
            requesterId: $correction->requested_by,
            reviewer: $reviewer,
            requestType: 'attendance.correction_requested',
            type: 'attendance.correction_decided',
            title: "Your correction for {$this->dateLabel($correction->date)} was {$correction->status}",
            body: collect(["By {$reviewer->name}.", $correction->review_notes ? "Note: {$correction->review_notes}" : null])->filter()->join(' '),
            link: self::LINK_CORRECTIONS,
        );
    }

    /** Alerts everyone who can decide this request. */
    public function requestCreated(Model $subject, Employee $employee, User $requester, string $type, string $title, ?string $body, string $link): void
    {
        DB::afterCommit(function () use ($subject, $employee, $requester, $type, $title, $body, $link) {
            foreach ($this->managersFor($employee, except: $requester) as $manager) {
                NotificationService::send(
                    $manager, $type, $title, $body,
                    data: ['employee_id' => $employee->id, 'employee_name' => $employee->name],
                    subject: $subject,
                    actor: $requester,
                    link: $link,
                    dedupeKey: "{$type}:{$subject->getMorphClass()}:{$subject->getKey()}:{$manager->id}",
                );
            }
        });
    }

    /** Closes the other managers' alerts and tells the requester (and employee) the outcome. */
    public function requestDecided(Model $subject, Employee $employee, ?int $requesterId, User $reviewer, string $requestType, string $type, string $title, ?string $body, string $link): void
    {
        $decision = (string) $subject->getAttribute('status');

        DB::afterCommit(function () use ($subject, $employee, $requesterId, $reviewer, $requestType, $type, $title, $body, $link, $decision) {
            NotificationService::resolve($subject, $requestType, $decision, $reviewer);

            $recipients = User::query()
                ->whereIn('id', array_filter([$requesterId, $employee->user_id]))
                ->where('id', '!=', $reviewer->id)
                ->where('is_active', true)
                ->get();

            foreach ($recipients as $recipient) {
                NotificationService::send(
                    $recipient, $type, $title, $body,
                    data: ['decision' => $decision],
                    subject: $subject,
                    actor: $reviewer,
                    link: $link,
                    dedupeKey: "{$type}:{$subject->getMorphClass()}:{$subject->getKey()}:{$recipient->id}",
                );
            }
        });
    }

    /**
     * Who can decide a request about $employee: active members with
     * attendance.manage whose branch access (if limited) covers the
     * employee's branch. An employee with no branch only reaches managers
     * with no branch limit.
     *
     * @return Collection<int, User>
     */
    public function managersFor(Employee $employee, ?User $except = null): Collection
    {
        $branchId = $employee->currentAssignment?->branch_id;

        return CompanyMembership::query()
            ->where('company_id', $employee->company_id)
            ->where('status', 'active')
            ->when($except, fn (Builder $q) => $q->where('user_id', '!=', $except->id))
            ->whereHas('user', fn (Builder $q) => $q->where('is_active', true))
            ->whereHas('roles.permissions', fn (Builder $q) => $q->where('code', 'attendance.manage'))
            ->where(fn (Builder $q) => $q
                ->whereDoesntHave('branchAccess')
                ->when($branchId, fn (Builder $q) => $q->orWhereHas('branchAccess', fn (Builder $b) => $b->where('branch_id', $branchId))))
            ->with('user')
            ->get()
            ->pluck('user')
            ->filter()
            ->unique('id')
            ->values();
    }

    private function dateLabel(mixed $date): string
    {
        return Carbon::parse($date)->format('D j M');
    }

    private function timezone(Employee $employee): string
    {
        return $employee->company?->timezone ?: config('attendance.default_timezone');
    }
}
