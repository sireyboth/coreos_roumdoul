<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use WeakMap;

/**
 * Reusable across every module: call record() whenever an action described
 * in the spec's audit list happens (employee created, leave approved, module
 * toggled, etc.) rather than each module inventing its own logging.
 *
 * Each row answers who (actor), what (event + subject_label + before/after),
 * when (created_at), where (branch_id, ip, device, method + path) — and
 * branch_id is also what keeps a branch-limited manager to their own rows.
 */
class AuditLogger
{
    /** Branch and label read just before a delete, while the record (and its assignment) still exist. */
    private static ?WeakMap $beforeDelete = null;

    /**
     * @param  array<string, mixed>  $afterData  The state after the event — for a plain action (e.g. "role.created") just the relevant fields; for a full snapshot, everything.
     * @param  array<string, mixed>  $beforeData  The state before the event, when known (e.g. an update's original values). Left empty for creates.
     */
    public static function record(
        string $event,
        ?Model $subject = null,
        array $afterData = [],
        ?int $companyId = null,
        array $beforeData = [],
        ?string $reason = null,
    ): AuditLog {
        // The actor can be a tenant User or a PlatformAdmin (e.g. a platform
        // admin granting a module override) — two separate identity systems
        // since Part 1, so this is polymorphic rather than a plain FK.
        $actor = Auth::user();
        $remembered = $subject ? (self::$beforeDelete[$subject] ?? null) : null;
        // Only a real HTTP call has a "where in the app"; a scheduled job doesn't.
        $route = request()?->route();

        $log = AuditLog::query()->create([
            // The record's own company first: a scheduled job has no signed-in
            // user, and its rows must still show up in that company's log.
            'company_id' => $companyId ?? $subject?->getAttributes()['company_id'] ?? ($actor instanceof User ? $actor->company_id : null),
            'branch_id' => $remembered['branch_id'] ?? self::branchIdFor($subject),
            'actor_type' => $actor?->getMorphClass(),
            'actor_id' => $actor?->getKey(),
            'event' => $event,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'subject_label' => $remembered['label'] ?? self::labelFor($subject),
            'reason' => $reason,
            'before_data' => $beforeData ?: null,
            'after_data' => $afterData ?: null,
            'request_id' => request()?->header('X-Request-Id'),
            'method' => $route ? request()->method() : null,
            'path' => $route ? Str::limit(request()->getPathInfo(), 250, '') : null,
            'ip_address' => request()?->ip(),
            'user_agent' => Str::limit((string) request()?->userAgent(), 250, '') ?: null,
        ]);

        // A new employee's branch comes from the assignment opened right after
        // the employee row, in the same transaction: look again once it's saved.
        if ($log->branch_id === null && $subject && DB::transactionLevel() > 0) {
            DB::afterCommit(function () use ($log, $subject) {
                if ($branchId = self::branchIdFor($subject)) {
                    $log->forceFill(['branch_id' => $branchId])->saveQuietly();
                }
            });
        }

        return $log;
    }

    /** Called from a model's "deleting" event: once it's gone, its branch can't be looked up any more. */
    public static function rememberBeforeDelete(Model $subject): void
    {
        self::$beforeDelete ??= new WeakMap;
        self::$beforeDelete[$subject] = ['branch_id' => self::branchIdFor($subject), 'label' => self::labelFor($subject)];
    }

    /**
     * The branch a record belongs to: the branch itself, a record with its own
     * branch_id, or the branch of the employee it's about. Null = company-wide
     * (a role, a pay rule, a holiday…).
     */
    public static function branchIdFor(?Model $subject): ?int
    {
        if (! $subject) {
            return null;
        }

        if ($subject instanceof Branch) {
            return $subject->getKey();
        }

        $attributes = $subject->getAttributes();

        if (! empty($attributes['branch_id'])) {
            return (int) $attributes['branch_id'];
        }

        $employeeId = self::employeeIdFor($subject);

        if (! $employeeId) {
            return null;
        }

        // The current assignment, or the last one for someone who has left.
        $branchId = EmployeeAssignment::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employeeId)
            ->orderByRaw('effective_to IS NULL DESC')
            ->orderByDesc('id')
            ->value('branch_id');

        return $branchId ? (int) $branchId : null;
    }

    /** A readable "what" that still makes sense after the record is deleted. */
    public static function labelFor(?Model $subject): ?string
    {
        if (! $subject) {
            return null;
        }

        $attributes = $subject->getAttributes();

        if ($subject instanceof Employee || $subject instanceof User) {
            $label = $subject->name;
        } elseif ($employeeId = self::employeeIdFor($subject)) {
            $label = Employee::query()->withoutGlobalScopes()->find($employeeId)?->name;
        } else {
            $label = $attributes['name'] ?? $attributes['title'] ?? $attributes['code'] ?? null;
        }

        return $label ? Str::limit((string) $label, 250) : null;
    }

    private static function employeeIdFor(Model $subject): ?int
    {
        if ($subject instanceof Employee) {
            return $subject->getKey();
        }

        if ($subject instanceof User) {
            return Employee::query()->withoutGlobalScopes()->where('user_id', $subject->getKey())->value('id');
        }

        $employeeId = $subject->getAttributes()['employee_id'] ?? null;

        return $employeeId ? (int) $employeeId : null;
    }
}
