<?php

namespace App\Services\Employees;

use App\Models\Company;
use App\Models\Employee;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Birthday alerts, part of the "birthdays" module. On each employee's
 * birthday, from SEND_FROM_HOUR in the company's timezone:
 *
 *  - the birthday person gets a happy-birthday alert;
 *  - everyone else with a login in the same branch and company is told it's
 *    their day, including owner/admin logins whose branch access covers it.
 *
 * Nothing is stored beyond the alerts themselves: the date comes from
 * employees.date_of_birth, and each alert's dedupe key (person + recipient +
 * date) keeps an hourly run from sending twice. Clicking one opens the
 * celebration modal (/dashboard?birthday={employee_id}).
 */
class BirthdayNotifier
{
    public const TYPE = 'birthday';

    public const MODULE = 'birthdays';

    /** Local hour alerts go out from; a later run the same day still sends them. */
    public const SEND_FROM_HOUR = 8;

    /** Sends today's birthday alerts for $company. Returns how many alerts were sent. */
    public function run(Company $company, ?CarbonImmutable $now = null): int
    {
        if (! $company->hasModule(self::MODULE)) {
            return 0;
        }

        $now = ($now ?? CarbonImmutable::now())->setTimezone($company->timezone ?: config('attendance.default_timezone'));

        if ($now->hour < self::SEND_FROM_HOUR) {
            return 0;
        }

        $birthdays = $this->employees($company)
            ->whereNotNull('date_of_birth')
            ->with('currentAssignment:id,employee_id,branch_id')
            ->get()
            ->filter(fn (Employee $employee) => $this->isBirthday($employee->date_of_birth, $now));

        $sent = 0;

        foreach ($birthdays as $employee) {
            $data = ['employee_id' => $employee->id, 'employee_name' => $employee->name];
            $link = "/dashboard?birthday={$employee->id}";
            $date = $now->toDateString();

            if ($self = $this->activeUser($employee)) {
                NotificationService::send(
                    $self, self::TYPE,
                    "Happy birthday, {$employee->name}!",
                    "Everyone at {$company->name} wishes you a wonderful day.",
                    data: [...$data, 'is_self' => true],
                    subject: $employee,
                    link: $link,
                    dedupeKey: self::TYPE.":{$employee->id}:{$self->id}:{$date}",
                );
                $sent++;
            }

            foreach ($this->colleagues($company, $employee) as $colleague) {
                NotificationService::send(
                    $colleague, self::TYPE,
                    "It's {$employee->name}'s birthday today",
                    'Take a moment to wish them a happy birthday!',
                    data: [...$data, 'is_self' => false],
                    subject: $employee,
                    link: $link,
                    dedupeKey: self::TYPE.":{$employee->id}:{$colleague->id}:{$date}",
                );
                $sent++;
            }
        }

        return $sent;
    }

    /** Feb 29 birthdays are celebrated on Feb 28 in other years. */
    private function isBirthday(\DateTimeInterface $dateOfBirth, CarbonImmutable $today): bool
    {
        $month = (int) $dateOfBirth->format('n');
        $day = (int) $dateOfBirth->format('j');

        if ($month === 2 && $day === 29 && ! $today->isLeapYear()) {
            $day = 28;
        }

        return $today->month === $month && $today->day === $day;
    }

    /** People still working here, ignoring whoever (if anyone) is signed in. */
    private function employees(Company $company): Builder
    {
        return Employee::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereNotIn('employment_status', Employee::LEFT_STATUSES);
    }

    /**
     * Everyone else with an active login in $employee's branch (same company only):
     *
     *  - staff logins (linked to an employee) whose employee works in that branch;
     *  - logins with no employee record (owner, admin, HR) whose branch access
     *    covers that branch. No branch restriction means every branch.
     *
     * Someone with no branch has no colleagues to tell.
     *
     * @return Collection<int, User>
     */
    private function colleagues(Company $company, Employee $employee): Collection
    {
        $branchId = $employee->currentAssignment?->branch_id;

        if (! $branchId) {
            return collect();
        }

        $staff = $this->employees($company)
            ->where('id', '!=', $employee->id)
            ->whereNotNull('user_id')
            ->whereHas('currentAssignment', fn (Builder $q) => $q->withoutGlobalScopes()->where('branch_id', $branchId))
            ->with('user.membership')
            ->get()
            ->map(fn (Employee $colleague) => $this->activeUser($colleague))
            ->filter();

        // Logins tied to any employee in this company are placed by that employee's
        // branch above, so only logins without one are matched by branch access.
        $linkedUserIds = Employee::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->whereNotNull('user_id')
            ->select('user_id');

        $managers = User::query()
            ->where('is_active', true)
            ->whereNotIn('id', $linkedUserIds)
            ->whereHas('membership', fn (Builder $q) => $q
                ->where('company_id', $company->id)
                ->where('status', 'active')
                ->where(fn (Builder $q) => $q
                    ->whereDoesntHave('branchAccess')
                    ->orWhereHas('branchAccess', fn (Builder $q) => $q->where('branch_id', $branchId))))
            ->get();

        return $staff->concat($managers)
            ->filter(fn (?User $user) => $user && $user->id !== $employee->user_id)
            ->unique('id')
            ->values();
    }

    private function activeUser(Employee $employee): ?User
    {
        $user = $employee->user;

        return $user?->is_active && $user->membership?->status === 'active' ? $user : null;
    }
}
