<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What tax on salary and NSSF need to know about one person, and how they are paid. */
class EmployeePayProfile extends Model
{
    use Auditable, BelongsToCompany;

    public const PAYMENT_METHODS = ['bank', 'cash'];

    /** What an employee without a saved profile is treated as. */
    public const DEFAULTS = [
        'tax_resident' => true,
        'spouse_dependent' => false,
        'child_dependents' => 0,
        'nssf_enrolled' => true,
        'payment_method' => 'bank',
        'bank_account_name' => null,
    ];

    protected $fillable = [
        'company_id', 'employee_id', 'tax_resident', 'spouse_dependent', 'child_dependents',
        'nssf_enrolled', 'payment_method', 'bank_account_name',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'tax_resident' => 'boolean',
            'spouse_dependent' => 'boolean',
            'child_dependents' => 'integer',
            'nssf_enrolled' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
