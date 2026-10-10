<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;

/**
 * Tax on salary and NSSF rates set by law. Platform-owned (edited in
 * Filament, never by a company): a new law is a new row from its date, so
 * past months keep the rates they were paid under.
 */
class StatutoryRate extends Model
{
    use Auditable;

    public const KINDS = ['tax_on_salary', 'nssf'];

    protected $fillable = ['country', 'kind', 'params', 'effective_from', 'note'];

    protected function casts(): array
    {
        return [
            'params' => 'array',
            'effective_from' => 'date:Y-m-d',
        ];
    }

    /** The rates in force on $date, or null when none are set up. */
    public static function inForce(string $kind, string $date, string $country = 'KH'): ?self
    {
        return static::query()
            ->where('country', $country)
            ->where('kind', $kind)
            ->whereDate('effective_from', '<=', $date)
            ->orderByDesc('effective_from')
            ->first();
    }
}
