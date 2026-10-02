<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\AttendanceDay;
use App\Models\Branch;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Everything the dashboard shows in one small response, counted in the
 * database. The dashboard used to download whole attendance/employee lists to
 * count them in the browser — slow, and wrong once a list passed one page.
 *
 * Each section is only included when the caller may see that data.
 */
class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();
        $company = $user->company;
        $timezone = $company->timezone ?: config('attendance.default_timezone');
        $today = now($timezone)->toDateString();

        // Each permission is looked up once — not again for every sub-query below.
        $canViewEmployees = $user->hasCompanyPermission('employees.view');
        $canViewBranches = $user->hasCompanyPermission('branches.view');
        $canViewAttendance = $user->hasCompanyPermission('attendance.view');

        $summary = [
            'today' => $today,
            'employees' => $canViewEmployees ? Employee::query()->count() : null,
            'branches' => $canViewBranches ? Branch::query()->count() : null,
            'attendance' => null,
        ];

        if (! $canViewAttendance || ! $company->hasModule('attendance')) {
            return $summary;
        }

        $manages = $user->hasCompanyPermission('attendance.manage');

        // Managers see everyone they're allowed to see; anyone else, only themselves.
        // whereHas('employee') also applies a branch-limited manager's branch restriction.
        $days = fn () => AttendanceDay::query()->whereHas('employee', function ($q) use ($user, $manages) {
            if (! $manages) {
                $q->where('user_id', $user->id);
            }
        });

        $week = collect(range(6, 0))->map(fn (int $ago) => CarbonImmutable::parse($today)->subDays($ago)->toDateString());

        $perDay = $days()
            ->whereDate('date', '>=', $week->first())->whereDate('date', '<=', $today)
            ->where('scan_count', '>', 0)
            // Late people counted in the same pass, so it costs no extra query.
            ->selectRaw('date as day, count(*) as total, sum(case when late_minutes > 0 then 1 else 0 end) as late')->groupBy('date')
            ->get()
            ->keyBy(fn ($row) => substr((string) $row->day, 0, 10));

        $recent = $days()->with('employee')
            ->where('scan_count', '>', 0)
            ->orderByDesc('date')->orderByDesc('last_scan_at')->limit(6)->get()
            ->map(fn (AttendanceDay $d) => [
                'id' => $d->id,
                'date' => $d->date->toDateString(),
                'status' => $d->status,
                'late_minutes' => $d->late_minutes,
                'check_in' => $d->first_scan_at?->setTimezone($timezone)->format('H:i'),
                // Only a real "last" scan once there's more than one.
                'check_out' => $d->scan_count > 1 ? $d->last_scan_at?->setTimezone($timezone)->format('H:i') : null,
                'exceptions' => $d->exceptions ?? [],
                'employee' => [
                    'id' => $d->employee->id,
                    'name' => $d->employee->name,
                    'photo_url' => $d->employee->append('photo_url')->photo_url,
                ],
            ]);

        $summary['attendance'] = [
            'checked_in_today' => (int) ($perDay[$today]->total ?? 0),
            'late_today' => (int) ($perDay[$today]->late ?? 0),
            'pending_corrections' => AttendanceCorrection::query()->where('status', 'pending')
                ->when(! $manages, fn ($q) => $q->whereHas('employee', fn ($e) => $e->where('user_id', $user->id)))
                ->count(),
            'pending_overtime' => $manages ? $days()->where('overtime_status', 'pending')->count() : null,
            // Last 7 days, oldest first, including days with none.
            'week' => $week->map(fn (string $day) => ['date' => $day, 'count' => (int) ($perDay[$day]->total ?? 0)])->values(),
            'recent' => $recent,
        ];

        return $summary;
    }
}
