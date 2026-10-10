<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One line of a payslip, with the words and the rule that produced it. */
class PayslipLine extends Model
{
    public $timestamps = false;

    protected $fillable = ['payslip_id', 'pay_component_id', 'code', 'name', 'kind', 'amount', 'explanation', 'details', 'sort_order'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'details' => 'array',
            'sort_order' => 'integer',
        ];
    }

    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class);
    }
}
