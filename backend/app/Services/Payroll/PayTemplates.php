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

    /** Labor Law floors: a company can pay more for overtime, never less — unless it switches enforce_overtime_minimums off. */
    public const OVERTIME_MINIMUMS = ['workday' => 1.5, 'day_off' => 2.0, 'holiday' => 2.0];

    /**
     * How each kind of overtime day is paid: every hour (per_hour), every hour up to a
     * daily cap (capped), or one fixed amount per overtime day (fixed).
     */
    public const OVERTIME_MODES = ['per_hour', 'capped', 'fixed'];

    public const OVERTIME_TYPES = ['workday', 'day_off', 'holiday'];

    /** With the Labor Law floors off, the company sets any rate; the law is only shown as a warning. */
    public const OVERTIME_FLOOR_WAIVED = 0.0;

    /** Templates that only make sense for monthly salaries (a daily worker is simply not paid for the day). */
    private const MONTHLY_ONLY = ['absence', 'unpaid_leave'];

    public function __construct(private readonly PayFormula $formula) {}

    /**
     * @param  array<string, mixed>  $params
     * @param  array<string, mixed>  $vars
     * @return array{amount: float, explanation: string, formula: string, variables: array<string, float>, days?: list<array<string, mixed>>, legal_amount?: float}|null null when it doesn't apply
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

        $result = ['amount' => $amount, 'explanation' => $explanation, 'formula' => $formula, 'variables' => $variables];
        if (isset($compiled[3])) {
            $result += $compiled[3];
        }

        return $result;
    }

    /**
     * Validates and normalises a template's parameters (from the settings screen).
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public static function normalise(string $template, array $params, bool $enforceOvertimeMinimums = true): array
    {
        $floor = self::overtimeFloors($enforceOvertimeMinimums);
        $rules = match ($template) {
            'overtime' => [
                'workday' => ['required', 'numeric', 'min:'.$floor['workday'], 'max:10'],
                'day_off' => ['required', 'numeric', 'min:'.$floor['day_off'], 'max:10'],
                'holiday' => ['required', 'numeric', 'min:'.$floor['holiday'], 'max:10'],
                'modes' => ['sometimes', 'array:'.implode(',', self::OVERTIME_TYPES)],
                ...collect(self::OVERTIME_TYPES)->flatMap(fn (string $type) => [
                    "modes.{$type}" => ['sometimes', 'array:mode,cap_hours,amount,min_hours'],
                    "modes.{$type}.mode" => ['required_with:modes.'.$type, Rule::in(self::OVERTIME_MODES)],
                    "modes.{$type}.cap_hours" => ["required_if:modes.{$type}.mode,capped", 'nullable', 'numeric', 'min:0.25', 'max:24'],
                    "modes.{$type}.amount" => ["required_if:modes.{$type}.mode,fixed", 'nullable', 'numeric', 'gt:0', 'max:1000000000'],
                    "modes.{$type}.min_hours" => ['nullable', 'numeric', 'min:0', 'max:24'],
                ])->all(),
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

        $validator = validator($params, $rules, $enforceOvertimeMinimums ? [
            'workday.min' => 'Overtime on a work day can\'t be paid at less than 150% (Labor Law).',
            'day_off.min' => 'Overtime on a day off can\'t be paid at less than 200% (Labor Law).',
            'holiday.min' => 'Overtime on a holiday can\'t be paid at less than 200%.',
        ] : [
            'workday.min' => 'Overtime can\'t be a negative rate.',
            'day_off.min' => 'Overtime can\'t be a negative rate.',
            'holiday.min' => 'Overtime can\'t be a negative rate.',
        ]);

        if ($validator->fails()) {
            throw ValidationException::withMessages(collect($validator->errors()->messages())
                ->mapWithKeys(fn ($messages, $key) => ["params.{$key}" => $messages])->all());
        }

        $clean = $validator->validated();

        if ($template === 'overtime') {
            $clean = self::normaliseOvertimeModes($clean, $params, $enforceOvertimeMinimums);
        }

        if (isset($clean['tiers'])) {
            // Shortest first, the open-ended tier (no limit) last.
            $clean['tiers'] = collect($clean['tiers'])
                ->sortBy(fn (array $tier) => $tier['up_to_minutes'] ?? PHP_INT_MAX)
                ->values()->all();
        }

        return $clean;
    }

    /**
     * Fills in every overtime type once any mode is set, and refuses a daily cap while the
     * company holds overtime to the Labor Law minimums (a cap would pay worked hours below them).
     *
     * @param  array<string, mixed>  $clean
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private static function normaliseOvertimeModes(array $clean, array $params, bool $enforce): array
    {
        if (! isset($clean['modes'])) {
            return $clean;
        }

        $modes = [];
        foreach (self::OVERTIME_TYPES as $type) {
            $given = $clean['modes'][$type] ?? [];
            $mode = $given['mode'] ?? 'per_hour';
            if ($enforce && $mode === 'capped') {
                throw ValidationException::withMessages([
                    "params.modes.{$type}.mode" => ['A daily cap pays worked overtime below the Labor Law minimum. Switch off "Hold overtime to the Labor Law minimums" in payroll settings to use it.'],
                ]);
            }
            $modes[$type] = [
                'mode' => $mode,
                'cap_hours' => $mode === 'capped' ? (float) $given['cap_hours'] : null,
                'amount' => $mode === 'fixed' ? (float) $given['amount'] : null,
                'min_hours' => $mode === 'fixed' ? (float) ($given['min_hours'] ?? 0) : null,
            ];
        }

        // Every type paid per hour is the same as no modes at all: keep the rule as it was.
        $clean['modes'] = $modes;
        if (collect($modes)->every(fn (array $m) => $m['mode'] === 'per_hour')) {
            unset($clean['modes']);
        }

        return $clean;
    }

    /** @return array{workday: float, day_off: float, holiday: float} */
    public static function overtimeFloors(bool $enforce): array
    {
        return $enforce ? self::OVERTIME_MINIMUMS : array_fill_keys(array_keys(self::OVERTIME_MINIMUMS), self::OVERTIME_FLOOR_WAIVED);
    }

    // ───────────────────────────── Templates ─────────────────────────────

    private function overtime(array $p, array $v, string $currency): ?array
    {
        $enforce = (bool) ($v['enforce_overtime_minimums'] ?? true);
        $floor = self::overtimeFloors($enforce);
        // A cap saved while the minimums were off is ignored once they are back on, like a rate below them is lifted:
        // every approved hour is paid again.
        $modes = collect($p['modes'] ?? [])
            ->map(fn (array $m) => $enforce && ($m['mode'] ?? null) === 'capped' ? ['mode' => 'per_hour'] : $m)
            ->all();
        if (collect($modes)->every(fn (array $m) => ($m['mode'] ?? 'per_hour') === 'per_hour')) {
            return $this->overtimePerHour($p, $v, $currency, $floor);
        }

        $parts = [];
        $terms = [];
        $days = [];
        $variables = ['hourly_rate' => $v['hourly_rate']];
        $byDay = collect($v['ot_by_day'] ?? []);

        foreach (self::OVERTIME_TYPES as $type) {
            $mine = $byDay->where('type', $type);
            if ($mine->isEmpty()) {
                continue;
            }
            $multiplier = max((float) ($p[$type] ?? 0), $floor[$type]);
            $rule = $modes[$type] ?? ['mode' => 'per_hour'];
            $mode = $rule['mode'] ?? 'per_hour';
            $workedMinutes = (int) $mine->sum('minutes');
            $worked = round($workedMinutes / 60, 2);
            $variables["m_{$type}"] = $multiplier;

            if ($mode === 'fixed') {
                // One amount per overtime day; a short day under the minimum hours pays nothing.
                // With the Labor Law floors on, a day is never paid less than its hours at the legal rate.
                $amount = (float) $rule['amount'];
                $minMinutes = (int) round(((float) ($rule['min_hours'] ?? 0)) * 60);
                $count = 0;
                $raised = 0;
                $total = 0.0;
                foreach ($mine as $day) {
                    $hours = $day['minutes'] / 60;
                    $fixed = $day['minutes'] >= $minMinutes ? $amount : 0.0;
                    $pay = max($fixed, $hours * $v['hourly_rate'] * $floor[$type]);
                    $count += $day['minutes'] >= $minMinutes ? 1 : 0;
                    $raised += $pay > $fixed ? 1 : 0;
                    $total += $pay;
                    $days[] = $this->otDay($day, $type, null, $pay, $currency, match (true) {
                        $pay > $fixed => 'raised to the legal '.Money::quantity($floor[$type] * 100).'%',
                        $fixed <= 0 => 'under '.Money::quantity((float) ($rule['min_hours'] ?? 0)).' h',
                        default => 'fixed',
                    });
                }
                if ($raised === 0) {
                    $variables["ot_{$type}_days"] = $count;
                    $variables["ot_{$type}_amount"] = $amount;
                    $terms[] = "ot_{$type}_days * ot_{$type}_amount";
                } else {
                    $variables["ot_{$type}_fixed_total"] = round($total, 4);
                    $terms[] = "ot_{$type}_fixed_total";
                }
                $parts[] = $this->days($count).' × '.Money::format($amount, $currency)
                    .($raised > 0 ? " ({$raised} raised to the legal ".Money::quantity($floor[$type] * 100).'%)' : '');

                continue;
            }

            if ($mode === 'capped') {
                $capMinutes = (int) round(((float) $rule['cap_hours']) * 60);
                $paidMinutes = 0;
                foreach ($mine as $day) {
                    $paid = min($day['minutes'], $capMinutes);
                    $paidMinutes += $paid;
                    $days[] = $this->otDay($day, $type, $paid / 60, $paid / 60 * $v['hourly_rate'] * $multiplier, $currency, $paid < $day['minutes'] ? 'cap '.Money::quantity((float) $rule['cap_hours']).' h' : null);
                }
                $paid = round($paidMinutes / 60, 2);
                $variables["ot_{$type}_hours"] = $worked;
                $variables["ot_{$type}_paid_hours"] = $paid;
                $terms[] = "ot_{$type}_paid_hours * hourly_rate * m_{$type}";
                $parts[] = ($paid < $worked ? Money::quantity($worked).' h worked, '.Money::quantity($paid).' h paid (max '.Money::quantity((float) $rule['cap_hours']).' h a day)' : Money::quantity($paid).' h')
                    .' × '.Money::rate($v['hourly_rate'], $currency).' × '.Money::quantity($multiplier * 100).'%';

                continue;
            }

            foreach ($mine as $day) {
                $days[] = $this->otDay($day, $type, $day['minutes'] / 60, $day['minutes'] / 60 * $v['hourly_rate'] * $multiplier, $currency, null);
            }
            $variables["ot_{$type}_hours"] = $worked;
            $terms[] = "ot_{$type}_hours * hourly_rate * m_{$type}";
            $parts[] = Money::quantity($worked).' h × '.Money::rate($v['hourly_rate'], $currency).' × '.Money::quantity($multiplier * 100).'%';
        }

        if ($terms === []) {
            return null;
        }
        usort($days, fn (array $a, array $b) => strcmp($a['date'], $b['date']));

        // What the Labor Law minimums would pay for the same hours, so payroll can warn when this pays less.
        $legalPay = $byDay->sum(fn (array $day) => $day['minutes'] / 60 * $v['hourly_rate'] * (self::OVERTIME_MINIMUMS[$day['type']] ?? 1.5));

        return [implode(' + ', $terms), $variables, implode(' + ', $parts), ['days' => $days, 'legal_amount' => Money::round($legalPay, $currency)]];
    }

    /** Every hour × the hourly rate × the rate for the kind of day: the rule as it has always been. */
    private function overtimePerHour(array $p, array $v, string $currency, array $floor): ?array
    {
        $parts = [];
        $terms = [];
        $variables = ['hourly_rate' => $v['hourly_rate']];
        $legalPay = 0.0;

        foreach (['workday' => 'ot_workday_hours', 'day_off' => 'ot_day_off_hours', 'holiday' => 'ot_holiday_hours'] as $type => $hours) {
            if ($v[$hours] <= 0) {
                continue;
            }
            $multiplier = max((float) ($p[$type] ?? 0), $floor[$type]);
            $variables[$hours] = $v[$hours];
            $variables["m_{$type}"] = $multiplier;
            $terms[] = "{$hours} * hourly_rate * m_{$type}";
            $parts[] = Money::quantity($v[$hours]).' h × '.Money::rate($v['hourly_rate'], $currency).' × '.Money::quantity($multiplier * 100).'%';
            $legalPay += $v[$hours] * $v['hourly_rate'] * self::OVERTIME_MINIMUMS[$type];
        }

        return $terms === [] ? null : [implode(' + ', $terms), $variables, implode(' + ', $parts), ['legal_amount' => Money::round($legalPay, $currency)]];
    }

    /**
     * One overtime day as the payslip lists it.
     *
     * @param  array{date: string, type: string, minutes: int, recorded_minutes?: int}  $day
     * @return array{date: string, type: string, worked_hours: float, recorded_hours: float|null, paid_hours: float|null, amount: float, note: string|null}
     */
    private function otDay(array $day, string $type, ?float $paidHours, float $amount, string $currency, ?string $note): array
    {
        return [
            'date' => $day['date'],
            'type' => $type,
            'worked_hours' => round($day['minutes'] / 60, 2),
            // Approved in part: what the scans showed, above the approved hours. null = approved in full.
            'recorded_hours' => isset($day['recorded_minutes']) && $day['recorded_minutes'] > $day['minutes'] ? round($day['recorded_minutes'] / 60, 2) : null,
            'paid_hours' => $paidHours === null ? null : round($paidHours, 2),
            'amount' => Money::round($amount, $currency),
            'note' => $note,
        ];
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
