<?php

namespace App\Services\Requests;

use App\Models\Employee;
use App\Models\EmployeeRequestDay;
use App\Models\LeaveAdjustment;
use App\Models\LeaveType;
use Carbon\CarbonImmutable;

/**
 * How much leave of one type someone has in one calendar year. Never stored —
 * always worked out, so it can't drift from the requests behind it:
 *
 *   available = earned + adjustments − approved − pending
 *
 * Earned:
 *  - monthly  yearly_days / 12 for each full month of service in the year,
 *             counted up to the date asked about (Cambodia: 1.5 a month)
 *  - yearly   yearly_days every year (special leave: 7)
 *  - none     0 — only adjustments give a balance
 * Seniority adds seniority_extra_days for every seniority_every_years of
 * service completed by the start of the year (+1 day per 3 years).
 *
 * Pending requests hold their days, so two requests sent at once can't both
 * spend the same balance.
 */
final class LeaveBalance
{
    /**
     * @return array{year: int, earned: float, full_year: float, adjustments: float, used: float, pending: float, available: float}
     */
    public function for(Employee $employee, LeaveType $type, int $year, ?string $asOf = null, ?int $exceptRequestId = null): array
    {
        $asOf ??= CarbonImmutable::now($this->timezone($employee))->toDateString();

        $earned = $this->earned($employee, $type, $year, $asOf);
        $fullYear = $this->earned($employee, $type, $year, "{$year}-12-31");
        $adjustments = (float) LeaveAdjustment::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)->where('leave_type_id', $type->id)->where('year', $year)
            ->sum('days');
        $used = $this->taken($employee, $type, $year, 'approved', $exceptRequestId);
        $pending = $this->taken($employee, $type, $year, 'pending', $exceptRequestId);

        return [
            'year' => $year,
            'earned' => $earned,
            'full_year' => $fullYear,
            'adjustments' => round($adjustments, 2),
            'used' => $used,
            'pending' => $pending,
            'available' => round($earned + $adjustments - $used - $pending, 2),
        ];
    }

    public function earned(Employee $employee, LeaveType $type, int $year, string $asOf): float
    {
        if ($type->accrual === 'none' || ! $type->yearly_days) {
            return 0.0;
        }

        $yearStart = CarbonImmutable::create($year, 1, 1);
        $yearEnd = CarbonImmutable::create($year, 12, 31);
        $hired = $employee->hire_date ? CarbonImmutable::parse($employee->hire_date) : null;
        $until = CarbonImmutable::parse($asOf)->min($yearEnd);

        if ($hired && $hired->gt($until)) {
            return 0.0;
        }

        $perYear = (float) $type->yearly_days + $this->seniorityDays($type, $hired, $yearStart);

        if ($type->accrual === 'yearly') {
            return round($perYear, 2);
        }

        // Full months of service inside the year, up to $until (a month ending
        // on $until counts): hired 15 Mar, asked on 14 Apr → 1 month.
        $from = $hired && $hired->gt($yearStart) ? $hired : $yearStart;
        $months = min(12, (int) $from->diffInMonths($until->addDay()));

        return round($perYear / 12 * $months, 2);
    }

    private function seniorityDays(LeaveType $type, ?CarbonImmutable $hired, CarbonImmutable $yearStart): float
    {
        if (! $hired || ! $type->seniority_every_years || ! $type->seniority_extra_days || $hired->gte($yearStart)) {
            return 0.0;
        }

        $years = (int) $hired->diffInYears($yearStart);

        return intdiv($years, $type->seniority_every_years) * (float) $type->seniority_extra_days;
    }

    private function taken(Employee $employee, LeaveType $type, int $year, string $status, ?int $exceptRequestId): float
    {
        return round((float) EmployeeRequestDay::query()
            ->where('employee_id', $employee->id)
            ->whereYear('date', $year)
            ->whereHas('request', fn ($q) => $q->withoutGlobalScopes()
                ->where('leave_type_id', $type->id)
                ->where('status', $status)
                ->when($exceptRequestId, fn ($r) => $r->whereKeyNot($exceptRequestId)))
            ->sum('portion'), 2);
    }

    private function timezone(Employee $employee): string
    {
        return $employee->company?->timezone ?: config('attendance.default_timezone');
    }
}
