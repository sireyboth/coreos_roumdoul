<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Reusable across every module: call record() whenever an action described
 * in the spec's audit list happens (employee created, leave approved, module
 * toggled, etc.) rather than each module inventing its own logging.
 */
class AuditLogger
{
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

        return AuditLog::query()->create([
            'company_id' => $companyId ?? ($actor instanceof User ? $actor->company_id : null),
            'actor_type' => $actor?->getMorphClass(),
            'actor_id' => $actor?->getKey(),
            'event' => $event,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'reason' => $reason,
            'before_data' => $beforeData ?: null,
            'after_data' => $afterData ?: null,
            'request_id' => request()?->header('X-Request-Id'),
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
        ]);
    }
}
