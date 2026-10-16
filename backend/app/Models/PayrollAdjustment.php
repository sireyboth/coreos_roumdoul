<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A one-off amount for one person: a bonus, a penalty, back pay, or a
 * correction to a period that was already paid. It lands in the pay run whose
 * period holds its date, and can't change once that run is approved.
 */
class PayrollAdjustment extends Model
{
    use Auditable, BelongsToCompany;

    public const SOURCES = ['manual', 'import', 'correction'];

    protected $fillable = ['company_id', 'employee_id', 'date', 'kind', 'name', 'amount', 'taxable', 'reason', 'source', 'created_by'];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'amount' => 'decimal:2',
            'taxable' => 'boolean',
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
