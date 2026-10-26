"use client";

import { useState } from "react";
import { CheckCircle2, Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type AttendancePeriod } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

export type ResolveTarget = "missed" | "absences" | "corrections" | "overtime";

type Checklist = Record<ResolveTarget, number>;

const CHECKS: { target: ResolveTarget; label: (n: number) => string; hint: string; action: string }[] = [
  { target: "missed", label: (n) => `${n} ${n === 1 ? "day is" : "days are"} missing a scan`, hint: "Hours aren't fully counted until the scan is filled in.", action: "Fill missed scans" },
  { target: "corrections", label: (n) => `${n} correction ${n === 1 ? "request is" : "requests are"} waiting`, hint: "Approving one can change the day.", action: "Review" },
  { target: "overtime", label: (n) => `${n} overtime ${n === 1 ? "entry is" : "entries are"} waiting`, hint: "Overtime nobody reviewed stays unapproved once the month is closed.", action: "Review" },
  { target: "absences", label: (n) => `${n} ${n === 1 ? "absence" : "absences"} without leave`, hint: "Check each is a real absence, not leave someone forgot to request.", action: "Check" },
];

function monthBounds(month: string): { from: string; to: string } {
  const first = parseDate(`${month}-01`);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/**
 * Closing a finished month: what still needs a look first (each with a way
 * to fix it), then Close — after which no scan, correction or schedule change
 * can alter the month until it's reopened.
 */
export function AttendanceMonthClose({
  month,
  onResolve,
  onChanged,
}: {
  month: string;
  /** Takes the reviewer to where an open item is fixed. */
  onResolve?: (target: ResolveTarget) => void;
  /** The month was closed or reopened. */
  onChanged?: () => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const monthLabel = parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const { data, error, reload } = useApi(() => {
    const { from, to } = monthBounds(month);

    return api.attendance.periods().then(async (periods): Promise<{ period: AttendancePeriod | null; checklist: Checklist | null }> => {
      const period = periods.find((p) => p.month === month) ?? null;
      // A closed month can't change, so there's nothing left to check.
      const checklist = period
        ? null
        : await Promise.all([
            api.attendance.list({ from, to, status: "incomplete", per_page: 1 }).then((r) => r.total),
            api.attendanceCorrections.all().then((all) => all.filter((c) => c.status === "pending" && c.date.slice(0, 7) === month).length),
            api.attendance.overtime({ status: "pending", from, to }).then((entries) => entries.length),
            api.attendance.list({ from, to, status: "absent", per_page: 1 }).then((r) => r.total),
          ]).then(([missed, corrections, overtime, absences]) => ({ missed, corrections, overtime, absences }));
      return { period, checklist };
    });
  }, [month]);
  // Null while loading; a failed check still offers Close.
  const current = data ?? (error ? { period: null, checklist: null } : null);

  async function close(ignorePending = false) {
    if (!ignorePending) {
      const ok = await confirm({
        title: `Close ${monthLabel}?`,
        description:
          "Its attendance is worked out one last time, then frozen: no scans, corrections, roster or schedule changes can alter it until someone reopens it.",
        confirmLabel: "Close month",
      });
      if (!ok) return;
    }

    let pendingMessage: string | null = null;
    setBusy(true);
    try {
      await api.attendance.lockMonth(month, ignorePending);
      notifySuccess(`${monthLabel} closed`);
      reload();
      onChanged?.();
    } catch (err) {
      if (err instanceof ApiError && err.code === "pending_overtime") pendingMessage = err.message;
      else notifyError(err);
    } finally {
      setBusy(false);
    }

    // Some overtime was never reviewed: say so, and let them close anyway.
    if (pendingMessage) {
      const anyway = await confirm({ title: "Overtime still waiting for approval", description: pendingMessage, confirmLabel: "Close anyway", destructive: true });
      if (anyway) await close(true);
    }
  }

  async function reopen() {
    const ok = await confirm({
      title: `Reopen ${monthLabel}?`,
      description: "Its attendance can change again — corrections, roster changes and recalculation. Close it again when you're done.",
      confirmLabel: "Reopen",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.attendance.unlockMonth(month);
      notifySuccess(`${monthLabel} reopened`);
      reload();
      onChanged?.();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!current) return null;

  if (current.period) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <Badge variant="secondary">
          <Lock className="size-3" />
          Month closed
        </Badge>
        <span className="text-sm text-muted-foreground">
          {monthLabel} was closed {new Date(current.period.locked_at).toLocaleDateString()}
          {current.period.locked_by ? ` by ${current.period.locked_by.name}` : ""}. Nothing in it can change.
        </span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={reopen} disabled={busy}>
          <LockOpen className="size-4" />
          Reopen
        </Button>
      </div>
    );
  }

  const open = CHECKS.filter((c) => (current.checklist?.[c.target] ?? 0) > 0);

  return (
    <div className={`rounded-xl border p-4 ${open.length ? "border-warning/40 bg-warning/5" : "border-success/40 bg-success/5"}`}>
      <div className="flex flex-wrap items-center gap-3">
        {open.length === 0 && <CheckCircle2 className="size-5 text-success" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{open.length ? `Before you close ${monthLabel}` : `${monthLabel} is ready to close`}</p>
          {open.length === 0 && <p className="text-xs text-muted-foreground">No missed scans, waiting requests, unreviewed overtime or unexplained absences.</p>}
        </div>
        <Button size="sm" variant={open.length ? "outline" : "default"} onClick={() => close()} disabled={busy}>
          <Lock className="size-4" />
          Close month
        </Button>
      </div>
      {open.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {open.map((c) => (
            <li key={c.target} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{c.label(current.checklist![c.target])}</span>
                <span className="text-xs text-muted-foreground">{c.hint}</span>
              </span>
              {onResolve && (
                <Button variant="outline" size="sm" onClick={() => onResolve(c.target)}>
                  {c.action}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
