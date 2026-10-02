"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Lock, LockOpen, Sigma } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { currentMonth, parseDate, shiftMonth } from "@/components/dashboard/calendar-shared";
import { api, ApiError, type AttendanceSummary as Summary, type AttendanceSummaryRow } from "@/lib/api";
import { exportAttendanceSummary } from "@/lib/excel-specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatMinutes } from "@/lib/schedule";

const num = (n: number) => (n === 0 ? <span className="text-muted-foreground">·</span> : <span className="tabular-nums">{n}</span>);
const mins = (n: number) => (n === 0 ? <span className="text-muted-foreground">·</span> : <span className="tabular-nums">{formatMinutes(n)}</span>);

/**
 * The month per employee — what payroll reads. Overtime only counts once
 * approved. A month that has been paid can be locked, after which nothing in
 * it can change until it's reopened.
 */
export function AttendanceSummary({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm();
  // Payroll looks at the month that just ended.
  const [month, setMonth] = useState(() => shiftMonth(currentMonth(), -1));
  const [reloads, setReloads] = useState(0);
  // Kept with the request it answers; a different key means the new month is still loading.
  const [result, setResult] = useState<{ key: string; data: Summary } | null>(null);
  const requestKey = `${month}|${reloads}`;
  const summary = result?.key === requestKey ? result.data : null;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.attendance
      .summary(month)
      .then((data) => !cancelled && setResult({ key: requestKey, data }))
      .catch(() => !cancelled && setResult({ key: requestKey, data: { month, locked: false, rows: [] } }));
    return () => {
      cancelled = true;
    };
  }, [month, requestKey]);

  const monthLabel = parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isPast = month < currentMonth();
  const partial = summary?.rows.some((r) => r.is_partial) ?? false;

  async function lock(ignorePending = false) {
    if (!ignorePending) {
      const ok = await confirm({
        title: `Lock ${monthLabel}?`,
        description:
          "Its attendance is recalculated one last time, then frozen: no scans, corrections, roster or schedule changes can alter it until an admin reopens it. Do this once payroll for the month is done.",
        confirmLabel: "Lock month",
      });
      if (!ok) return;
    }

    let pendingMessage: string | null = null;
    setBusy(true);
    try {
      await api.attendance.lockMonth(month, ignorePending);
      notifySuccess(`${monthLabel} locked`);
      setReloads((n) => n + 1);
    } catch (err) {
      if (err instanceof ApiError && err.code === "pending_overtime") pendingMessage = err.message;
      else notifyError(err);
    } finally {
      setBusy(false);
    }

    // Some overtime was never reviewed: say so, and let them lock anyway (it won't be paid).
    if (pendingMessage) {
      const anyway = await confirm({
        title: "Overtime still waiting for approval",
        description: pendingMessage,
        confirmLabel: "Lock anyway",
        destructive: true,
      });
      if (anyway) await lock(true);
    }
  }

  async function unlock() {
    const ok = await confirm({
      title: `Reopen ${monthLabel}?`,
      description: "Its attendance can change again — corrections, roster changes and recalculation. Lock it again when you're done.",
      confirmLabel: "Reopen",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.attendance.unlockMonth(month);
      notifySuccess(`${monthLabel} reopened`);
      setReloads((n) => n + 1);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!summary) return;
    try {
      const filename = await exportAttendanceSummary(summary);
      notifySuccess("Excel file downloaded", filename);
    } catch (err) {
      notifyError(err);
    }
  }

  const columns: DataTableColumn<AttendanceSummaryRow>[] = [
    {
      id: "employee",
      header: "Employee",
      primary: true,
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.employee.name}</span>
          <span className="text-xs text-muted-foreground">{[r.employee.employee_code, r.employee.branch].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      ),
      sortValue: (r) => r.employee.name,
      searchValue: (r) => [r.employee.name, r.employee.employee_code, r.employee.branch].filter(Boolean).join(" "),
    },
    { id: "scheduled", header: "Work days", cell: (r) => num(r.scheduled_days), sortValue: (r) => r.scheduled_days },
    { id: "present", header: "Present", cell: (r) => num(r.present_days), sortValue: (r) => r.present_days },
    {
      id: "absent",
      header: "Absent",
      cell: (r) => (r.absent_days ? <span className="font-medium tabular-nums text-destructive">{r.absent_days}</span> : num(0)),
      sortValue: (r) => r.absent_days,
    },
    {
      id: "incomplete",
      header: "Missing scan",
      cell: (r) => (r.incomplete_days ? <span className="tabular-nums text-warning">{r.incomplete_days}</span> : num(0)),
      sortValue: (r) => r.incomplete_days,
      hideOnMobile: true,
    },
    {
      id: "late",
      header: "Late",
      cell: (r) =>
        r.late_days ? (
          <span className="tabular-nums text-warning">
            {r.late_days}× <span className="text-xs">({formatMinutes(r.late_minutes)})</span>
          </span>
        ) : (
          num(0)
        ),
      sortValue: (r) => r.late_minutes,
    },
    { id: "worked", header: "Worked", cell: (r) => mins(r.worked_minutes), sortValue: (r) => r.worked_minutes },
    {
      id: "ot",
      header: "Overtime (approved)",
      cell: (r) => {
        const total = r.overtime_workday_minutes + r.overtime_day_off_minutes + r.overtime_holiday_minutes;
        if (total === 0 && r.overtime_pending_minutes === 0) return num(0);
        return (
          <div className="flex flex-col text-xs">
            {total > 0 && <span className="text-sm font-medium tabular-nums">{formatMinutes(total)}</span>}
            {r.overtime_day_off_minutes > 0 && <span className="text-muted-foreground">day off {formatMinutes(r.overtime_day_off_minutes)}</span>}
            {r.overtime_holiday_minutes > 0 && <span className="text-muted-foreground">holiday {formatMinutes(r.overtime_holiday_minutes)}</span>}
            {r.overtime_pending_minutes > 0 && <span className="text-info">+{formatMinutes(r.overtime_pending_minutes)} waiting</span>}
          </div>
        );
      },
      sortValue: (r) => r.overtime_workday_minutes + r.overtime_day_off_minutes + r.overtime_holiday_minutes,
    },
    { id: "night", header: "Night", cell: (r) => mins(r.night_minutes), sortValue: (r) => r.night_minutes, hideOnMobile: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-40 text-center text-base font-semibold">{monthLabel}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          <ChevronRight className="size-4" />
        </Button>
        {summary?.locked && (
          <Badge variant="secondary">
            <Lock className="size-3" />
            Locked for payroll
          </Badge>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!summary || summary.rows.length === 0}>
            <FileDown className="size-4" />
            Export
          </Button>
          {canManage && summary && isPast && !summary.locked && (
            <Button onClick={() => lock()} disabled={busy}>
              <Lock className="size-4" />
              Lock month
            </Button>
          )}
          {canManage && summary?.locked && (
            <Button variant="outline" onClick={unlock} disabled={busy}>
              <LockOpen className="size-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {partial && <Alert variant="info">This month isn&apos;t over yet — the numbers will keep changing until it ends.</Alert>}

      <DataTable
        data={summary?.rows ?? null}
        getRowId={(r) => r.employee.id}
        columns={columns}
        searchPlaceholder="Search employee…"
        initialSort={{ columnId: "employee", direction: "asc" }}
        emptyState={{
          icon: Sigma,
          title: "No one to summarise",
          description: "Employees with a work schedule appear here.",
        }}
      />
    </div>
  );
}
