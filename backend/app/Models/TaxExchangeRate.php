<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

/** The official riel-per-dollar rate the tax office publishes for a month (YYYY-MM). Platform-owned. */
class TaxExchangeRate extends Model
{
    use Auditable;

    protected $fillable = ['month', 'rate'];

    protected function casts(): array
    {
        return ['rate' => 'float'];
    }
}
