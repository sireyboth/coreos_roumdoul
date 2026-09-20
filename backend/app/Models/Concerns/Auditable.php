<?php

namespace App\Models\Concerns;

use App\Services\AuditLogger;
use Illuminate\Support\Str;

/**
 * Automatic, reusable audit logging: any model that uses this trait gets its
 * create/update/delete events recorded without every controller or Filament
 * resource having to remember to call AuditLogger itself. This is what makes
 * "Module enabled/disabled" and "Subscription changed" (both edited only
 * through Filament, never through a custom controller) show up in the audit
 * log for free.
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function ($model) {
            AuditLogger::record(static::auditEventName('created'), $model, $model->getAttributes());
        });

        static::updated(function ($model) {
            $changes = $model->getChanges();
            unset($changes['updated_at']);

            if (empty($changes)) {
                return;
            }

            $before = collect($model->getOriginal())->only(array_keys($changes))->all();

            AuditLogger::record(static::auditEventName('updated'), $model, $changes, beforeData: $before);
        });

        static::deleted(function ($model) {
            AuditLogger::record(static::auditEventName('deleted'), $model, beforeData: $model->getAttributes());
        });
    }

    protected static function auditEventName(string $action): string
    {
        return Str::snake(class_basename(static::class)).'.'.$action;
    }
}
