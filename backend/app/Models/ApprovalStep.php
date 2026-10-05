<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One step of an approval chain.
 *
 * kind:
 *  - manager     the employee's line manager decides (approver_user_id)
 *  - permission  anyone with requests.manage who covers the employee's branch
 *
 * status: pending | approved | rejected | skipped (e.g. the manager is the requester)
 */
class ApprovalStep extends Model
{
    protected $fillable = [
        'approval_request_id',
        'step_number',
        'kind',
        'approver_user_id',
        'approver_role_code',
        'status',
        'comment',
        'acted_at',
        'acted_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'acted_at' => 'datetime',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }

    public function actedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by_user_id');
    }
}
