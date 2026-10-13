<?php

namespace App\Services\Payroll;

/** Rounding and display for the two pay currencies: dollars to the cent, riel to the whole riel. */
final class Money
{
    public static function decimals(string $currency): int
    {
        return $currency === 'KHR' ? 0 : 2;
    }

    public static function round(float $amount, string $currency): float
    {
        return round($amount, self::decimals($currency));
    }

    /** "1,234.50" for USD, "1,234,500" for KHR. */
    public static function format(float $amount, string $currency): string
    {
        return number_format($amount, self::decimals($currency));
    }

    /** A rate shown with enough precision to check the maths: "0.0417". */
    public static function rate(float $rate, string $currency): string
    {
        $decimals = $currency === 'KHR' ? 2 : 4;

        return rtrim(rtrim(number_format($rate, $decimals, '.', ','), '0'), '.') ?: '0';
    }

    /** A count of days or hours without trailing zeros: "1.5", "2". */
    public static function quantity(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.') ?: '0';
    }
}
