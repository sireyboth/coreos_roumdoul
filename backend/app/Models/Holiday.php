<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Holiday extends Model
{
    use Auditable, BelongsToCompany, HasFactory;

    protected $fillable = [
        'company_id',
        'name',
        'date',
        'is_recurring_yearly',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'is_recurring_yearly' => 'boolean',
        ];
    }
}
