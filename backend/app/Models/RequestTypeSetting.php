<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/**
 * A company's rules for one request type other than leave. Read through
 * forCompany(), which falls back to the defaults when nothing is saved yet.
 */
class RequestTypeSetting extends Model
{
    use Auditable, BelongsToCompany;

    /** Late arrival / early leave: paid, at most 3 a month. */
    public const DEFAULTS = [
        'late_early' => ['is_active' => true, 'pay_percent' => 100, 'monthly_limit' => 3],
    ];

    protected $fillable = ['company_id', 'type', 'is_active', 'pay_percent', 'monthly_limit'];

    protected $hidden = ['company_id', 'id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'pay_percent' => 'integer', 'monthly_limit' => 'integer'];
    }

    public static function forCompany(int $companyId, string $type): self
    {
        return static::query()->withoutGlobalScopes()->where('company_id', $companyId)->where('type', $type)->first()
            ?? new static(['company_id' => $companyId, 'type' => $type, ...self::DEFAULTS[$type]]);
    }
}
