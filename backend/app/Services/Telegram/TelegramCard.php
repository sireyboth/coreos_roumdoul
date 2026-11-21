<?php

namespace App\Services\Telegram;

use App\Models\Employee;
use App\Models\EmployeeAssignment;

/**
 * The one layout for every Telegram group post about an employee, so a group
 * that gets posts about many people can tell at a glance who and where:
 *
 *   ⚠️ LATE WARNING
 *   ━━━━━━━━━━━━━━
 *   👤 RAKSA SENG (សេង រក្សា)
 *   🆔 X41-26052410 · Barista
 *   🏢 Barista · EXPRESS 41 - BK
 *   ━━━━━━━━━━━━━━
 *   🔁 3 times in November 2026
 *
 * Who-lines with nothing to show (no code, no branch …) are left out. Only
 * work details go here — never phone, pay, reasons or remarks: everyone in
 * the group reads it.
 */
final class TelegramCard
{
    private const RULE = '━━━━━━━━━━━━━━';

    /**
     * @param  list<string>  $details  lines under the employee block
     * @param  string  $detail  TelegramGroup::DETAILS — the group's choice
     */
    public static function make(string $heading, Employee $employee, array $details, string $detail = 'full'): string
    {
        return implode("\n", [$heading, self::RULE, ...self::employee($employee, $detail), self::RULE, ...$details]);
    }

    /**
     * full:  👤 Name (Khmer name) / 🆔 code · job / 🏢 department · branch
     * basic: 👤 Name / 🏢 branch — for groups many people read.
     *
     * @return list<string>
     */
    public static function employee(Employee $employee, string $detail = 'full'): array
    {
        $employee->loadMissing(['currentAssignment.branch:id,name', 'currentAssignment.department:id,name']);
        $assignment = $employee->currentAssignment;
        $assignment = $assignment instanceof EmployeeAssignment ? $assignment : null;
        $full = $detail !== 'basic';

        // The Khmer name only when it adds something (not empty, not the same text).
        $km = trim((string) $employee->name_km);
        $lines = ['👤 '.$employee->name.($full && $km !== '' && $km !== $employee->name ? " ({$km})" : '')];

        if ($full && ($who = self::join([$employee->employee_code, $assignment?->job_title]))) {
            $lines[] = "🆔 {$who}";
        }
        if ($where = self::join([$full ? $assignment?->department?->name : null, $assignment?->branch?->name])) {
            $lines[] = "🏢 {$where}";
        }

        return $lines;
    }

    /** The employee's current branch — which branch groups a post about them goes to. */
    public static function branchOf(Employee $employee): ?int
    {
        $employee->loadMissing('currentAssignment');
        $assignment = $employee->currentAssignment;

        return $assignment instanceof EmployeeAssignment ? $assignment->branch_id : null;
    }

    /** @param  array<int, string|null>  $parts */
    private static function join(array $parts): string
    {
        return implode(' · ', array_filter(array_map(fn ($part) => trim((string) $part), $parts), fn ($part) => $part !== ''));
    }
}
