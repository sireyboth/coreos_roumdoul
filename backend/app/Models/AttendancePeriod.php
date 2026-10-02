<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A closed month (YYYY-MM): once payroll has used its numbers, the
 * attendance in it can't change any more — no scans, corrections, overrides
 * or recalculation — until it is reopened.
 */
class AttendancePeriod extends Model
{
    use Auditable, BelongsToCompany;

    protected $fillable = ['company_id', 'month', 'locked_at', 'locked_by'];

    protected function casts(): array
    {
        return ['locked_at' => 'datetime'];
    }

    public function lockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }
}
