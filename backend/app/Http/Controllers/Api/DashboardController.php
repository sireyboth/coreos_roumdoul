<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCorrection;
use App\Models\AttendanceSession;
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
        $sessions = fn () => AttendanceSession::query()->whereHas('employee', function ($q) use ($user, $manages) {
            if (! $manages) {
                $q->where('user_id', $user->id);
            }
        });

        $days = collect(range(6, 0))->map(fn (int $ago) => CarbonImmutable::parse($today)->subDays($ago)->toDateString());

        $perDay = $sessions()
            ->whereDate('date', '>=', $days->first())->whereDate('date', '<=', $today)
            ->whereNotNull('check_in_event_id')
            ->selectRaw('date as day, count(*) as total')->groupBy('date')
            ->get()
            ->mapWithKeys(fn ($row) => [substr((string) $row->day, 0, 10) => (int) $row->total]);

        $recent = $sessions()->with(['employee', 'checkInEvent', 'checkOutEvent'])
            ->orderByDesc('date')->orderByDesc('id')->limit(6)->get()
            ->map(fn (AttendanceSession $s) => [
                'id' => $s->id,
                'date' => $s->date->toDateString(),
                'status' => $s->status,
                'late_minutes' => $s->late_minutes,
                'check_in' => $s->checkInEvent?->event_time?->setTimezone($timezone)->format('H:i'),
                'check_out' => $s->checkOutEvent?->event_time?->setTimezone($timezone)->format('H:i'),
                'employee' => [
                    'id' => $s->employee->id,
                    'name' => $s->employee->name,
                    'photo_url' => $s->employee->append('photo_url')->photo_url,
                ],
            ]);

        $summary['attendance'] = [
            'checked_in_today' => (int) ($perDay[$today] ?? 0),
            'late_today' => $sessions()->whereDate('date', $today)->whereNotNull('check_in_event_id')->where('late_minutes', '>', 0)->count(),
            'pending_corrections' => AttendanceCorrection::query()->where('status', 'pending')
                ->when(! $manages, fn ($q) => $q->whereHas('employee', fn ($e) => $e->where('user_id', $user->id)))
                ->count(),
            // Last 7 days, oldest first, including days with none.
            'week' => $days->map(fn (string $day) => ['date' => $day, 'count' => (int) ($perDay[$day] ?? 0)])->values(),
            'recent' => $recent,
        ];

        return $summary;
    }
}
