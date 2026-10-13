<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One salary in an employee's history. Exactly one row is open-ended
 * (effective_to null) at a time; a change closes it and opens the next, so
 * payroll can ask "what was the salary on this date?". See EmployeeSalaryService.
 */
class EmployeeSalary extends Model
{
    use Auditable, BelongsToCompany;

    public const PAY_TYPES = ['monthly', 'daily'];

    public const REASONS = ['hired', 'probation_passed', 'promotion', 'annual_increase', 'change', 'correction'];

    protected $fillable = [
        'company_id', 'employee_id', 'amount', 'currency', 'pay_type',
        'effective_from', 'effective_to', 'reason', 'note', 'created_by',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'effective_from' => 'date:Y-m-d',
            'effective_to' => 'date:Y-m-d',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
