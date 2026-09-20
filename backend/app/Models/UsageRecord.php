<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class UsageRecord extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'metric',
        'value',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
        ];
    }
}
