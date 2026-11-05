<?php

namespace App\Support;

use App\Models\Company;
use App\Models\LeaveType;

/**
 * How attendance statuses look everywhere they are shown (report, calendar,
 * attendance list, Excel, PDF): a short code, a background colour, a text
 * colour and bold or not. A company changes them in one place (Attendance →
 * Status codes), never the meaning — a status is worked out from scans and the
 * schedule, and totals, payroll and warnings use the status, not its code.
 *
 * Day statuses are kept on the company; each leave type keeps its own look on
 * its row (it is created per company), edited in the same place.
 */
class ReportCodes
{
    /** Each day status, with its default look. */
    public const DEFAULTS = [
        'P' => ['code' => 'P', 'color' => 'green', 'text' => 'auto', 'bold' => true],
        'L' => ['code' => 'L', 'color' => 'amber', 'text' => 'auto', 'bold' => true],
        'E' => ['code' => 'E', 'color' => 'yellow', 'text' => 'auto', 'bold' => true],
        'LE' => ['code' => 'LE', 'color' => 'gold', 'text' => 'auto', 'bold' => true],
        'M' => ['code' => 'M', 'color' => 'orange', 'text' => 'auto', 'bold' => true],
        'A' => ['code' => 'A', 'color' => 'red', 'text' => 'auto', 'bold' => true],
        'W' => ['code' => 'W', 'color' => 'blue', 'text' => 'auto', 'bold' => true],
        'H' => ['code' => 'H', 'color' => 'gray', 'text' => 'auto', 'bold' => true],
        'OFF' => ['code' => 'OFF', 'color' => 'light', 'text' => 'auto', 'bold' => true],
    ];

    /** Background colours a day status can take; none is a leave colour, so leave always stands apart. */
    public const COLORS = ['green', 'amber', 'yellow', 'gold', 'orange', 'red', 'blue', 'gray', 'light'];

    /** Text colours for any code; "auto" = the background's own dark shade. */
    public const TEXT_COLORS = ['auto', 'dark', 'white', 'red', 'green', 'blue', 'orange', 'violet', 'gray'];

    /** The built-in leave types' default code and colour, for new companies and "Reset to default". */
    public const LEAVE_DEFAULTS = [
        'annual' => ['AL', 'violet'],
        'sick' => ['SL', 'pink'],
        'special' => ['SP', 'indigo'],
        'maternity' => ['ML', 'fuchsia'],
        'paternity' => ['PL', 'cyan'],
        'unpaid' => ['UL', 'slate'],
    ];

    /** @return array<string, array{code: string, color: string, text: string, bold: bool}> every status, the company's own over the defaults */
    public static function forCompany(Company $company): array
    {
        $saved = $company->report_codes ?? [];

        return collect(self::DEFAULTS)
            ->map(fn (array $default, string $status) => [...$default, ...array_intersect_key($saved[$status] ?? [], $default)])
            ->all();
    }

    /** Each leave type's look, in the company's order, as the settings page and the report read it. */
    public static function leaveFor(): array
    {
        return LeaveType::query()
            ->orderByRaw('sort_order IS NULL')->orderBy('sort_order')->orderBy('name')
            ->get()
            ->map(fn (LeaveType $t) => [
                'id' => $t->id,
                'code' => $t->code,
                'name' => $t->name,
                'name_km' => $t->name_km,
                'report_code' => $t->report_code,
                'color' => $t->color ?? 'violet',
                'text' => $t->text_color ?? 'auto',
                'bold' => $t->bold,
                'pay_percent' => $t->pay_percent,
                'is_active' => $t->is_active,
            ])
            ->all();
    }

    /**
     * Codes no leave type may take: the defaults (so "Reset to default" never
     * clashes), the company's own, and LV (leave without a code of its own).
     *
     * @return list<string>
     */
    public static function taken(Company $company): array
    {
        return collect(self::DEFAULTS)->pluck('code')
            ->merge(collect(self::forCompany($company))->pluck('code'))
            ->push('LV')
            ->unique()->values()->all();
    }
}
