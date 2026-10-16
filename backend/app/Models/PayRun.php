<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One pay group's pay for one period (period_start → period_end, which can
 * cross months); month is the month the period ends in. Recalculated freely
 * while draft or calculated; once approved its payslips never change, the
 * attendance it used is locked, and fixes go into a later period as adjustments.
 */
class PayRun extends Model
{
    use Auditable, BelongsToCompany;

    public const STATUSES = ['draft', 'calculated', 'approved', 'paid'];

    protected $fillable = [
        'company_id', 'pay_group_id', 'month', 'period_start', 'period_end', 'status', 'policy_snapshot', 'warnings', 'totals',
        'calculated_at', 'calculated_by', 'approved_at', 'approved_by', 'paid_at', 'paid_by',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'policy_snapshot' => 'array',
            'warnings' => 'array',
            'totals' => 'array',
            'calculated_at' => 'datetime',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function isLocked(): bool
    {
        return in_array($this->status, ['approved', 'paid'], true);
    }

    public function payGroup(): BelongsTo
    {
        return $this->belongsTo(PayGroup::class);
    }

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function calculatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'calculated_by');
    }
}
