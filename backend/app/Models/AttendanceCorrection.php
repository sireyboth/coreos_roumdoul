<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use App\Services\AuditLogger;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceCorrection extends Model
{
    use Auditable, BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'employee_id',
        'session_id',
        'date',
        'requested_by',
        'reason',
        'requested_check_in',
        'requested_check_out',
        'requested_scans',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'requested_check_in' => 'datetime',
            'requested_check_out' => 'datetime',
            // UTC instants, like requested_check_in/out.
            'requested_scans' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Every scan time this correction asks to add, oldest first. Newer
     * requests list them in requested_scans; older ones only ever had a
     * check-in and/or a check-out.
     *
     * @return array<int, Carbon>
     */
    /** The same times as ISO strings, for the API (`requested_times`). */
    public function getRequestedTimesAttribute(): array
    {
        return array_map(fn (Carbon $time) => $time->toIso8601String(), $this->requestedTimes());
    }

    public function requestedTimes(): array
    {
        $times = $this->requested_scans
            ? array_map(fn (string $time) => Carbon::parse($time), $this->requested_scans)
            : array_filter([$this->requested_check_in, $this->requested_check_out]);

        usort($times, fn (Carbon $a, Carbon $b) => $a->getTimestamp() <=> $b->getTimestamp());

        return array_values($times);
    }

    /**
     * Records the decision only if the request is still pending, in one
     * conditional UPDATE — so of two managers deciding at the same moment,
     * exactly one wins. Returns false for the one that lost. Audited like a
     * normal update.
     */
    public function decide(string $status, int $reviewerId, ?string $notes): bool
    {
        $changes = ['status' => $status, 'reviewed_by' => $reviewerId, 'reviewed_at' => now(), 'review_notes' => $notes];

        $claimed = static::query()->withoutGlobalScopes()->whereKey($this->getKey())->where('status', 'pending')->update($changes);

        if (! $claimed) {
            return false;
        }

        AuditLogger::record(static::auditEventName('updated'), $this, $changes, beforeData: ['status' => 'pending']);
        $this->refresh();

        return true;
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
