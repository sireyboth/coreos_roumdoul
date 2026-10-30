<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * HR's amount for one payslip line, in place of what the rule worked out.
 * Kept across recalculations (payslips are rebuilt, this is not) and gone
 * with the run. Auditable: every set, change and removal is logged.
 */
class PayslipOverride extends Model
{
    use Auditable, BelongsToCompany;

    protected $fillable = ['company_id', 'pay_run_id', 'employee_id', 'pay_component_id', 'amount', 'reason', 'created_by', 'updated_by'];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function payRun(): BelongsTo
    {
        return $this->belongsTo(PayRun::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /** @return BelongsTo<PayComponent, $this> */
    public function component(): BelongsTo
    {
        return $this->belongsTo(PayComponent::class, 'pay_component_id');
    }

    /** @return BelongsTo<User, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
