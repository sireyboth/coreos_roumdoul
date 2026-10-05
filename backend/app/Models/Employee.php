<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use App\Models\Concerns\RestrictedToAccessibleBranches;
use App\Services\UsageRecorder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Support\Facades\URL;

class Employee extends Model
{
    use Auditable, BelongsToCompany, HasFactory, RestrictedToAccessibleBranches;

    protected static function booted(): void
    {
        $recordCount = function (self $employee) {
            UsageRecorder::record($employee->company, 'employees_count', $employee->company->employeeCount());
        };

        static::created($recordCount);
        static::deleted($recordCount);
    }

    protected $fillable = [
        'company_id',
        'user_id',
        'employee_code',
        'first_name',
        'last_name',
        'display_name',
        'name',
        'name_km',
        'email',
        'phone',
        'gender',
        'date_of_birth',
        'nationality',
        'national_id_number',
        'passport_number',
        'address',
        'employment_status',
        'sort_order',
        'employment_type',
        'hire_date',
        'termination_date',
        'notes',
        'rest_days',
        'nssf_number',
        'tax_id',
        'bank_name',
        'bank_account_number',
        'base_salary',
        'salary_currency',
    ];

    /** Every employment status, in the order screens list them. */
    public const STATUSES = ['active', 'probation', 'on_leave', 'suspended', 'resigned', 'terminated', 'contract_ended', 'retired'];

    /**
     * The statuses of someone who no longer works here: off the roster and
     * team counts, can't check in, and never marked absent after they left.
     */
    public const LEFT_STATUSES = ['resigned', 'terminated', 'contract_ended', 'retired'];

    /** Statuses that can't check in: everyone who has left, plus suspended. */
    public const NO_CHECK_IN_STATUSES = [...self::LEFT_STATUSES, 'suspended'];

    public function hasLeft(): bool
    {
        return in_array($this->employment_status, self::LEFT_STATUSES, true);
    }

    /** Stands in for "no display order" so those people sort after everyone numbered. */
    private const UNORDERED = 2147483647;

    /**
     * The company's display order: lowest sort_order first (e.g. the director
     * 1, managers 2), people without one after them, then by name.
     */
    public function scopeInDisplayOrder(Builder $query): Builder
    {
        return $query->orderByRaw('coalesce(sort_order, '.self::UNORDERED.')')->orderBy('display_name')->orderBy('id');
    }

    /**
     * The same order for rows of another table that belong to an employee
     * (attendance days, roster entries…): call it after any date ordering, so
     * people line up the same way within each day.
     */
    public static function orderRowsByEmployee(Builder $query, string $employeeIdColumn): Builder
    {
        $employee = fn (string $select) => static::query()->withoutGlobalScopes()
            ->selectRaw($select)
            ->whereColumn('employees.id', $employeeIdColumn)
            ->limit(1);

        return $query
            ->orderBy($employee('coalesce(sort_order, '.self::UNORDERED.')'))
            ->orderBy($employee('display_name'));
    }

    /**
     * Personal details are hidden by default so they can't leak through the
     * many places an employee is nested (attendance, calendar, ...). Only
     * EmployeeController reveals them, and only to employees.manage.
     */
    public const PERSONAL_FIELDS = [
        'gender', 'date_of_birth', 'address', 'notes',
        'nationality', 'national_id_number', 'passport_number',
        'nssf_number', 'tax_id', 'bank_name', 'bank_account_number',
    ];

    /** Pay: revealed only with salary.view, on top of the personal fields. */
    public const SALARY_FIELDS = ['base_salary', 'salary_currency'];

    /**
     * Identity details only the employee pages show. Not secret, but kept out
     * of nested rows (roster, attendance) for the size reason below.
     */
    public const PROFILE_FIELDS = ['first_name', 'last_name', 'name_km'];

    // Kept out of every API response: internal columns nothing on screen reads.
    // An employee is nested inside roster and attendance rows, so each unused
    // field is repeated hundreds of times. (photo_path is a storage path;
    // clients get photo_url instead. currentAssignment is only loaded so that
    // job_title doesn't run a query per row — its raw row isn't needed too.)
    protected $hidden = [
        ...self::PERSONAL_FIELDS,
        ...self::SALARY_FIELDS,
        'name_km',
        'photo_path',
        'company_id', 'user_id', 'first_name', 'last_name', 'display_name', 'rest_days',
        'created_at', 'updated_at',
        'currentAssignment',
    ];

    protected $appends = [
        'name',
        'job_title',
        'manager_employee_id',
        'has_login',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'sort_order' => 'integer',
            'termination_date' => 'date',
            'date_of_birth' => 'date',
            'rest_days' => 'array',
            'base_salary' => 'decimal:2',
        ];
    }

    /**
     * This employee's weekly rest days (0 = Sunday .. 6 = Saturday): their
     * own override if set, otherwise the company's default.
     */
    public function effectiveRestDays(): array
    {
        return $this->rest_days ?? $this->company->default_rest_days ?? [];
    }

    /**
     * Kept as a read-only computed field so existing frontend/API consumers
     * that read employee.name keep working, even though the database now
     * splits identity into first_name/last_name/display_name.
     */
    public function getNameAttribute(): string
    {
        return $this->display_name ?: trim("{$this->first_name} {$this->last_name}");
    }

    /**
     * Lets callers keep writing employee.name (mass-assigned or directly)
     * without knowing display_name is the real backing column.
     */
    public function setNameAttribute(string $value): void
    {
        $this->attributes['display_name'] = $value;
    }

    /**
     * A signed, relative link to this employee's photo (or null). Not part of
     * $appends: it is a long string and needs signing, so only the responses
     * that actually show avatars ask for it with ->append('photo_url').
     *
     * A signed, relative link to this employee's photo (or null). It is only
     * ever produced for people who are already allowed to see the employee,
     * and it expires. The expiry is rounded to the hour so the URL stays the
     * same for a while and browsers can cache the image.
     */
    public function getPhotoUrlAttribute(): ?string
    {
        if (! $this->photo_path) {
            return null;
        }

        return URL::temporarySignedRoute(
            'employees.photo',
            now()->startOfHour()->addHours(12),
            ['employee' => $this->getKey(), 'v' => basename($this->photo_path, '.jpg')],
            absolute: false,
        );
    }

    public function getHasLoginAttribute(): bool
    {
        return $this->user_id !== null;
    }

    public function getJobTitleAttribute(): ?string
    {
        return $this->currentAssignment?->job_title;
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(EmployeeAssignment::class);
    }

    /**
     * The open-ended assignment row: exactly one per employee at any time.
     * A reassignment closes this one (effective_to = now) and opens a new
     * one, so branch/department/team history is preserved instead of
     * overwritten. See EmployeeAssignmentService.
     */
    public function currentAssignment(): HasOne
    {
        return $this->hasOne(EmployeeAssignment::class)->whereNull('effective_to');
    }

    public function branch(): HasOneThrough
    {
        return $this->hasOneThrough(Branch::class, EmployeeAssignment::class, 'employee_id', 'id', 'id', 'branch_id')
            ->whereNull('employee_assignments.effective_to');
    }

    public function department(): HasOneThrough
    {
        return $this->hasOneThrough(Department::class, EmployeeAssignment::class, 'employee_id', 'id', 'id', 'department_id')
            ->whereNull('employee_assignments.effective_to');
    }

    public function team(): HasOneThrough
    {
        return $this->hasOneThrough(Team::class, EmployeeAssignment::class, 'employee_id', 'id', 'id', 'team_id')
            ->whereNull('employee_assignments.effective_to');
    }

    /**
     * The line manager: first to approve this person's requests. Shown even
     * when they work in a branch the viewer can't otherwise see.
     */
    public function manager(): HasOneThrough
    {
        return $this->hasOneThrough(self::class, EmployeeAssignment::class, 'employee_id', 'id', 'id', 'manager_employee_id')
            ->whereNull('employee_assignments.effective_to')
            ->withoutGlobalScope('branch_access');
    }

    public function getManagerEmployeeIdAttribute(): ?int
    {
        return $this->currentAssignment?->manager_employee_id;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
