<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One date a request covers: a whole day (1.0) or a morning / afternoon (0.5).
 * pay_percent is null unless the approver chose differently from the leave
 * type (e.g. a day of unpaid leave that is paid after all).
 */
class EmployeeRequestDay extends Model
{
    public $timestamps = false;

    // Plain dates, so lookups by date match on every database (SQLite would add 00:00:00).
    protected $dateFormat = 'Y-m-d';

    protected $fillable = ['employee_request_id', 'employee_id', 'date', 'portion', 'part', 'pay_percent'];

    protected function casts(): array
    {
        return ['date' => 'date', 'portion' => 'float', 'pay_percent' => 'integer'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(EmployeeRequest::class, 'employee_request_id');
    }

    /** What this day pays: the approver's choice, else the leave type's. */
    public function payPercent(): int
    {
        return $this->pay_percent ?? (int) ($this->request->leaveType?->pay_percent ?? 100);
    }
}
