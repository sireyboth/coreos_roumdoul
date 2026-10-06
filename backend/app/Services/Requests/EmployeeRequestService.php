<?php

namespace App\Services\Requests;

use App\Models\Attachment;
use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Models\EmployeeRequestDay;
use App\Models\LeaveType;
use App\Models\Notification;
use App\Models\RequestTypeSetting;
use App\Models\User;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Attendance\ScheduleResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Leave requests from start to finish: check, send, decide, cancel — and
 * keep attendance in step (an approved day off is never "absent").
 *
 * Every rule is checked on the server when the request is sent, and the
 * ones that can change meanwhile (balance, locked months) again when it is
 * approved. Two managers deciding at the same moment: exactly one wins.
 */
final class EmployeeRequestService
{
    public const DISK = 'local';

    /** Longest single request: a year (maternity is 90 days, anything longer is a mistake). */
    private const MAX_SPAN_DAYS = 366;

    public function __construct(
        private readonly LeaveDayCounter $counter,
        private readonly LeaveBalance $balance,
        private readonly ApprovalChain $chain,
        private readonly RequestNotifier $notifier,
        private readonly AttendanceRecorder $recorder,
    ) {}

    /**
     * Everything the form needs before sending: the days it would take, the
     * balance before and after, and anything that would stop it — without
     * saving a thing.
     *
     * @param  array{start_date: string, end_date: string, day_part?: string}  $data
     */
    public function preview(User $by, Employee $employee, LeaveType $type, array $data): array
    {
        [$days, $problems] = $this->check($by, $employee, $type, $data, hasFile: true);

        return [
            'days' => $days,
            'total' => $this->total($days),
            'balances' => $this->balancesFor($employee, $type, $days),
            'attachment_required' => $this->needsAttachment($type, $this->total($days)),
            'problems' => $problems,
        ];
    }

    /** @param  array{start_date: string, end_date: string, day_part?: string, reason?: ?string}  $data */
    public function submit(User $by, Employee $employee, LeaveType $type, array $data, ?UploadedFile $file = null, bool $approveNow = false): EmployeeRequest
    {
        return $this->send($by, $employee, $file, $approveNow, function () use ($by, $employee, $type, $data, $file) {
            [$days, $problems] = $this->check($by, $employee, $type, $data, hasFile: $file !== null);

            return [[
                'type' => 'leave',
                'leave_type_id' => $type->id,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'day_part' => $data['day_part'] ?? 'full',
                'days' => $this->total($days),
                'reason' => $data['reason'] ?? null,
            ], $days, $problems];
        });
    }

    /**
     * Permission to arrive late or leave early on one work day. The time
     * must fall inside the day; at most RequestTypeSetting::monthly_limit
     * a month; never on a day already on leave.
     *
     * @param  array{start_date: string, kind: string, time: string, reason?: ?string}  $data
     */
    public function submitLateEarly(User $by, Employee $employee, array $data, ?UploadedFile $file = null, bool $approveNow = false): EmployeeRequest
    {
        return $this->send($by, $employee, $file, $approveNow, function () use ($employee, $data) {
            $check = $this->checkLateEarly($employee, $data);

            return [[
                'type' => 'late_early',
                'start_date' => $data['start_date'],
                'end_date' => $data['start_date'],
                'days' => 0,
                'details' => ['kind' => $data['kind'], 'time' => $data['time'], 'minutes' => $check['minutes']],
                'reason' => $data['reason'] ?? null,
            ], [['date' => $data['start_date'], 'portion' => 0, 'part' => $data['kind']]], $check['problems']];
        });
    }

    /** What a late / early request would come to: the usual time, the minutes, this month's count, any problem. */
    public function previewLateEarly(Employee $employee, array $data): array
    {
        $check = $this->checkLateEarly($employee, $data);

        return [
            'expected' => $check['expected'],
            'minutes' => $check['minutes'],
            'used_this_month' => $check['used'],
            'monthly_limit' => $check['limit'],
            'problems' => $check['problems'],
        ];
    }

    /**
     * Saves a request of any type: one at a time per person, its file kept
     * only if everything else is saved, its approval chain started.
     *
     * @param  \Closure(): array{0: array<string, mixed>, 1: array<int, array<string, mixed>>, 2: array<string, string>}  $build
     *                                                                                                                         the request's fields, its days and any problems — run inside the lock
     */
    private function send(User $by, Employee $employee, ?UploadedFile $file, bool $approveNow, \Closure $build): EmployeeRequest
    {
        // Saved first, outside the transaction: if anything below fails, the file is removed again.
        $stored = $file ? $file->storeAs("request-attachments/{$employee->company_id}", Str::random(32).'.'.$file->guessExtension(), self::DISK) : null;

        try {
            $request = DB::transaction(function () use ($by, $employee, $file, $stored, $approveNow, $build) {
                // One request at a time per person, so two sent at once can't both take the same days or balance.
                Employee::query()->withoutGlobalScopes()->whereKey($employee->id)->lockForUpdate()->first();

                [$attributes, $days, $problems] = $build();
                if ($problems !== []) {
                    throw ValidationException::withMessages(array_map(fn (string $message) => [$message], $problems));
                }

                $request = EmployeeRequest::query()->create([
                    ...$attributes,
                    'company_id' => $employee->company_id,
                    'employee_id' => $employee->id,
                    'requested_by' => $by->id,
                    'status' => 'pending',
                ]);

                foreach ($days as $day) {
                    EmployeeRequestDay::query()->create(['employee_request_id' => $request->id, 'employee_id' => $employee->id, ...$day]);
                }

                if ($stored) {
                    Attachment::query()->create([
                        'company_id' => $employee->company_id,
                        'attachable_type' => $request->getMorphClass(),
                        'attachable_id' => $request->id,
                        'disk' => self::DISK,
                        'path' => $stored,
                        'original_name' => Str::limit($file->getClientOriginalName(), 200, ''),
                        'mime' => $file->getMimeType() ?? 'application/octet-stream',
                        'size' => $file->getSize(),
                        'uploaded_by' => $by->id,
                    ]);
                }

                $this->chain->start($request);
                $request->load(['employee.currentAssignment', 'leaveType', 'approval.steps.approverUser', 'requestedBy']);

                // Someone recording it for a member of staff (e.g. a sick call) approves it as they go.
                if ($approveNow && $this->chain->canDecide($by, $request)) {
                    $this->decide($by, $request, 'approved', null);
                } else {
                    $this->notifier->sent($request);
                }

                return $request;
            });
        } catch (\Throwable $e) {
            if ($stored) {
                Storage::disk(self::DISK)->delete($stored);
            }
            throw $e;
        }

        return $request->fresh();
    }

    public function approve(User $by, EmployeeRequest $request, ?string $notes = null): EmployeeRequest
    {
        return DB::transaction(fn () => $this->decide($by, $request, 'approved', $notes));
    }

    public function reject(User $by, EmployeeRequest $request, string $notes): EmployeeRequest
    {
        return DB::transaction(fn () => $this->decide($by, $request, 'rejected', $notes));
    }

    /**
     * Withdraws a request. The employee can withdraw one still waiting, or an
     * approved one that hasn't started yet; an approver for their branch can
     * cancel either at any time (not in a locked payroll month). The days and
     * balance come back, and attendance is recalculated.
     */
    public function cancel(User $by, EmployeeRequest $request, ?string $reason = null): EmployeeRequest
    {
        $request->loadMissing(['employee.currentAssignment', 'leaveType', 'approval.steps.approverUser']);
        $wasStatus = $request->status;
        $isOwn = $this->chain->isAbout($by, $request) || $request->requested_by === $by->id;
        $covers = $this->chain->covers($by, $request->employee);
        $today = $this->today($request->employee);

        if (! in_array($wasStatus, EmployeeRequest::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ['This request is already '.$wasStatus.'.']]);
        }

        $allowed = $covers || ($isOwn && ($wasStatus === 'pending' || $request->start_date->toDateString() > $today));
        if (! $allowed) {
            throw ValidationException::withMessages(['status' => [$isOwn
                ? 'This leave has already started — ask your manager or HR to cancel it.'
                : 'You can\'t cancel this request.']]);
        }

        if ($wasStatus === 'approved') {
            $this->assertMonthsOpen($request->employee, $request->start_date->toDateString(), $request->end_date->toDateString());
        }

        return DB::transaction(function () use ($by, $request, $reason, $wasStatus) {
            $claimed = EmployeeRequest::query()->withoutGlobalScopes()->whereKey($request->id)->where('status', $wasStatus)->update([
                'status' => 'cancelled', 'cancelled_by' => $by->id, 'cancelled_at' => now(), 'cancel_reason' => $reason,
            ]);
            if (! $claimed) {
                throw ValidationException::withMessages(['status' => ['This request was changed a moment ago — reload to see it.']]);
            }

            $request->refresh();
            $this->chain->finish($request, 'cancelled', $by, $reason);

            if ($wasStatus === 'approved') {
                $this->recalculate($request);
            }
            $this->notifier->cancelled($request->load('approval.steps.approverUser'), $by, $wasStatus);

            return $request;
        });
    }

    /**
     * Removes a request for good — its days, approval trail, files and
     * notifications — for clearing test data. Real requests are cancelled,
     * which keeps the history. Approved leave gives its days back to the
     * balance and its attendance is worked out again.
     */
    public function delete(EmployeeRequest $request): void
    {
        $request->loadMissing(['employee', 'attachments', 'approval']);
        $wasApproved = $request->status === 'approved';

        if ($wasApproved) {
            $this->assertMonthsOpen($request->employee, $request->start_date->toDateString(), $request->end_date->toDateString());
        }

        $files = $request->attachments->map(fn (Attachment $a) => [$a->disk, $a->path])->all();

        DB::transaction(function () use ($request) {
            $request->attachments()->delete();
            $request->approval?->delete();
            Notification::query()->withoutGlobalScopes()
                ->where('subject_type', $request->getMorphClass())->where('subject_id', $request->id)
                ->delete();
            $request->delete();
        });

        // Only once the rows are gone for sure: a rollback must not leave a request pointing at missing files.
        foreach ($files as [$disk, $path]) {
            Storage::disk($disk)->delete($path);
        }

        if ($wasApproved) {
            $this->recalculate($request);
        }
    }

    /**
     * After a holiday is added, moved or removed: waiting and approved leave
     * over those dates is counted again, so a day that became a holiday is
     * given back (and taken again if the holiday is called off). Leave in a
     * locked payroll month stays as it was; calendar-day leave never changes.
     *
     * @param  array<int, string>  $dates
     */
    public function recountForDates(int $companyId, array $dates): void
    {
        if ($dates === []) {
            return;
        }

        $requests = EmployeeRequest::query()->withoutGlobalScopes()
            ->with(['employee' => fn ($q) => $q->withoutGlobalScopes()->with('company'), 'leaveType' => fn ($q) => $q->withoutGlobalScopes()])
            ->where('company_id', $companyId)
            ->where('type', 'leave')
            ->whereIn('status', EmployeeRequest::ACTIVE_STATUSES)
            ->where(function ($q) use ($dates) {
                foreach ($dates as $date) {
                    $q->orWhere(fn ($r) => $r->whereDate('start_date', '<=', $date)->whereDate('end_date', '>=', $date));
                }
            })
            ->get();

        foreach ($requests as $request) {
            $start = $request->start_date->toDateString();
            $end = $request->end_date->toDateString();

            if (! $request->leaveType || $request->leaveType->countsCalendarDays() || $this->lockedMonth($request->employee, $start, $end)) {
                continue;
            }

            DB::transaction(function () use ($request, $start, $end) {
                // Dates another request took meanwhile stay with that one.
                $heldElsewhere = EmployeeRequestDay::query()
                    ->where('employee_id', $request->employee_id)
                    ->where('employee_request_id', '!=', $request->id)
                    ->whereBetween('date', [$start, $end])
                    ->whereHas('request', fn ($q) => $q->withoutGlobalScopes()->whereIn('status', EmployeeRequest::ACTIVE_STATUSES))
                    ->pluck('date')->map(fn ($d) => $d->toDateString())->all();

                $days = array_values(array_filter(
                    $this->counter->count($request->employee, $request->leaveType, $start, $end, $request->day_part),
                    fn (array $day) => ! in_array($day['date'], $heldElsewhere, true),
                ));

                $request->dates()->delete();
                foreach ($days as $day) {
                    EmployeeRequestDay::query()->create(['employee_request_id' => $request->id, 'employee_id' => $request->employee_id, ...$day]);
                }
                EmployeeRequest::query()->withoutGlobalScopes()->whereKey($request->id)->update(['days' => $this->total($days)]);
            });
        }
    }

    /** Must run inside a transaction. */
    private function decide(User $by, EmployeeRequest $request, string $decision, ?string $notes): EmployeeRequest
    {
        $request->loadMissing(['employee.currentAssignment', 'leaveType', 'approval.steps.approverUser']);

        if (! $request->isPending()) {
            throw ValidationException::withMessages(['status' => ['This request has already been '.$request->status.'.']]);
        }
        if (! $this->chain->canDecide($by, $request)) {
            abort(403, $this->chain->isAbout($by, $request) ? 'You can\'t decide your own request.' : 'You can\'t decide this request.');
        }

        if ($decision === 'approved') {
            $start = $request->start_date->toDateString();
            $end = $request->end_date->toDateString();
            $this->assertMonthsOpen($request->employee, $start, $end);

            // The balance may have changed since it was sent (an adjustment, another approval).
            $days = $request->dates()->get()->map(fn (EmployeeRequestDay $d) => ['date' => $d->date->toDateString(), 'portion' => $d->portion, 'part' => $d->part])->all();
            if ($short = $this->shortfall($request->employee, $request->leaveType, $days, $request->id)) {
                throw ValidationException::withMessages(['balance' => [$short]]);
            }
        }

        // Only if still pending: of two managers deciding at once, one wins.
        $claimed = EmployeeRequest::query()->withoutGlobalScopes()->whereKey($request->id)->where('status', 'pending')->update([
            'status' => $decision, 'decided_by' => $by->id, 'decided_at' => now(), 'decision_notes' => $notes,
        ]);
        if (! $claimed) {
            throw ValidationException::withMessages(['status' => ['This request was decided a moment ago — reload to see it.']]);
        }

        $request->refresh();
        $this->chain->finish($request, $decision, $by, $notes);

        if ($decision === 'approved') {
            $this->recalculate($request);
        }
        $this->notifier->decided($request, $by);

        return $request;
    }

    /**
     * The days the request would take and every reason it can't be sent,
     * keyed by the form field each belongs to.
     *
     * @return array{0: array<int, array{date: string, portion: float, part: string}>, 1: array<string, string>}
     */
    private function check(User $by, Employee $employee, LeaveType $type, array $data, bool $hasFile): array
    {
        $start = $data['start_date'];
        $end = $data['end_date'];
        $part = $data['day_part'] ?? 'full';
        $problems = [];

        if (! $type->is_active) {
            return [[], ['leave_type_id' => "{$type->name} is turned off."]];
        }
        if ($employee->hasLeft() && ($employee->termination_date === null || $end > $employee->termination_date->toDateString())) {
            return [[], ['employee_id' => "{$employee->name} has left the company."]];
        }
        if (CarbonImmutable::parse($start)->diffInDays(CarbonImmutable::parse($end)) >= self::MAX_SPAN_DAYS) {
            return [[], ['end_date' => 'One request can cover at most a year.']];
        }
        if ($part !== 'full') {
            if ($start !== $end) {
                return [[], ['day_part' => 'A half day is a single date — pick the same start and end date.']];
            }
            if (! $type->allow_half_day) {
                return [[], ['day_part' => "{$type->name} is taken in whole days."]];
            }
        }

        if ($type->gender && $employee->gender !== $type->gender) {
            $problems['leave_type_id'] = $employee->gender
                ? "{$type->name} is only for ".($type->gender === 'female' ? 'women' : 'men').'.'
                : "Add {$employee->name}'s gender to their profile first — {$type->name} is only for ".($type->gender === 'female' ? 'women' : 'men').'.';
        }

        if ($type->eligible_after_months && $employee->hire_date) {
            $from = CarbonImmutable::parse($employee->hire_date)->addMonthsNoOverflow($type->eligible_after_months)->toDateString();
            if ($start < $from) {
                $problems['start_date'] = "{$type->name} can be taken from ".CarbonImmutable::parse($from)->format('j M Y')
                    ." ({$type->eligible_after_months} months after starting work).";
            }
        }

        // Notice applies to staff asking for themselves; HR recording leave after the fact is fine.
        if ($type->min_notice_days && $employee->user_id === $by->id) {
            $earliest = CarbonImmutable::parse($this->today($employee))->addDays($type->min_notice_days)->toDateString();
            if ($start < $earliest) {
                $problems['start_date'] = "Ask for {$type->name} at least {$type->min_notice_days} days ahead.";
            }
        }

        $days = $this->counter->count($employee, $type, $start, $end, $part);
        $total = $this->total($days);

        if ($days === []) {
            return [[], [...$problems, 'start_date' => 'No working days in these dates — they are all holidays or days off.']];
        }
        if ($type->max_days_per_request && $total > $type->max_days_per_request) {
            $problems['end_date'] = "{$type->name} is at most ".$this->number($type->max_days_per_request).' days per request.';
        }
        if ($clash = $this->clash($employee, $days)) {
            $problems['start_date'] ??= $clash;
        }
        if ($type->requires_balance && ($short = $this->shortfall($employee, $type, $days))) {
            $problems['balance'] = $short;
        }
        if ($locked = $this->lockedMonth($employee, $start, $end)) {
            $problems['start_date'] ??= $locked;
        }
        if (! $hasFile && $this->needsAttachment($type, $total)) {
            $problems['attachment'] = "Attach a document for {$type->name} (e.g. a medical certificate).";
        }

        return [$days, $problems];
    }

    /**
     * @param  array{start_date: string, kind: string, time: string}  $data
     * @return array{expected: ?string, minutes: int, used: int, limit: ?int, problems: array<string, string>}
     */
    private function checkLateEarly(Employee $employee, array $data, ?int $exceptRequestId = null): array
    {
        $date = $data['start_date'];
        $kind = $data['kind'];
        $setting = RequestTypeSetting::forCompany($employee->company_id, 'late_early');
        $result = ['expected' => null, 'minutes' => 0, 'used' => 0, 'limit' => $setting->monthly_limit, 'problems' => []];
        $label = fn (string $d) => CarbonImmutable::parse($d)->format('D j M');

        if (! $setting->is_active) {
            return [...$result, 'problems' => ['type' => 'Late arrival / early leave requests are turned off.']];
        }
        if ($employee->hasLeft() && ($employee->termination_date === null || $date > $employee->termination_date->toDateString())) {
            return [...$result, 'problems' => ['employee_id' => "{$employee->name} has left the company."]];
        }

        // Never on leave, and one late arrival and one early leave a day at most.
        $taken = EmployeeRequestDay::query()
            ->with(['request' => fn ($q) => $q->withoutGlobalScopes()->with(['leaveType' => fn ($t) => $t->withoutGlobalScopes()])])
            ->where('employee_id', $employee->id)
            ->whereDate('date', $date)
            ->whereHas('request', fn ($q) => $q->withoutGlobalScopes()->whereIn('status', EmployeeRequest::ACTIVE_STATUSES)
                ->when($exceptRequestId, fn ($r) => $r->whereKeyNot($exceptRequestId)))
            ->get();
        if ($onLeave = $taken->first(fn (EmployeeRequestDay $d) => $d->request->type === 'leave')) {
            return [...$result, 'problems' => ['start_date' => 'Already '.$onLeave->request->label().' on '.$label($date).' ('.$onLeave->request->status.').']];
        }
        if ($taken->contains(fn (EmployeeRequestDay $d) => $d->part === $kind)) {
            return [...$result, 'problems' => ['start_date' => 'Already asked for '.($kind === 'late' ? 'a late arrival' : 'an early leave').' on '.$label($date).'.']];
        }

        $expected = (new ScheduleResolver($employee->company, [$employee->id], $date, $date, withLeave: false))->resolve($employee->id, $date);
        if (! $expected->isWork()) {
            return [...$result, 'problems' => ['start_date' => "There's no work scheduled on {$label($date)}."]];
        }

        $start = $expected->firstSlotAt();
        $end = $expected->lastSlotAt();
        $at = CarbonImmutable::parse("{$date} {$data['time']}", $expected->timezone);
        // A night shift: a time before the start is on the next morning.
        if ($expected->crossesMidnight() && $at->lt($start)) {
            $at = $at->addDay();
        }
        $result['expected'] = ($kind === 'late' ? $start : $end)->format('H:i');

        if ($at->lte($start)) {
            $result['problems']['time'] = "Pick a time after your start at {$start->format('H:i')}.";
        } elseif ($at->gte($end)) {
            $result['problems']['time'] = "Pick a time before your day ends at {$end->format('H:i')}.";
        } else {
            $result['minutes'] = (int) ($kind === 'late' ? $start->diffInMinutes($at) : $at->diffInMinutes($end));
        }

        $month = CarbonImmutable::parse($date);
        $result['used'] = EmployeeRequest::query()->withoutGlobalScopes()
            ->where('employee_id', $employee->id)->where('type', 'late_early')
            ->whereIn('status', EmployeeRequest::ACTIVE_STATUSES)
            ->whereDate('start_date', '>=', $month->startOfMonth()->toDateString())
            ->whereDate('start_date', '<=', $month->endOfMonth()->toDateString())
            ->when($exceptRequestId, fn ($q) => $q->whereKeyNot($exceptRequestId))
            ->count();
        if ($setting->monthly_limit !== null && $result['used'] >= $setting->monthly_limit) {
            $result['problems']['start_date'] = "You can ask for at most {$setting->monthly_limit} late arrivals / early leaves in {$month->format('F Y')}.";
        }

        if ($locked = $this->lockedMonth($employee, $date, $date)) {
            $result['problems']['start_date'] ??= $locked;
        }

        return $result;
    }

    /** Another request already holding one of these dates (a morning and an afternoon can share one). */
    private function clash(Employee $employee, array $days): ?string
    {
        $dates = array_column($days, 'date');
        $taken = EmployeeRequestDay::query()
            ->with(['request' => fn ($q) => $q->withoutGlobalScopes()->with(['leaveType' => fn ($t) => $t->withoutGlobalScopes()])])
            ->where('employee_id', $employee->id)
            ->whereIn('date', $dates)
            ->whereHas('request', fn ($q) => $q->withoutGlobalScopes()->whereIn('status', EmployeeRequest::ACTIVE_STATUSES))
            ->get();

        foreach ($days as $day) {
            foreach ($taken->filter(fn (EmployeeRequestDay $t) => $t->date->toDateString() === $day['date']) as $other) {
                // Leave never shares a date with a late / early permission (one or the other).
                if ($other->request->type === 'late_early' || $other->part === 'full' || $day['part'] === 'full' || $other->part === $day['part']) {
                    return 'Already '.($other->request->type === 'leave' ? $other->request->label() : 'asked for '.strtolower($other->request->label())).' on '
                        .CarbonImmutable::parse($day['date'])->format('D j M').' ('.$other->request->status.').';
                }
            }
        }

        return null;
    }

    /** Not enough balance for these days in one of their years? Says how short. */
    private function shortfall(Employee $employee, ?LeaveType $type, array $days, ?int $exceptRequestId = null): ?string
    {
        if (! $type?->requires_balance) {
            return null;
        }

        foreach (collect($days)->groupBy(fn (array $d) => (int) substr($d['date'], 0, 4)) as $year => $inYear) {
            $asked = round($inYear->sum('portion'), 2);
            $left = $this->balance->for($employee, $type, $year, $inYear->max('date'), $exceptRequestId)['available'];

            if ($asked > $left) {
                return "Not enough {$type->name}: ".$this->number($asked).' '.($asked == 1 ? 'day' : 'days').' asked, '
                    .$this->number(max(0, $left))." left for {$year}.";
            }
        }

        return null;
    }

    /** @return array<int, array<string, mixed>> the balance each year of the request, before and after it */
    private function balancesFor(Employee $employee, LeaveType $type, array $days): array
    {
        if (! $type->requires_balance) {
            return [];
        }

        return collect($days)->groupBy(fn (array $d) => (int) substr($d['date'], 0, 4))
            ->map(function ($inYear, int $year) use ($employee, $type) {
                $balance = $this->balance->for($employee, $type, $year, $inYear->max('date'));

                // Same shape as GET /leave-balances, so the app reads both the same way.
                return [
                    'leave_type' => ['id' => $type->id, 'code' => $type->code, 'name' => $type->name, 'name_km' => $type->name_km],
                    ...$balance,
                    'after' => round($balance['available'] - $inYear->sum('portion'), 2),
                ];
            })->values()->all();
    }

    private function needsAttachment(LeaveType $type, float $total): bool
    {
        return $type->attachment_from_days !== null && $total >= $type->attachment_from_days;
    }

    public function lockedMonth(Employee $employee, string $start, string $end): ?string
    {
        for ($month = CarbonImmutable::parse($start)->startOfMonth(); $month->toDateString() <= $end; $month = $month->addMonth()) {
            if ($this->recorder->isLocked($employee->company_id, $month->toDateString())) {
                return 'Payroll for '.$month->format('F Y').' is locked — ask an admin to reopen it first.';
            }
        }

        return null;
    }

    private function assertMonthsOpen(Employee $employee, string $start, string $end): void
    {
        if ($locked = $this->lockedMonth($employee, $start, $end)) {
            throw ValidationException::withMessages(['start_date' => [$locked]]);
        }
    }

    private function recalculate(EmployeeRequest $request): void
    {
        $this->recorder->recalculateRange($request->employee, $request->start_date->toDateString(), $request->end_date->toDateString());
    }

    private function total(array $days): float
    {
        return round(array_sum(array_column($days, 'portion')), 2);
    }

    private function number(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2), '0'), '.');
    }

    private function today(Employee $employee): string
    {
        return CarbonImmutable::now($employee->company?->timezone ?: config('attendance.default_timezone'))->toDateString();
    }
}
