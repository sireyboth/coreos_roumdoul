<?php

namespace App\Services\Attendance;

use Carbon\CarbonInterface;

/**
 * Decides which scan answers which expected slot — the "system decides
 * whether a scan is an IN or an OUT" part.
 *
 * Scans are NOT handed out in order (1st scan = slot 1, 2nd = slot 2 …):
 * one forgotten scan would then shift every later scan onto the wrong slot.
 * Instead this finds the order-preserving pairing with the lowest total
 * cost, where
 *   - pairing a scan with a slot costs the minutes between them,
 *   - leaving a slot unanswered costs MISSING_SLOT_COST,
 *   - leaving a scan unused costs EXTRA_SCAN_COST,
 * and a scan more than max_match_minutes from a slot can't be paired with it.
 *
 *   Expected  08:00 IN   12:00 OUT   13:00 IN   17:00 OUT
 *   Scans     08:07                  13:02      17:15
 *   Pairing   08:07      (missing)   13:02      17:15
 *
 * (13:02 is 2 minutes from the 13:00 IN but 62 from the 12:00 OUT, so it
 * answers the IN, and the lunch OUT is the one reported missing.)
 *
 * A standard dynamic-programming alignment: O(slots × scans), and both are
 * a handful per day.
 */
final class ScanMatcher
{
    private const MISSING_SLOT_COST = 240;

    private const EXTRA_SCAN_COST = 240;

    /**
     * @param  array<int, CarbonInterface>  $expected  slot times, in order
     * @param  array<int, CarbonInterface>  $scans  scan times, in order
     * @return array<int, int|null> for each slot index, the index of its scan (or null)
     */
    public static function match(array $expected, array $scans, ?int $maxMinutes = null): array
    {
        $maxMinutes ??= (int) config('attendance.max_match_minutes', 360);
        $n = count($expected);
        $m = count($scans);

        // cost[i][j]: cheapest way to settle the first i slots using the first j scans.
        $cost = array_fill(0, $n + 1, array_fill(0, $m + 1, PHP_INT_MAX));
        $step = array_fill(0, $n + 1, array_fill(0, $m + 1, null));
        $cost[0][0] = 0;

        for ($i = 0; $i <= $n; $i++) {
            for ($j = 0; $j <= $m; $j++) {
                if ($i === 0 && $j === 0) {
                    continue;
                }

                // Preference on a tie: pair them, then drop the scan, then miss the slot.
                $options = [];

                if ($i > 0 && $j > 0 && $cost[$i - 1][$j - 1] !== PHP_INT_MAX) {
                    $distance = self::minutesBetween($expected[$i - 1], $scans[$j - 1]);
                    if ($distance <= $maxMinutes) {
                        $options[] = [$cost[$i - 1][$j - 1] + $distance, 'pair'];
                    }
                }
                if ($j > 0 && $cost[$i][$j - 1] !== PHP_INT_MAX) {
                    $options[] = [$cost[$i][$j - 1] + self::EXTRA_SCAN_COST, 'extra'];
                }
                if ($i > 0 && $cost[$i - 1][$j] !== PHP_INT_MAX) {
                    $options[] = [$cost[$i - 1][$j] + self::MISSING_SLOT_COST, 'missing'];
                }

                foreach ($options as [$value, $kind]) {
                    if ($value < $cost[$i][$j]) {
                        $cost[$i][$j] = $value;
                        $step[$i][$j] = $kind;
                    }
                }
            }
        }

        // Walk back from the end to read off the pairing.
        $pairing = array_fill(0, $n, null);
        $i = $n;
        $j = $m;
        while ($i > 0 || $j > 0) {
            $kind = $step[$i][$j];

            if ($kind === 'pair') {
                $pairing[$i - 1] = $j - 1;
            }
            if ($kind === 'pair' || $kind === 'missing') {
                $i--;
            }
            if ($kind === 'pair' || $kind === 'extra') {
                $j--;
            }
        }

        return $pairing;
    }

    private static function minutesBetween(CarbonInterface $a, CarbonInterface $b): int
    {
        return (int) round(abs($a->getTimestamp() - $b->getTimestamp()) / 60);
    }
}
