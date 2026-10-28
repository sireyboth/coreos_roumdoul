<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/** A company's payroll settings: how day and hour rates are worked out, missing scans, overtime minimums, rounding. */
class PayrollPolicy extends Model
{
    use Auditable, BelongsToCompany;

    public const RATE_BASES = ['fixed', 'calendar', 'scheduled'];

    public const MISSING_SCAN_POLICIES = ['review', 'present', 'absent'];

    protected $fillable = [
        'company_id', 'rate_basis', 'rate_basis_days', 'hours_per_day', 'missing_scan_policy',
        'daily_paid_holidays', 'enforce_overtime_minimums', 'khr_rounding', 'fallback_exchange_rate', 'bank_exports',
    ];

    protected $hidden = ['company_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'rate_basis_days' => 'integer',
            'hours_per_day' => 'float',
            'daily_paid_holidays' => 'boolean',
            'enforce_overtime_minimums' => 'boolean',
            'khr_rounding' => 'integer',
            'fallback_exchange_rate' => 'float',
            'bank_exports' => 'array',
        ];
    }
}
