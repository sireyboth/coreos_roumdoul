<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One line a payslip can have, and how it is worked out:
 *  - base           the salary itself (system, one per company)
 *  - employee_item  an amount set per person (transport allowance, loan repayment)
 *  - template       worked out from attendance by a PayTemplates rule
 *
 * kind: earning · deduction (reduces gross, before tax) · net_deduction (after tax).
 * System components can be tuned and switched off, never deleted.
 */
class PayComponent extends Model
{
    use Auditable, BelongsToCompany;

    public const KINDS = ['earning', 'deduction', 'net_deduction'];

    public const METHODS = ['base', 'employee_item', 'template'];

    protected $fillable = [
        'company_id', 'code', 'name', 'kind', 'method', 'template', 'params',
        'taxable', 'nssf_insurable', 'is_system', 'is_active', 'sort_order',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'params' => 'array',
            'taxable' => 'boolean',
            'nssf_insurable' => 'boolean',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function employeeItems(): HasMany
    {
        return $this->hasMany(EmployeePayItem::class);
    }
}
