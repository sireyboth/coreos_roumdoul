<?php

namespace App\Http\Controllers\Api\Access;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\PlatformAdmin;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The company's activity log, read-only: who did what, when and from where.
 *
 * Three walls, in order:
 * 1. Company — AuditLog's BelongsToCompany scope; another tenant's rows never load.
 * 2. Branch — a user limited to some branches sees only rows stamped with
 *    those branches. Company-wide rows (roles, pay rules…) have no branch, so
 *    only people who can see every branch see them.
 * 3. Pay — salary and payroll rows hold amounts, so they need the same
 *    permission as the pages that show those amounts.
 */
class AuditLogController extends Controller
{
    /**
     * Areas of the app, by the first part of the event name ("employee.updated"
     * → employee → people). Also what the "Area" filter offers.
     */
    private const MODULES = [
        'people' => ['employee', 'department', 'team', 'branch', 'work_location'],
        'attendance' => ['attendance', 'attendance_event', 'attendance_correction', 'attendance_period'],
        'schedules' => ['schedule', 'work_schedule', 'employee_schedule_assignment', 'day_off', 'holiday'],
        'requests' => ['request', 'employee_request', 'leave_type', 'leave_adjustment', 'request_type_setting'],
        'salary' => ['employee_salary', 'employee_pay_item', 'employee_pay_profile', 'employee_pay_group'],
        'payroll' => ['pay_run', 'payslip', 'pay_component', 'pay_group', 'payroll_policy', 'payroll_adjustment', 'statutory_rate', 'tax_exchange_rate'],
        'access' => ['user', 'role'],
        'company' => ['company', 'company_module_entitlement', 'subscription', 'support_access'],
    ];

    /** Areas that show money: hidden from anyone who can't see it elsewhere. */
    private const MODULE_PERMISSION = ['salary' => 'salary.view', 'payroll' => 'payroll.view'];

    /** Never sent to the browser, even to an admin: secrets and their hashes. */
    private const SECRET_KEYS = '/password|token|secret|remember/i';

    public function index(Request $request)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'user_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'module' => ['nullable', Rule::in(array_keys(self::MODULES))],
            'action' => ['nullable', Rule::in(['created', 'updated', 'deleted'])],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $timezone = $request->user()->company?->timezone ?: config('attendance.default_timezone', 'UTC');
        $query = $this->visible($request)->with(['actor', 'branch:id,name']);

        if (! empty($data['from'])) {
            $query->where('created_at', '>=', CarbonImmutable::parse($data['from'], $timezone)->startOfDay()->utc());
        }
        if (! empty($data['to'])) {
            $query->where('created_at', '<', CarbonImmutable::parse($data['to'], $timezone)->addDay()->startOfDay()->utc());
        }
        if (! empty($data['user_id'])) {
            $query->where('actor_type', (new User)->getMorphClass())->where('actor_id', $data['user_id']);
        }
        if (! empty($data['branch_id'])) {
            $query->where('branch_id', $data['branch_id']);
        }
        if (! empty($data['module'])) {
            $this->whereModule($query, self::MODULES[$data['module']]);
        }
        if (! empty($data['action'])) {
            // "%deleted" also catches named ones such as attendance.day_deleted.
            $query->where('event', 'like', '%'.$data['action']);
        }
        if (! empty($data['search'])) {
            $term = '%'.mb_strtolower($data['search']).'%';
            $query->where(fn (Builder $q) => $q
                ->whereRaw('LOWER(subject_label) LIKE ?', [$term])
                ->orWhereRaw('LOWER(event) LIKE ?', [$term])
                ->orWhereRaw('LOWER(reason) LIKE ?', [$term])
                ->orWhere('ip_address', 'like', $term));
        }

        $hiddenFields = $this->hiddenEmployeeFields($request);

        return $query
            ->orderByDesc('id')
            ->paginate($data['per_page'] ?? 50)
            ->through(fn (AuditLog $log) => $this->present($log, $hiddenFields));
    }

    /** What the filters can offer: only people and branches this viewer may see. */
    public function options(Request $request)
    {
        $actorIds = $this->visible($request)
            ->where('actor_type', (new User)->getMorphClass())
            ->distinct()
            ->pluck('actor_id');

        $branchIds = $request->user()->membership?->accessibleBranchIds();

        return [
            'users' => User::query()->whereIn('id', $actorIds)->orderBy('name')->get(['id', 'name']),
            'branches' => Branch::query()
                ->when($branchIds !== null, fn (Builder $q) => $q->whereIn('id', $branchIds))
                ->orderBy('name')
                ->get(['id', 'name']),
            'modules' => array_values(array_filter(
                array_keys(self::MODULES),
                fn (string $module) => $this->canSeeModule($request, $module),
            )),
        ];
    }

    /** Every row this viewer is allowed to see, before any filter they chose. */
    private function visible(Request $request): Builder
    {
        $query = AuditLog::query();
        $branchIds = $request->user()->membership?->accessibleBranchIds();

        if ($branchIds !== null) {
            $query->whereIn('branch_id', $branchIds);
        }

        $hidden = [];
        foreach (array_keys(self::MODULE_PERMISSION) as $module) {
            if (! $this->canSeeModule($request, $module)) {
                array_push($hidden, ...self::MODULES[$module]);
            }
        }

        if ($hidden !== []) {
            $query->whereNot(fn (Builder $q) => $this->whereModule($q, $hidden));
        }

        return $query;
    }

    private function canSeeModule(Request $request, string $module): bool
    {
        $permission = self::MODULE_PERMISSION[$module] ?? null;

        return $permission === null || $request->user()->hasCompanyPermission($permission);
    }

    /** @param  array<int, string>  $prefixes */
    private function whereModule(Builder $query, array $prefixes): Builder
    {
        return $query->where(function (Builder $q) use ($prefixes) {
            foreach ($prefixes as $prefix) {
                $q->orWhere('event', 'like', $prefix.'.%');
            }
        });
    }

    private function moduleOf(string $event): ?string
    {
        $prefix = Str::before($event, '.');

        foreach (self::MODULES as $module => $prefixes) {
            if (in_array($prefix, $prefixes, true)) {
                return $module;
            }
        }

        return null;
    }

    /**
     * An employee's row records every column, pay and ID numbers included —
     * shown here only to people who could see them on the employee page.
     *
     * @return array<int, string>
     */
    private function hiddenEmployeeFields(Request $request): array
    {
        $user = $request->user();

        return [
            ...($user->hasCompanyPermission('employees.manage') ? [] : Employee::PERSONAL_FIELDS),
            ...($user->hasCompanyPermission('salary.view') ? [] : Employee::SALARY_FIELDS),
        ];
    }

    /** @param  array<int, string>  $hiddenFields  employee columns this viewer may not see */
    private function present(AuditLog $log, array $hiddenFields = []): array
    {
        $hide = Str::before($log->event, '.') === 'employee' ? $hiddenFields : [];

        $actor = match (true) {
            // Platform staff act on a company only through support access; their own identity stays internal.
            $log->actor_type === (new PlatformAdmin)->getMorphClass() => ['type' => 'support', 'id' => null, 'name' => 'Platform support'],
            $log->actor instanceof User => ['type' => 'user', 'id' => $log->actor->id, 'name' => $log->actor->name],
            $log->actor_id !== null => ['type' => 'user', 'id' => $log->actor_id, 'name' => 'Removed user'],
            default => ['type' => 'system', 'id' => null, 'name' => 'System'],
        };

        return [
            'id' => $log->id,
            'created_at' => $log->created_at?->toIso8601String(),
            'event' => $log->event,
            'module' => $this->moduleOf($log->event),
            'actor' => $actor,
            'subject' => $log->subject_type ? [
                'type' => Str::headline(class_basename($log->subject_type)),
                'id' => $log->subject_id,
                'label' => $log->subject_label,
            ] : null,
            'branch' => $log->branch ? ['id' => $log->branch->id, 'name' => $log->branch->name] : null,
            'reason' => $log->reason,
            'before' => $this->withoutSecrets($log->before_data, $hide),
            'after' => $this->withoutSecrets($log->after_data, $hide),
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'method' => $log->method,
            'path' => $log->path,
        ];
    }

    /** @param  array<int, string>  $hide  more keys to leave out */
    private function withoutSecrets(?array $data, array $hide = []): ?array
    {
        if ($data === null) {
            return null;
        }

        return collect($data)
            ->reject(fn ($value, $key) => preg_match(self::SECRET_KEYS, (string) $key) || in_array($key, $hide, true))
            ->all();
    }
}
