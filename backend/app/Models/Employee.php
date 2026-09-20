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

class Employee extends Model
{
    use Auditable, BelongsToCompany, HasFactory, RestrictedToAccessibleBranches, SoftDeletes;

    protected static function booted(): void
    {
        $recordCount = function (self $employee) {
            UsageRecorder::record($employee->company, 'employees_count', $employee->company->employees()->count());
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
        'employment_status',
        'hire_date',
        'termination_date',
        'rest_days',
    ];

    protected $appends = [
        'name',
        'job_title',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'termination_date' => 'date',
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
