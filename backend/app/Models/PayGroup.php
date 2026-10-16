<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * People who are paid on the same schedule by the same rules ("Office staff",
 * "Factory workers"). The schedule says where each pay period starts and
 * ends; a period can cross months (26 Mar → 25 Apr):
 *
 *  - monthly       one period a month, ending on cutoff_days[0] (31 = the last day)
 *  - semi_monthly  two a month, ending on cutoff_days[0] and [1] (e.g. 15 and 31, or 10 and 25)
 *  - weekly        every 7 days from anchor_date
 *  - biweekly      every 14 days from anchor_date
 *  - custom        no rule: HR picks each run's dates
 *
 * Policy fields left null use the company's PayrollPolicy; component_rules
 * switch a company component off or give it other params for this group only.
 * One group per company is the default: anyone never put in a group is in it.
 */
class PayGroup extends Model
{
    use Auditable, BelongsToCompany;

    public const SCHEDULES = ['monthly', 'semi_monthly', 'weekly', 'biweekly', 'custom'];

    /** The policy fields a group can set for itself. */
    public const POLICY_FIELDS = ['rate_basis', 'rate_basis_days', 'hours_per_day', 'missing_scan_policy', 'daily_paid_holidays'];

    /** A custom period can't be longer than this (two months and a bit). */
    public const MAX_CUSTOM_DAYS = 62;

    protected $fillable = [
        'company_id', 'name', 'schedule', 'cutoff_days', 'anchor_date',
        'rate_basis', 'rate_basis_days', 'hours_per_day', 'missing_scan_policy', 'daily_paid_holidays',
        'component_rules', 'auto_calculate', 'is_default', 'sort_order',
    ];

    protected $hidden = ['company_id'];

    protected function casts(): array
    {
        return [
            'cutoff_days' => 'array',
            'anchor_date' => 'date:Y-m-d',
            'rate_basis_days' => 'integer',
            'hours_per_day' => 'float',
            'daily_paid_holidays' => 'boolean',
            'component_rules' => 'array',
            'auto_calculate' => 'boolean',
            'is_default' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function payRuns(): HasMany
    {
        return $this->hasMany(PayRun::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(EmployeePayGroup::class);
    }

    public function hasFixedPeriods(): bool
    {
        return $this->schedule !== 'custom';
    }

    /**
     * The period that holds $date.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null null for a custom schedule
     */
    public function periodFor(string|CarbonImmutable $date): ?array
    {
        $date = CarbonImmutable::parse($date)->startOfDay();

        if (in_array($this->schedule, ['weekly', 'biweekly'], true)) {
            $length = $this->schedule === 'weekly' ? 7 : 14;
            $anchor = CarbonImmutable::parse($this->anchor_date ?? '2026-01-05')->startOfDay();
            $offset = (int) floor($anchor->diffInDays($date, false) / $length);
            $start = $anchor->addDays($offset * $length);

            return [$start, $start->addDays($length - 1)];
        }

        if (! in_array($this->schedule, ['monthly', 'semi_monthly'], true)) {
            return null;
        }

        // Period ends from the month before to the month after: the first on or after
        // the date ends its period, the one before it marks where that period starts.
        $ends = collect([-1, 0, 1])
            ->flatMap(fn (int $shift) => $this->endsIn($date->startOfMonth()->addMonthsNoOverflow($shift)))
            ->sort()->values();
        $i = $ends->search(fn (CarbonImmutable $end) => $end->gte($date));

        return [$ends[$i - 1]->addDay(), $ends[$i]];
    }

    /** @return array<int, array{0: CarbonImmutable, 1: CarbonImmutable}> the last $count periods that ended by $date, newest first */
    public function recentPeriods(string|CarbonImmutable $date, int $count = 6): array
    {
        $periods = [];
        $period = $this->periodFor($date);

        while ($period && count($periods) < $count) {
            $periods[] = $period;
            $period = $this->periodFor($period[0]->subDay());
        }

        return $periods;
    }

    /**
     * How much of a monthly salary one full period pays: the whole of it for
     * a monthly period, half twice a month, 12/52 of it weekly. A custom range
     * pays the share of each calendar month it covers.
     */
    public function salaryShare(CarbonImmutable $start, CarbonImmutable $end): float
    {
        return match ($this->schedule) {
            'monthly' => 1.0,
            'semi_monthly' => 0.5,
            'weekly' => 12 / 52,
            'biweekly' => 12 / 26,
            default => self::monthShare($start, $end),
        };
    }

    /** "1/2", "12/52"… — how the share reads on a payslip; null when it is the whole salary. */
    public function salaryShareLabel(CarbonImmutable $start, CarbonImmutable $end): ?string
    {
        return match ($this->schedule) {
            'monthly' => null,
            'semi_monthly' => '1/2',
            'weekly' => '12/52',
            'biweekly' => '12/26',
            default => abs(self::monthShare($start, $end) - 1) < 0.00001 ? null : rtrim(rtrim(number_format(self::monthShare($start, $end), 4, '.', ''), '0'), '.').' month',
        };
    }

    /** The calendar-month fractions a date range covers: 26 Mar → 25 Apr = 6/31 + 25/30. */
    public static function monthShare(CarbonImmutable $start, CarbonImmutable $end): float
    {
        return array_sum(array_map(fn (array $m) => $m['days'] / $m['days_in_month'], self::monthsIn($start, $end)));
    }

    /**
     * The calendar months a date range touches, with its days in each.
     *
     * @return array<int, array{month: string, days: int, days_in_month: int}>
     */
    public static function monthsIn(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $months = [];
        for ($from = $start; $from->lte($end); $from = $from->startOfMonth()->addMonthNoOverflow()) {
            $to = $from->endOfMonth()->startOfDay()->min($end);
            $months[] = ['month' => $from->format('Y-m'), 'days' => (int) $from->diffInDays($to) + 1, 'days_in_month' => $from->daysInMonth];
        }

        return $months;
    }

    /** Whether a range is exactly one calendar month (the only case tax and NSSF are worked out for, for now). */
    public static function isCalendarMonth(CarbonImmutable $start, CarbonImmutable $end): bool
    {
        return $start->day === 1 && $end->isSameDay($start->endOfMonth());
    }

    /** @return array<int, CarbonImmutable> the days in $month that a period ends on */
    private function endsIn(CarbonImmutable $month): array
    {
        $cutoffs = $this->cutoff_days ?: [31];

        return collect($cutoffs)
            ->map(fn ($day) => $month->setDay(min((int) $day, $month->daysInMonth)))
            ->unique(fn (CarbonImmutable $d) => $d->toDateString())
            ->values()->all();
    }
}
