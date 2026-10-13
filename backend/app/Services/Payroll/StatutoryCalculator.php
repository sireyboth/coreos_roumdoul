<?php

namespace App\Services\Payroll;

/**
 * NSSF contributions and tax on salary, from the platform's rates. Both are
 * worked out in riel (the law's currency) and converted back to the
 * salary's currency at the month's tax exchange rate.
 */
final class StatutoryCalculator
{
    /**
     * @param  float  $rate  riel per one unit of $currency (1 for KHR)
     * @param  array<string, mixed>|null  $nssf  NSSF params in force, or null when not set up
     * @param  array<string, mixed>|null  $tax  tax on salary params in force, or null when not set up
     * @param  array<string, mixed>  $profile  EmployeePayProfile fields
     * @return array{nssf_employee: float, employer: array<string, float>, tax: float, lines: array<int, array<string, mixed>>}
     */
    public function calculate(string $currency, float $rate, float $insurable, float $taxable, array $profile, ?array $nssf, ?array $tax): array
    {
        $lines = [];
        $nssfEmployee = 0.0;
        $nssfEmployeeKhr = 0.0;
        $employer = [];

        if ($nssf && $profile['nssf_enrolled']) {
            $insuredKhr = min(max($insurable * $rate, (float) $nssf['wage_floor']), (float) $nssf['wage_ceiling']);
            $insuredWords = number_format($insuredKhr).' KHR insured wage';

            foreach ($nssf['employee'] as $fund => $share) {
                $khr = round($insuredKhr * $share);
                $nssfEmployeeKhr += $khr;
                $amount = Money::round($khr / $rate, $currency);
                $nssfEmployee += $amount;
                $lines[] = [
                    'code' => 'NSSF_'.strtoupper($fund).'_EE', 'name' => 'NSSF '.str_replace('_', ' ', $fund).' (employee)', 'kind' => 'statutory',
                    'amount' => $amount, 'explanation' => $insuredWords.' × '.Money::quantity($share * 100).'%',
                    'details' => ['insured_khr' => $insuredKhr, 'share' => $share, 'khr' => $khr, 'rate' => $rate],
                ];
            }

            foreach ($nssf['employer'] as $fund => $share) {
                $khr = round($insuredKhr * $share);
                $amount = Money::round($khr / $rate, $currency);
                $employer[$fund] = $amount;
                $lines[] = [
                    'code' => 'NSSF_'.strtoupper($fund).'_ER', 'name' => 'NSSF '.str_replace('_', ' ', $fund).' (employer)', 'kind' => 'employer',
                    'amount' => $amount, 'explanation' => $insuredWords.' × '.Money::quantity($share * 100).'%',
                    'details' => ['insured_khr' => $insuredKhr, 'share' => $share, 'khr' => $khr, 'rate' => $rate],
                ];
            }
        }

        $taxAmount = 0.0;
        if ($tax) {
            $taxableKhr = max(0.0, $taxable * $rate - (! empty($tax['deduct_employee_nssf']) ? $nssfEmployeeKhr : 0));

            if ($profile['tax_resident']) {
                $dependents = ($profile['spouse_dependent'] ? 1 : 0) + (int) $profile['child_dependents'];
                $base = max(0.0, $taxableKhr - $dependents * (float) $tax['dependent_allowance']);
                $taxKhr = round($this->progressive($base, $tax['brackets']));
                $explanation = number_format($base).' KHR taxable'.($dependents > 0 ? " after {$dependents} dependent".($dependents > 1 ? 's' : '') : '').' → '.number_format($taxKhr).' KHR';
            } else {
                $base = $taxableKhr;
                $taxKhr = round($base * (float) $tax['non_resident_rate']);
                $explanation = number_format($base).' KHR × '.Money::quantity($tax['non_resident_rate'] * 100).'% (non-resident) → '.number_format($taxKhr).' KHR';
            }

            $taxAmount = Money::round($taxKhr / $rate, $currency);
            if ($taxAmount > 0) {
                $lines[] = [
                    'code' => 'TAX', 'name' => 'Tax on salary', 'kind' => 'statutory', 'amount' => $taxAmount,
                    'explanation' => $explanation.($currency !== 'KHR' ? ' ÷ '.number_format($rate).' KHR' : ''),
                    'details' => ['taxable_khr' => $taxableKhr, 'base_khr' => $base, 'tax_khr' => $taxKhr, 'rate' => $rate],
                ];
            }
        }

        return ['nssf_employee' => $nssfEmployee, 'employer' => $employer, 'tax' => $taxAmount, 'lines' => $lines];
    }

    /** @param  array<int, array{up_to: ?float, rate: float}>  $brackets */
    private function progressive(float $amount, array $brackets): float
    {
        $tax = 0.0;
        $lower = 0.0;

        foreach ($brackets as $bracket) {
            $upper = $bracket['up_to'] ?? INF;
            if ($amount > $lower) {
                $tax += (min($amount, $upper) - $lower) * $bracket['rate'];
            }
            $lower = $upper;
        }

        return $tax;
    }
}
