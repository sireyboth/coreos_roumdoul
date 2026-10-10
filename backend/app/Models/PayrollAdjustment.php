<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A one-off amount for one person in one month: a bonus, a penalty, back
 * pay, or a correction to a month that was already paid. Can't change once
 * that month's run is approved.
 */
class PayrollAdjustment extends Model
{
    use Auditable, BelongsToCompany;

    public const SOURCES = ['manual', 'import', 'correction'];

    protected $fillable = ['company_id', 'employee_id', 'month', 'kind', 'name', 'amount', 'taxable', 'reason', 'source', 'created_by'];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
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
