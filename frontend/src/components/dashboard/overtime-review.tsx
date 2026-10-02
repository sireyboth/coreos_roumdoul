"use client";

import { useEffect, useState } from "react";
import { Check, Hourglass, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { api, type OvertimeEntry } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatMinutes, OVERTIME_TYPE } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Status = OvertimeEntry["overtime_status"];

const STATUS_TABS: { id: Status; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

/**
 * Overtime that a schedule says needs a manager's approval. Only approved
 * overtime reaches the monthly summary payroll reads. If a day's overtime
 * changes afterwards (e.g. a correction), it comes back here for review.
 */
export function OvertimeReview({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<Status>("pending");
  const [reloads, setReloads] = useState(0);
  // Kept with the request it answers; a different key means it is still loading.
  const [result, setResult] = useState<{ key: string; data: OvertimeEntry[] } | null>(null);
  const requestKey = `${status}|${reloads}`;
  const entries = result?.key === requestKey ? result.data : null;
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.attendance
      .overtime({ status })
      .then((data) => !cancelled && setResult({ key: requestKey, data }))
      .catch(() => !cancelled && setResult({ key: requestKey, data: [] }));
    return () => {
      cancelled = true;
    };
  }, [status, requestKey]);

  async function review(entry: OvertimeEntry, decision: "approve" | "reject") {
    setBusy(entry.id);
    try {
      if (decision === "approve") await api.attendance.approveOvertime(entry.id);
      else await api.attendance.rejectOvertime(entry.id);
      notifySuccess(
        decision === "approve" ? "Overtime approved" : "Overtime rejected",
        `${entry.employee.name} · ${formatMinutes(entry.overtime_minutes)} on ${entry.date}`,
      );
      setReloads((n) => n + 1);
      onChanged?.();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  const columns: DataTableColumn<OvertimeEntry>[] = [
    {
      id: "employee",
      header: "Employee",
      primary: true,
      cell: (e) => (
        <div className="flex flex-col">
          <span className="font-medium">{e.employee.name}</span>
          {e.employee.employee_code && <span className="text-xs text-muted-foreground">{e.employee.employee_code}</span>}
        </div>
      ),
      sortValue: (e) => e.employee.name,
      searchValue: (e) => [e.employee.name, e.employee.employee_code].filter(Boolean).join(" "),
    },
    {
      id: "date",
      header: "Date",
      cell: (e) => parseDate(e.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      sortValue: (e) => e.date,
    },
    {
      id: "overtime",
      header: "Overtime",
      cell: (e) => (
        <div className="flex flex-col">
          <span className="font-semibold tabular-nums">{formatMinutes(e.overtime_minutes)}</span>
          <span className="text-xs text-muted-foreground">{OVERTIME_TYPE[e.overtime_type]}</span>
        </div>
      ),
      sortValue: (e) => e.overtime_minutes,
    },
    {
      id: "worked",
      header: "Worked / scheduled",
      cell: (e) => (
        <span className="tabular-nums text-muted-foreground">
          {formatMinutes(e.worked_minutes)} / {e.scheduled_minutes > 0 ? formatMinutes(e.scheduled_minutes) : "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      id: "schedule",
      header: "Schedule",
      cell: (e) => <span className="text-muted-foreground">{e.schedule ?? "—"}</span>,
      hideOnMobile: true,
    },
    ...(status !== "pending"
      ? [
          {
            id: "reviewed",
            header: "Reviewed by",
            cell: (e: OvertimeEntry) => <span className="text-muted-foreground">{e.reviewed_by?.name ?? "Automatic"}</span>,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={status === tab.id}
            onClick={() => setStatus(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              status === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        data={entries}
        getRowId={(e) => e.id}
        columns={columns}
        searchPlaceholder="Search employee…"
        initialSort={{ columnId: "date", direction: "desc" }}
        emptyState={{
          icon: Hourglass,
          title: status === "pending" ? "Nothing waiting for approval" : `No ${status} overtime`,
          description:
            status === "pending"
              ? "Overtime on schedules that need approval shows up here."
              : "Overtime appears here once it has been reviewed.",
        }}
        rowActions={(e) =>
          e.overtime_status === "pending" ? (
            <>
              <Button size="sm" onClick={() => review(e, "approve")} disabled={busy === e.id}>
                <Check className="size-3.5" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => review(e, "reject")} disabled={busy === e.id}>
                <X className="size-3.5" />
                Reject
              </Button>
            </>
          ) : (
            <Badge variant={e.overtime_status === "approved" ? "success" : "secondary"} className="capitalize">
              {e.overtime_status}
            </Badge>
          )
        }
      />
    </div>
  );
}
