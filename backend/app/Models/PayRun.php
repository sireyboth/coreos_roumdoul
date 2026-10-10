<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A month's payroll for the whole company. Recalculated freely while draft
 * or calculated; once approved its payslips never change, and fixes go into
 * a later month as adjustments.
 */
class PayRun extends Model
{
    use Auditable, BelongsToCompany;

    public const STATUSES = ['draft', 'calculated', 'approved', 'paid'];

    protected $fillable = [
        'company_id', 'month', 'status', 'policy_snapshot', 'warnings', 'totals',
        'calculated_at', 'calculated_by', 'approved_at', 'approved_by', 'paid_at', 'paid_by',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
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
