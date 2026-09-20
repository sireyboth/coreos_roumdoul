<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceSession extends Model
{
    use Auditable, BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'employee_id',
        'schedule_id',
        'date',
        'check_in_event_id',
        'check_out_event_id',
        'worked_minutes',
        'late_minutes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class)->withTrashed();
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    public function checkInEvent(): BelongsTo
    {
        return $this->belongsTo(AttendanceEvent::class, 'check_in_event_id');
    }

    public function checkOutEvent(): BelongsTo
    {
        return $this->belongsTo(AttendanceEvent::class, 'check_out_event_id');
    }
}
