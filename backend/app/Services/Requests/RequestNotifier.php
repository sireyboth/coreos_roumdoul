<?php

namespace App\Services\Requests;

use App\Models\Employee;
use App\Models\EmployeeRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\Telegram\TelegramCard;
use App\Services\Telegram\TelegramGroupPoster;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Alerts about requests — in the app and as a push to phones. Sent only
 * after the surrounding transaction commits; each has a dedupe key, so a
 * retry never alerts twice.
 *
 *  - sent       → whoever decides it (see ApprovalChain::approversToNotify)
 *  - decided    → the employee (and whoever asked for them); the other
 *                 approvers' alerts are closed so nobody acts on it twice
 *  - cancelled  → the approvers while it was waiting, or whoever approved it
 *  - type_changed / pay_changed → the employee, and whoever approved it
 *
 * Sent and decided are also posted once to the company's Telegram group, if
 * it has one — name, dates and outcome only: no reason, remark or pay.
 */
final class RequestNotifier
{
    public const LINK = '/dashboard/requests';

    public function __construct(private readonly ApprovalChain $chain, private readonly TelegramGroupPoster $telegram) {}

    public function sent(EmployeeRequest $request): void
    {
        DB::afterCommit(function () use ($request) {
            $name = $request->employee->name;

            foreach ($this->chain->approversToNotify($request) as $approver) {
                $this->send($approver, $request, 'requested', $this->emoji($request)." {$this->kind($request)} request from {$name}", $this->summary($request).$this->reason($request));
            }

            $this->postToGroups(
                $request, 'requests', "request_sent:{$request->id}",
                $this->emoji($request).' '.mb_strtoupper($this->kind($request)).' REQUEST', '⏳ Waiting for approval',
            );
        });
    }

    public function decided(EmployeeRequest $request, User $by): void
    {
        DB::afterCommit(function () use ($request, $by) {
            NotificationService::resolve($request, $this->type($request, 'requested'), $request->status, $by);

            $title = $request->status === 'approved' ? '✅ '.$this->kind($request).' approved' : '❌ '.$this->kind($request).' rejected';
            $body = "{$this->summary($request)} — {$request->status} by ".trim($by->name).'.'
                .(($pay = $request->payNote()) ? " {$pay}." : '')
                .($request->decision_notes ? " Remark: {$request->decision_notes}" : '');

            foreach ($this->people($request, except: $by) as $user) {
                $this->send($user, $request, 'decided', $title, $body, $by);
            }

            $approved = $request->status === 'approved';
            $this->postToGroups(
                $request, 'request_decisions', "request_decided:{$request->id}:{$request->status}",
                ($approved ? '✅ ' : '❌ ').mb_strtoupper($this->kind($request)).($approved ? ' APPROVED' : ' REJECTED'),
                '✍️ '.($approved ? 'Approved' : 'Rejected').' by '.trim($by->name),
            );
        });
    }

    /** @param  string  $wasStatus  pending or approved, before it was cancelled */
    public function cancelled(EmployeeRequest $request, User $by, string $wasStatus): void
    {
        DB::afterCommit(function () use ($request, $by, $wasStatus) {
            NotificationService::resolve($request, $this->type($request, 'requested'), 'cancelled', $by);

            $byEmployee = $this->chain->isAbout($by, $request) || $request->requested_by === $by->id;
            $recipients = $byEmployee
                // They withdrew it: tell whoever was deciding, or had approved it.
                ? ($wasStatus === 'pending' ? $this->chain->approversToNotify($request) : User::query()->whereKey($request->decided_by)->get())
                // Someone cancelled it for them: tell them.
                : $this->people($request, except: $by);

            $body = $this->summary($request).' — cancelled by '.trim($by->name).'.'
                .($request->cancel_reason ? " Remark: {$request->cancel_reason}" : '');

            foreach ($recipients->reject(fn (User $u) => $u->id === $by->id) as $user) {
                $this->send($user, $request, 'cancelled', '🚫 '.$this->kind($request).' cancelled', $body, $by);
            }
        });
    }

    /**
     * HR corrected the leave type: the employee (and whoever sent it for
     * them) is told, and so is whoever approved it, if that was someone else.
     */
    public function typeChanged(EmployeeRequest $request, User $by, string $fromName): void
    {
        DB::afterCommit(function () use ($request, $by, $fromName) {
            $body = "{$fromName} → {$this->summary($request)} — changed by ".trim($by->name).'.'
                .(($notes = $request->details['changed_from']['notes'] ?? null) ? " Remark: {$notes}" : '');

            $recipients = $this->people($request, except: $by)
                ->merge(User::query()->whereKey($request->decided_by)->whereKeyNot($by->id)->where('is_active', true)->get())
                ->unique('id');

            foreach ($recipients as $user) {
                // One alert per change: a second correction is news too.
                $this->send($user, $request, 'type_changed', '✏️ Leave type changed', $body, $by, dedupe: (string) ($request->details['changed_from']['at'] ?? $request->leave_type_id));
            }
        });
    }

    /** Approved leave's paid days were corrected: told like a type change. */
    public function payChanged(EmployeeRequest $request, User $by): void
    {
        DB::afterCommit(function () use ($request, $by) {
            $change = $request->details['pay_changed'] ?? [];
            $body = $this->summary($request).' — '.($request->payNote() ?? 'paid as '.($request->leaveType?->name ?? 'the leave type').' says')
                .', changed by '.trim($by->name).'.'
                .(($notes = $change['notes'] ?? null) ? " Remark: {$notes}" : '');

            $recipients = $this->people($request, except: $by)
                ->merge(User::query()->whereKey($request->decided_by)->whereKeyNot($by->id)->where('is_active', true)->get())
                ->unique('id');

            foreach ($recipients as $user) {
                $this->send($user, $request, 'pay_changed', '✏️ Paid leave days changed', $body, $by, dedupe: (string) ($change['at'] ?? ''));
            }
        });
    }

    /** "Leave", "Late arrival", "Early leave" — for titles. */
    private function kind(EmployeeRequest $request): string
    {
        return $request->type === 'leave' ? 'Leave' : $request->label();
    }

    private function emoji(EmployeeRequest $request): string
    {
        return $request->type === 'late_early' ? '⏰' : '🌴';
    }

    /**
     * "Annual leave · Mon 12 – Wed 14 Oct · 3 days", or
     * "Late arrival · Thu 1 Oct · in at 09:00 (60 min)".
     */
    public function summary(EmployeeRequest $request): string
    {
        return implode(' · ', $this->what($request));
    }

    /**
     * The request as [what, when]: ["Annual leave", "Mon 12 – Wed 14 Oct · 3 days"]
     * or ["Late arrival", "Thu 1 Oct · in at 09:00 (60 min)"]. One line in
     * the app (summary), two in a Telegram card.
     *
     * @return array{0: string, 1: string}
     */
    private function what(EmployeeRequest $request): array
    {
        if ($request->type === 'late_early') {
            $details = $request->details ?? [];
            $when = ($details['kind'] ?? 'late') === 'late' ? 'in at' : 'out at';

            return [$request->label(), Carbon::parse($request->start_date)->format('D j M')
                ." · {$when} ".($details['time'] ?? '?').' ('.($details['minutes'] ?? 0).' min)'];
        }

        $start = Carbon::parse($request->start_date);
        $end = Carbon::parse($request->end_date);
        $dates = $start->isSameDay($end)
            ? $start->format('D j M').match ($request->day_part) {
                'am' => ' (morning)', 'pm' => ' (afternoon)', default => ''
            }
        : $start->format('D j M').' – '.$end->format('D j M');
        $days = $request->days == 1 ? '1 day' : rtrim(rtrim(number_format($request->days, 1), '0'), '.').' days';

        return [$request->leaveType?->name ?? 'Leave', "{$dates} · {$days}"];
    }

    /** The group post: who (TelegramCard), what and when, then $footer. No reason, remark or pay. */
    private function postToGroups(EmployeeRequest $request, string $event, string $key, string $heading, string $footer): void
    {
        [$what, $when] = $this->what($request);
        $employee = $request->employee instanceof Employee ? $request->employee : null;
        $details = ["📅 {$what}", "      {$when}", $footer];

        $this->telegram->post(
            $request->company_id, $event, $key, $employee,
            fn (string $detail) => $employee
                ? TelegramCard::make($heading, $employee, $details, $detail)
                : implode("\n", [$heading, ...$details]),
        );
    }

    private function reason(EmployeeRequest $request): string
    {
        return $request->reason ? " — {$request->reason}" : '';
    }

    /** The employee and whoever sent the request for them, if they can still be told. */
    private function people(EmployeeRequest $request, User $except)
    {
        return User::query()
            ->whereIn('id', array_filter([$request->employee->user_id, $request->requested_by]))
            ->where('id', '!=', $except->id)
            ->where('is_active', true)
            ->get();
    }

    private function type(EmployeeRequest $request, string $event): string
    {
        return "request.{$request->type}_{$event}";
    }

    private function send(User $recipient, EmployeeRequest $request, string $event, string $title, string $body, ?User $actor = null, ?string $dedupe = null): void
    {
        $type = $this->type($request, $event);

        NotificationService::send(
            $recipient, $type, $title, $body,
            data: ['request_id' => $request->id, 'employee_id' => $request->employee_id, 'employee_name' => $request->employee->name],
            subject: $request,
            actor: $actor ?? $request->requestedBy,
            link: self::LINK.'?id='.$request->id,
            dedupeKey: "{$type}:{$request->id}:{$recipient->id}".($dedupe !== null ? ":{$dedupe}" : ''),
        );
    }
}
