<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceEvent extends Model
{
    use Auditable, BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'employee_id',
        'work_location_id',
        'event_type',
        'method',
        'event_time',
        'latitude',
        'longitude',
        'device_id',
        'recorded_by',
        'notes',
    ];

    protected $appends = ['distance_meters'];

    /**
     * How far the device was from the work location when it checked in/out.
     * Only computed when both sides have coordinates and the location was
     * eager-loaded (so it never triggers a query per row).
     */
    public function getDistanceMetersAttribute(): ?int
    {
        $location = $this->relationLoaded('workLocation') ? $this->workLocation : null;

        if (! $location || $location->latitude === null || $location->longitude === null
            || $this->latitude === null || $this->longitude === null) {
            return null;
        }

        return (int) round($location->distanceInMetersTo((float) $this->latitude, (float) $this->longitude));
    }

    protected function casts(): array
    {
        return [
            'event_time' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function workLocation(): BelongsTo
    {
        return $this->belongsTo(WorkLocation::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
