<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One date a request covers: a whole day (1.0) or a morning / afternoon (0.5). */
class EmployeeRequestDay extends Model
{
    public $timestamps = false;

    // Plain dates, so lookups by date match on every database (SQLite would add 00:00:00).
    protected $dateFormat = 'Y-m-d';

    protected $fillable = ['employee_request_id', 'employee_id', 'date', 'portion', 'part'];

    protected function casts(): array
    {
        return ['date' => 'date', 'portion' => 'float'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(EmployeeRequest::class, 'employee_request_id');
    }
}
