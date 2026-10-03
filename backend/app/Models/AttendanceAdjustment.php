<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An admin's direct fix to one employee's day (see AttendanceService::adjustDay):
 * who made it, why, and which scan times were removed and added. The scans
 * themselves are voided / created separately; this is the readable history.
 */
class AttendanceAdjustment extends Model
{
    use BelongsToCompany;

    protected $hidden = ['company_id'];

    protected $fillable = ['company_id', 'employee_id', 'date', 'adjusted_by', 'reason', 'removed', 'added'];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'removed' => 'array',
            'added' => 'array',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function adjustedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }
}
