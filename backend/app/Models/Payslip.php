<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One employee's pay for one run. Not Auditable: it is rewritten on every
 * recalculation; the run's approval is what gets audited.
 */
class Payslip extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id', 'pay_run_id', 'employee_id', 'currency', 'pay_type', 'base_salary', 'daily_rate', 'hourly_rate',
        'exchange_rate', 'gross', 'nssf_employee', 'tax', 'net', 'employer_cost', 'inputs', 'warnings', 'payment',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'daily_rate' => 'decimal:4',
            'hourly_rate' => 'decimal:4',
            'exchange_rate' => 'float',
            'gross' => 'decimal:2',
            'nssf_employee' => 'decimal:2',
            'tax' => 'decimal:2',
            'net' => 'decimal:2',
            'employer_cost' => 'decimal:2',
            'inputs' => 'array',
            'warnings' => 'array',
            'payment' => 'array',
        ];
    }

    /**
     * How this payslip is paid: the copy taken at approval, or — before that —
     * the employee's details as they are now. Needs employee.payProfile loaded.
     *
     * @return array{payment_method: string, bank_name: ?string, bank_account_number: ?string, bank_account_name: ?string}
     */
    public function paymentDetails(): array
    {
        if ($this->payment !== null) {
            return $this->payment;
        }

        $e = $this->employee;

        return [
            'payment_method' => $e?->payProfile?->payment_method ?? 'bank',
            'bank_name' => $e?->bank_name,
            'bank_account_number' => $e?->bank_account_number,
            'bank_account_name' => $e?->payProfile?->bank_account_name,
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

    public function lines(): HasMany
    {
        return $this->hasMany(PayslipLine::class)->orderBy('sort_order')->orderBy('id');
    }
}
