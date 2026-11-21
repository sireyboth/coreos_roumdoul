<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/**
 * One Telegram group a company linked to the platform bot (see
 * App\Services\Telegram). A company can link several — e.g. management for
 * every branch, and one HR group per branch — each with its own reach:
 *
 *  - events:     which kinds of posts it gets
 *  - branch_ids: null = posts about every branch; else only those branches
 *  - detail:     how much of the employee the card shows (DETAILS)
 *
 * @property array<int, string> $events
 * @property array<int, int>|null $branch_ids
 * @property string $detail
 */
class TelegramGroup extends Model
{
    use BelongsToCompany;

    /** What a group can get. Pay and private reasons are never posted. */
    public const EVENTS = ['requests', 'request_decisions', 'late_warnings'];

    /**
     * A newly linked group starts with these. Late warnings are opt-in: naming
     * who was late, and on which days, in front of a whole group is a choice
     * the company should make on purpose.
     */
    public const DEFAULT_EVENTS = ['requests', 'request_decisions'];

    /** full = name, Khmer name, ID code, job, department, branch; basic = name and branch only. */
    public const DETAILS = ['full', 'basic'];

    /** Enough for a group per branch plus a few company-wide ones. */
    public const MAX_PER_COMPANY = 20;

    protected $fillable = ['company_id', 'branch_ids', 'chat_id', 'title', 'events', 'detail', 'connected_by'];

    protected $hidden = ['company_id'];

    protected $attributes = ['detail' => 'full'];

    protected function casts(): array
    {
        return ['events' => 'array', 'branch_ids' => 'array'];
    }

    public function wants(string $event): bool
    {
        return in_array($event, $this->events ?? [], true);
    }

    /**
     * Whether a post about someone in $branchId belongs here. A company-wide
     * group takes every post; a branch group only its branches' — and nothing
     * about someone with no branch.
     */
    public function covers(?int $branchId): bool
    {
        if ($this->branch_ids === null) {
            return true;
        }

        return $branchId !== null && in_array($branchId, array_map('intval', $this->branch_ids), true);
    }
}
