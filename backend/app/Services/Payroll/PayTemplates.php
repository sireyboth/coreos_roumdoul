<?php

namespace App\Services\Payroll;

use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The rule templates of Standard payroll. Each one turns its parameters into
 * a formula for PayFormula (one evaluator for everything) plus the words a
 * payslip shows, e.g. "45 min × 0.0417".
 *
 * Variables a template can read come from PayrollCalculator::variables().
 */
final class PayTemplates
{
    public const TEMPLATES = ['overtime', 'attendance_bonus', 'absence', 'unpaid_leave', 'late', 'early_leave', 'unpaid_permission'];

    public const LATENESS_MODES = ['per_minute', 'per_time', 'count_based', 'tiers', 'none'];

    /** Labor Law floors: a company can pay more for overtime, never less. */
    public const OVERTIME_MINIMUMS = ['workday' => 1.5, 'day_off' => 2.0, 'holiday' => 2.0];

    /** Templates that only make sense for monthly salaries (a daily worker is simply not paid for the day). */
    private const MONTHLY_ONLY = ['absence', 'unpaid_leave'];

    public function __construct(private readonly PayFormula $formula) {}

    /**
     * @param  array<string, mixed>  $params
     * @param  array<string, mixed>  $vars
     * @return array{amount: float, explanation: string, formula: string, variables: array<string, float>}|null null when it doesn't apply
     */
    public function run(string $template, array $params, array $vars, string $currency): ?array
    {
        if (in_array($template, self::MONTHLY_ONLY, true) && $vars['pay_type'] !== 'monthly') {
            return null;
        }

        $compiled = match ($template) {
            'overtime' => $this->overtime($params, $vars, $currency),
            'attendance_bonus' => $this->attendanceBonus($params, $vars),
            'absence' => $this->absence($params, $vars, $currency),
            'unpaid_leave' => $this->unpaidLeave($vars, $currency),
            'late' => $this->lateness($params, $vars, 'late', $currency),
            'early_leave' => $this->lateness($params, $vars, 'early_leave', $currency),
            'unpaid_permission' => $this->unpaidPermission($vars, $currency),
            default => null,
        };

        if ($compiled === null) {
            return null;
        }

        [$formula, $variables, $explanation] = $compiled;
        $amount = Money::round(max(0.0, $this->formula->evaluate($formula, $variables)), $currency);

        return ['amount' => $amount, 'explanation' => $explanation, 'formula' => $formula, 'variables' => $variables];
    }

    /**
     * Validates and normalises a template's parameters (from the settings screen).
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public static function normalise(string $template, array $params): array
    {
        $rules = match ($template) {
            'overtime' => [
                'workday' => ['required', 'numeric', 'min:'.self::OVERTIME_MINIMUMS['workday'], 'max:10'],
                'day_off' => ['required', 'numeric', 'min:'.self::OVERTIME_MINIMUMS['day_off'], 'max:10'],
                'holiday' => ['required', 'numeric', 'min:'.self::OVERTIME_MINIMUMS['holiday'], 'max:10'],
            ],
            'attendance_bonus' => [
                'amount' => ['required', 'numeric', 'min:0'],
                'max_absent_days' => ['required', 'integer', 'min:0', 'max:31'],
                'max_late_count' => ['required', 'integer', 'min:0', 'max:31'],
            ],
            'absence' => ['multiplier' => ['required', 'numeric', 'min:0', 'max:5']],
            'late', 'early_leave' => [
                'mode' => ['required', Rule::in(self::LATENESS_MODES)],
                'grace_minutes' => ['required', 'integer', 'min:0', 'max:240'],
                'amount' => ['required', 'numeric', 'min:0'],
                'free_count' => ['required', 'integer', 'min:0', 'max:31'],
                'every_n' => ['required', 'integer', 'min:1', 'max:31'],
                'tiers' => ['present', 'array', 'max:10'],
                'tiers.*.up_to_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
                'tiers.*.amount' => ['required', 'numeric', 'min:0'],
                'tiers.*.day_fraction' => ['required', 'numeric', 'min:0', 'max:1'],
            ],
            default => [],
        };

        $validator = validator($params, $rules, [
            'workday.min' => 'Overtime on a work day can\'t be paid at less than 150% (Labor Law).',
            'day_off.min' => 'Overtime on a day off can\'t be paid at less than 200% (Labor Law).',
            'holiday.min' => 'Overtime on a holiday can\'t be paid at less than 200%.',
        ]);

        if ($validator->fails()) {
            throw ValidationException::withMessages(collect($validator->errors()->messages())
                ->mapWithKeys(fn ($messages, $key) => ["params.{$key}" => $messages])->all());
        }

        $clean = $validator->validated();

        if (isset($clean['tiers'])) {
            // Shortest first, the open-ended tier (no limit) last.
            $clean['tiers'] = collect($clean['tiers'])
                ->sortBy(fn (array $tier) => $tier['up_to_minutes'] ?? PHP_INT_MAX)
                ->values()->all();
        }

        return $clean;
    }

    // ───────────────────────────── Templates ─────────────────────────────

    private function overtime(array $p, array $v, string $currency): ?array
    {
        $parts = [];
        $terms = [];
        $variables = ['hourly_rate' => $v['hourly_rate']];

        foreach (['workday' => 'ot_workday_hours', 'day_off' => 'ot_day_off_hours', 'holiday' => 'ot_holiday_hours'] as $type => $hours) {
            if ($v[$hours] <= 0) {
                continue;
            }
            $multiplier = max((float) ($p[$type] ?? 0), self::OVERTIME_MINIMUMS[$type]);
            $variables[$hours] = $v[$hours];
            $variables["m_{$type}"] = $multiplier;
            $terms[] = "{$hours} * hourly_rate * m_{$type}";
            $parts[] = Money::quantity($v[$hours]).' h × '.Money::rate($v['hourly_rate'], $currency).' × '.Money::quantity($multiplier * 100).'%';
        }

        return $terms === [] ? null : [implode(' + ', $terms), $variables, implode(' + ', $parts)];
    }

    private function attendanceBonus(array $p, array $v): ?array
    {
        $amount = (float) ($p['amount'] ?? 0);
        if ($amount <= 0) {
            return null;
        }

        $variables = [
            'absent_days' => $v['absent_days'], 'late_count' => $v['late_count'],
            'max_absent_days' => (float) $p['max_absent_days'], 'max_late_count' => (float) $p['max_late_count'], 'amount' => $amount,
        ];
        $earned = $v['absent_days'] <= $p['max_absent_days'] && $v['late_count'] <= $p['max_late_count'];

        return [
            'absent_days <= max_absent_days && late_count <= max_late_count ? amount : 0',
            $variables,
            $earned
                ? "Earned: {$v['absent_days']} absences (max {$p['max_absent_days']}), {$v['late_count']} late (max {$p['max_late_count']})"
                : "Not earned: {$v['absent_days']} absences (max {$p['max_absent_days']}), {$v['late_count']} late (max {$p['max_late_count']})",
        ];
    }

    private function absence(array $p, array $v, string $currency): ?array
    {
        if ($v['absent_days'] <= 0) {
            return null;
        }
        $multiplier = (float) ($p['multiplier'] ?? 1);

        return [
            'absent_days * daily_rate * multiplier',
            ['absent_days' => $v['absent_days'], 'daily_rate' => $v['daily_rate'], 'multiplier' => $multiplier],
            $this->days($v['absent_days']).' × '.Money::rate($v['daily_rate'], $currency).($multiplier != 1 ? ' × '.Money::quantity($multiplier * 100).'%' : ''),
        ];
    }

    private function unpaidLeave(array $v, string $currency): ?array
    {
        if ($v['unpaid_leave_days'] <= 0) {
            return null;
        }

        return [
            'unpaid_leave_days * daily_rate',
            ['unpaid_leave_days' => $v['unpaid_leave_days'], 'daily_rate' => $v['daily_rate']],
            $this->days($v['unpaid_leave_days']).' × '.Money::rate($v['daily_rate'], $currency),
        ];
    }

    private function unpaidPermission(array $v, string $currency): ?array
    {
        if ($v['unpaid_excused_minutes'] <= 0) {
            return null;
        }

        return [
            'unpaid_excused_minutes * minute_rate',
            ['unpaid_excused_minutes' => $v['unpaid_excused_minutes'], 'minute_rate' => $v['minute_rate']],
            "{$v['unpaid_excused_minutes']} min × ".Money::rate($v['minute_rate'], $currency),
        ];
    }

    /** Late arrival and early leave share one set of modes. $what = late | early_leave. */
    private function lateness(array $p, array $v, string $what, string $currency): ?array
    {
        $byDay = $v["{$what}_by_day"];
        $count = count($byDay);
        $mode = $p['mode'] ?? 'none';

        if ($count === 0 || $mode === 'none') {
            return null;
        }

        switch ($mode) {
            case 'per_minute':
                $grace = (int) ($p['grace_minutes'] ?? 0);
                $minutes = array_sum(array_map(fn (int $m) => max(0, $m - $grace), $byDay));
                if ($minutes <= 0) {
                    return null;
                }

                return [
                    'minutes_after_grace * minute_rate',
                    ['minutes_after_grace' => $minutes, 'minute_rate' => $v['minute_rate']],
                    "{$minutes} min × ".Money::rate($v['minute_rate'], $currency).($grace > 0 ? " (after {$grace} min grace a day)" : ''),
                ];

            case 'per_time':
                $free = (int) ($p['free_count'] ?? 0);
                $amount = (float) ($p['amount'] ?? 0);
                if ($count <= $free || $amount <= 0) {
                    return null;
                }

                return [
                    'max(times - free_count, 0) * amount',
                    ['times' => $count, 'free_count' => $free, 'amount' => $amount],
                    ($free > 0 ? "({$count} times − {$free} free)" : "{$count} times").' × '.Money::format($amount, $currency),
                ];

            case 'count_based':
                $everyN = max(1, (int) ($p['every_n'] ?? 3));
                if ($count < $everyN) {
                    return null;
                }

                return [
                    'floor(times / every_n) * daily_rate',
                    ['times' => $count, 'every_n' => $everyN, 'daily_rate' => $v['daily_rate']],
                    "{$count} times ÷ {$everyN} = ".$this->days(floor($count / $everyN)).' × '.Money::rate($v['daily_rate'], $currency),
                ];

            case 'tiers':
                $tiers = $p['tiers'] ?? [];
                $amount = 0.0;
                $dayFraction = 0.0;
                foreach ($byDay as $minutes) {
                    foreach ($tiers as $tier) {
                        if ($tier['up_to_minutes'] === null || $minutes <= $tier['up_to_minutes']) {
                            $amount += (float) $tier['amount'];
                            $dayFraction += (float) $tier['day_fraction'];
                            break;
                        }
                    }
                }
                if ($amount <= 0 && $dayFraction <= 0) {
                    return null;
                }

                return [
                    'tier_amount + tier_days * daily_rate',
                    ['tier_amount' => $amount, 'tier_days' => $dayFraction, 'daily_rate' => $v['daily_rate']],
                    "Tiers over {$count} days: ".collect([
                        $amount > 0 ? Money::format($amount, $currency) : null,
                        $dayFraction > 0 ? $this->days($dayFraction).' × '.Money::rate($v['daily_rate'], $currency) : null,
                    ])->filter()->join(' + '),
                ];
        }

        return null;
    }

    private function days(float $days): string
    {
        return Money::quantity($days).' '.($days == 1 ? 'day' : 'days');
    }
}
