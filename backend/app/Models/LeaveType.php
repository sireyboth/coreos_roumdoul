<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/**
 * One kind of leave and its rules, per company. See LeaveDefaults for what
 * each company starts with and the migration for what each field means.
 */
class LeaveType extends Model
{
    use Auditable, BelongsToCompany;

    public const COUNTS = ['work_days', 'calendar_days'];

    public const ACCRUALS = ['none', 'monthly', 'yearly'];

    protected $fillable = [
        'company_id', 'code', 'name', 'name_km', 'pay_percent', 'counts', 'accrual', 'yearly_days',
        'seniority_every_years', 'seniority_extra_days', 'eligible_after_months', 'requires_balance',
        'allow_half_day', 'attachment_from_days', 'min_notice_days', 'max_days_per_request', 'gender',
        'is_active', 'sort_order',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'pay_percent' => 'integer',
            'yearly_days' => 'float',
            'seniority_every_years' => 'integer',
            'seniority_extra_days' => 'float',
            'eligible_after_months' => 'integer',
            'requires_balance' => 'boolean',
            'allow_half_day' => 'boolean',
            'attachment_from_days' => 'float',
            'min_notice_days' => 'integer',
            'max_days_per_request' => 'float',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function isPaid(): bool
    {
        return $this->pay_percent > 0;
    }

    public function countsCalendarDays(): bool
    {
        return $this->counts === 'calendar_days';
    }
}
