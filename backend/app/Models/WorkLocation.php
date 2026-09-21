<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class WorkLocation extends Model
{
    use Auditable, BelongsToCompany, HasFactory, SoftDeletes;

    protected static function booted(): void
    {
        static::creating(function (self $workLocation) {
            $workLocation->qr_token ??= Str::random(32);
        });
    }

    // qr_token is hidden everywhere (schedules, attendance events, ...) — it proves
    // someone is at the branch, so it only goes to people who manage locations.
    // The rest are internal columns no screen reads.
    protected $hidden = ['qr_token', 'company_id', 'created_at', 'updated_at', 'deleted_at'];

    protected $fillable = [
        'company_id',
        'branch_id',
        'name',
        'address',
        'latitude',
        'longitude',
        'radius_meters',
        'require_location',
        'qr_token',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'is_active' => 'boolean',
            'require_location' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Called when a printed/shared code may have been compromised (lost
     * poster, leaked photo) — invalidates the old one immediately.
     */
    public function regenerateQrToken(): string
    {
        $this->update(['qr_token' => Str::random(32)]);

        return $this->qr_token;
    }

    /**
     * Distance in meters between this location and a given point, using the
     * haversine formula — good enough at the scale of "same building or not".
     */
    public function distanceInMetersTo(float $latitude, float $longitude): float
    {
        $earthRadiusMeters = 6371000;

        $lat1 = deg2rad((float) $this->latitude);
        $lat2 = deg2rad($latitude);
        $deltaLat = deg2rad($latitude - (float) $this->latitude);
        $deltaLon = deg2rad($longitude - (float) $this->longitude);

        $a = sin($deltaLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($deltaLon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadiusMeters * $c;
    }
}
