<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person's days frozen by an approved pay run: their attendance between
 * start_date and end_date can't change any more, exactly like a locked month,
 * but without locking anyone else.
 */
class AttendanceLock extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'employee_id', 'start_date', 'end_date', 'pay_run_id'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    public function payRun(): BelongsTo
    {
        return $this->belongsTo(PayRun::class);
    }
}
