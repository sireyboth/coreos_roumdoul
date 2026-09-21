<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToCompany;
use App\Models\Concerns\RestrictedToAccessibleBranches;
use App\Services\UsageRecorder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\URL;

class Employee extends Model
{
    use Auditable, BelongsToCompany, HasFactory, RestrictedToAccessibleBranches, SoftDeletes;

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
        'email',
        'phone',
        'gender',
        'date_of_birth',
        'address',
        'employment_status',
        'employment_type',
        'hire_date',
        'termination_date',
        'notes',
        'rest_days',
    ];

    /**
     * Personal details are hidden by default so they can't leak through the
     * many places an employee is nested (attendance, calendar, ...). Only
     * EmployeeController reveals them, and only to employees.manage.
     */
    public const PERSONAL_FIELDS = ['gender', 'date_of_birth', 'address', 'notes'];

    // Kept out of every API response: internal columns nothing on screen reads.
    // An employee is nested inside roster and attendance rows, so each unused
    // field is repeated hundreds of times. (photo_path is a storage path;
    // clients get photo_url instead. currentAssignment is only loaded so that
    // job_title doesn't run a query per row — its raw row isn't needed too.)
    protected $hidden = [
        ...self::PERSONAL_FIELDS,
        'photo_path',
        'company_id', 'user_id', 'first_name', 'last_name', 'display_name', 'rest_days',
        'created_at', 'updated_at', 'deleted_at',
        'currentAssignment',
    ];

    protected $appends = [
        'name',
        'job_title',
        'has_login',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'termination_date' => 'date',
            'date_of_birth' => 'date',
            'rest_days' => 'array',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
