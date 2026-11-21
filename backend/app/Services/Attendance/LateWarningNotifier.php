<?php

namespace App\Services\Attendance;

use App\Models\AttendanceDay;
use App\Models\Company;
use App\Models\Employee;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\Telegram\TelegramCard;
use App\Services\Telegram\TelegramGroupPoster;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Automatic late warnings. When someone is late (and, if the company counts
 * it, leaves early) late_warning_limit times in a calendar month, the
 * employee and HR for their branch (attendance.manage) are told — and again
 * at each further multiple: with a limit of 3, at the 3rd, 6th, 9th…
 *
 *  - Counts come from the calculated attendance days, so approved late /
 *    early requests (judged against the new time) and corrected days never
 *    count. A day both late and early counts once.
 *  - Off when the company's limit is null (the default).
 *  - Each level is sent once per person per month (the dedupe key holds the
 *    month and the level), so the hourly run never repeats itself. A day
 *    corrected later doesn't take back a warning already sent.
 *  - The company's Telegram group (if linked, with late warnings ticked)
 *    gets one card per level (TelegramCard): who, where they work, the
 *    count and the days — never pay.
 *
 * Run hourly from SEND_FROM_HOUR in the company's timezone (attendance:late-warnings).
 */
class LateWarningNotifier
{
    public const TYPE = 'attendance.late_warning';

    public const LINK = '/dashboard/attendance';

    public const SEND_FROM_HOUR = 8;

    public function __construct(private readonly AttendanceNotifier $directory, private readonly TelegramGroupPoster $telegram) {}

    /** Sends the warnings due now for $company. Returns how many alerts were sent. */
    public function run(Company $company, ?CarbonImmutable $now = null): int
    {
        $limit = $company->late_warning_limit;
        $now = ($now ?? CarbonImmutable::now())->setTimezone($company->timezone ?: config('attendance.default_timezone'));

        if (! $limit || $now->hour < self::SEND_FROM_HOUR) {
            return 0;
        }

        $countsEarly = $company->late_warning_counts_early;
        $month = $now->format('Y-m');

        // Every late (or early) day this month so far, per person.
        $days = AttendanceDay::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            // whereDate, not whereBetween: today must count even where dates are stored with a time.
            ->whereDate('date', '>=', $now->startOfMonth()->toDateString())
            ->whereDate('date', '<=', $now->toDateString())
            ->where(fn ($q) => $q->where('late_minutes', '>', 0)->when($countsEarly, fn ($q) => $q->orWhere('early_leave_minutes', '>', 0)))
            ->orderBy('date')
            ->get(['employee_id', 'date', 'late_minutes', 'early_leave_minutes'])
            ->groupBy('employee_id')
            ->filter(fn (Collection $list) => $list->count() >= $limit);

        if ($days->isEmpty()) {
            return 0;
        }

        $employees = Employee::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereIn('id', $days->keys())
            ->whereNotIn('employment_status', Employee::LEFT_STATUSES)
            ->with(['currentAssignment:id,employee_id,branch_id,department_id,job_title', 'user'])
            ->get();

        $sent = 0;

        foreach ($employees as $employee) {
            $list = $days->get($employee->id);
            $count = $list->count();
            // 3 → level 1, 6 → level 2; only the level reached now is sent.
            $level = intdiv($count, $limit);
            $what = $countsEarly ? 'late or left early' : 'late';
            $dayLines = $this->dayLines($list, $countsEarly);
            // In the app: "Tue 3 Nov late 15 min; Thu 5 Nov left early 20 min".
            $detail = implode('; ', array_map(fn (array $line) => "{$line[0]} {$line[1]}", $dayLines));

            // The employee, if they can sign in.
            $own = $employee->user;
            if ($own instanceof User && $own->is_active) {
                $sent += $this->send(
                    $own, $employee, $month, $level,
                    title: "⚠️ You were {$what} {$count} times this month",
                    body: "{$detail}. Please be on time — HR has been told.",
                );
            }

            foreach ($this->directory->managersFor($employee) as $hr) {
                if ($hr->id === $employee->user_id) {
                    continue;
                }

                $sent += $this->send(
                    $hr, $employee, $month, $level,
                    title: "⚠️ {$employee->name}: {$what} {$count} times this month",
                    body: "{$detail}.",
                );
            }

            // The company's Telegram group, once per level: who, how often, and which days.
            $details = [
                '🔁 '.ucfirst($what)." {$count} times in ".$now->format('F Y'),
                ...array_map(fn (array $line) => "   • {$line[0]} — {$line[1]}", $dayLines),
            ];
            $this->telegram->post(
                $company->id, 'late_warnings', "late_warning:{$employee->id}:{$month}:{$level}", $employee,
                fn (string $detail) => TelegramCard::make('⚠️ LATE WARNING', $employee, $details, $detail),
            );
        }

        return $sent;
    }

    /**
     * One [day, what] per day: [["Tue 3 Nov", "late 15 min"], ["Thu 5 Nov", "left early 20 min"]].
     *
     * @return list<array{0: string, 1: string}>
     */
    private function dayLines(Collection $list, bool $countsEarly): array
    {
        return $list->map(function (AttendanceDay $day) use ($countsEarly) {
            $parts = array_filter([
                $day->late_minutes > 0 ? "late {$day->late_minutes} min" : null,
                $countsEarly && $day->early_leave_minutes > 0 ? "left early {$day->early_leave_minutes} min" : null,
            ]);

            return [CarbonImmutable::parse($day->date)->format('D j M'), implode(', ', $parts)];
        })->values()->all();
    }

    /** 1 when sent, 0 when this level already went to this person. */
    private function send(User $recipient, Employee $employee, string $month, int $level, string $title, string $body): int
    {
        $notification = NotificationService::send(
            $recipient, self::TYPE, $title, $body,
            data: ['employee_id' => $employee->id, 'employee_name' => $employee->name, 'month' => $month, 'level' => $level],
            subject: $employee,
            link: self::LINK,
            dedupeKey: self::TYPE.":{$employee->id}:{$month}:{$level}:{$recipient->id}",
        );

        return $notification->wasRecentlyCreated ? 1 : 0;
    }
}
