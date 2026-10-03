<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One alert for one person. Its content never changes after it is sent —
 * only read_at (the recipient saw it) and resolved_* (someone else already
 * acted on the subject) are ever set.
 */
class Notification extends Model
{
    use BelongsToCompany, MassPrunable;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'recipient_user_id',
        'actor_user_id',
        'notification_type',
        'subject_type',
        'subject_id',
        'title',
        'body',
        'data',
        'link',
        'dedupe_key',
        'read_at',
        'resolved_at',
        'resolved_by_user_id',
        'resolution',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
            'resolved_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(NotificationDelivery::class);
    }

    /** Read alerts older than 90 days are cleared daily (model:prune); unread ones are kept. */
    public function prunable(): Builder
    {
        return static::query()->withoutGlobalScopes()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays(90));
    }

    public function markAsRead(): void
    {
        if ($this->read_at === null) {
            $this->update(['read_at' => now()]);
        }
    }
}
