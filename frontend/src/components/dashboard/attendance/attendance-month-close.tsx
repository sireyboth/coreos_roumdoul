"use client";

import { useState } from "react";
import { CheckCircle2, Lock, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { parseDate } from "@/components/dashboard/schedules/calendar-shared";
import { useApi } from "@/hooks/use-api";
import { api, ApiError, type AttendancePeriod } from "@/lib/api";
import { dateLocale, useLang, useT, type TKey } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

export type ResolveTarget = "missed" | "absences" | "corrections" | "overtime";

type Checklist = Record<ResolveTarget, number>;

const CHECKS: { target: ResolveTarget; one: TKey; many: TKey; hint: TKey; action: TKey }[] = [
  {
    target: "missed",
    one: "attendance.monthClose.check.missedOne",
    many: "attendance.monthClose.check.missedMany",
    hint: "attendance.monthClose.check.missedHint",
    action: "attendance.monthClose.check.missedAction",
  },
  {
    target: "corrections",
    one: "attendance.monthClose.check.correctionsOne",
    many: "attendance.monthClose.check.correctionsMany",
    hint: "attendance.monthClose.check.correctionsHint",
    action: "attendance.monthClose.check.review",
  },
  {
    target: "overtime",
    one: "attendance.monthClose.check.overtimeOne",
    many: "attendance.monthClose.check.overtimeMany",
    hint: "attendance.monthClose.check.overtimeHint",
    action: "attendance.monthClose.check.review",
  },
  {
    target: "absences",
    one: "attendance.monthClose.check.absencesOne",
    many: "attendance.monthClose.check.absencesMany",
    hint: "attendance.monthClose.check.absencesHint",
    action: "attendance.monthClose.check.check",
  },
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
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const monthLabel = parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });

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
        title: t("attendance.monthClose.confirm.closeTitle", { month: monthLabel }),
        description: t("attendance.monthClose.confirm.closeText"),
        confirmLabel: t("attendance.monthClose.open.close"),
      });
      if (!ok) return;
    }

    let pendingMessage: string | null = null;
    setBusy(true);
    try {
      await api.attendance.lockMonth(month, ignorePending);
      notifySuccess(t("attendance.monthClose.confirm.closed", { month: monthLabel }));
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
      const anyway = await confirm({
        title: t("attendance.monthClose.confirm.pendingTitle"),
        description: pendingMessage,
        confirmLabel: t("attendance.monthClose.confirm.closeAnyway"),
        destructive: true,
      });
      if (anyway) await close(true);
    }
  }

  async function reopen() {
    const ok = await confirm({
      title: t("attendance.monthClose.confirm.reopenTitle", { month: monthLabel }),
      description: t("attendance.monthClose.confirm.reopenText"),
      confirmLabel: t("attendance.monthClose.closed.reopen"),
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.attendance.unlockMonth(month);
      notifySuccess(t("attendance.monthClose.confirm.reopened", { month: monthLabel }));
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
          {t("attendance.monthClose.closed.badge")}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {current.period.locked_by
            ? t("attendance.monthClose.closed.textBy", {
                month: monthLabel,
                date: new Date(current.period.locked_at).toLocaleDateString(dateLocale(lang)),
                name: current.period.locked_by.name,
              })
            : t("attendance.monthClose.closed.text", { month: monthLabel, date: new Date(current.period.locked_at).toLocaleDateString(dateLocale(lang)) })}
        </span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={reopen} disabled={busy}>
          <LockOpen className="size-4" />
          {t("attendance.monthClose.closed.reopen")}
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
          <p className="text-sm font-semibold">{t(open.length ? "attendance.monthClose.open.before" : "attendance.monthClose.open.ready", { month: monthLabel })}</p>
          {open.length === 0 && <p className="text-xs text-muted-foreground">{t("attendance.monthClose.open.allClear")}</p>}
        </div>
        <Button size="sm" variant={open.length ? "outline" : "default"} onClick={() => close()} disabled={busy}>
          <Lock className="size-4" />
          {t("attendance.monthClose.open.close")}
        </Button>
      </div>
      {open.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {open.map((c) => (
            <li key={c.target} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{t(current.checklist![c.target] === 1 ? c.one : c.many, { n: current.checklist![c.target] })}</span>
                <span className="text-xs text-muted-foreground">{t(c.hint)}</span>
              </span>
              {onResolve && (
                <Button variant="outline" size="sm" onClick={() => onResolve(c.target)}>
                  {t(c.action)}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
