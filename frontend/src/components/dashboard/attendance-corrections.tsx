"use client";

import { useEffect, useState } from "react";
import { FileEdit, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, AttendanceCorrection } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { attendanceImport, exportCorrections } from "@/lib/excel-specs/time";
import { dateOnly } from "@/lib/date";
import { notifyError, notifySuccess } from "@/lib/notify";

const STATUS = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
} as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The typed times as wall-clock datetimes on the chosen date, in order. A time
 * earlier than the one before it is the next morning (a night shift's OUT).
 */
function scansFor(date: string, times: string[]): string[] {
  let day = date;
  let previous = "";
  return times
    .filter(Boolean)
    .map((time) => {
      if (previous && time <= previous) {
        const next = new Date(`${day}T00:00:00`);
        next.setDate(next.getDate() + 1);
        day = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      }
      previous = time;
      return `${day}T${time}`;
    });
}

/** The Corrections tab on the Attendance page: request a missed scan, and (managers) review requests. */
/** initialStatus: start filtered, e.g. "pending" when opened from the dashboard. */
export function AttendanceCorrections({ onChanged, initialStatus }: { onChanged?: () => void; initialStatus?: string }) {
  const { me } = useMe();
  const [corrections, setCorrections] = useState<AttendanceCorrection[] | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  // The scans to add, as HH:MM on the chosen date (a time earlier than the one before is the next morning).
  const [times, setTimes] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.attendanceCorrections.list().then((res) => setCorrections(res.data)).catch(() => setCorrections([]));
  }

  useEffect(() => {
    load();
  }, []);

  // A review also changes the page's pending count, so the page reloads too.
  function reload() {
    load();
    onChanged?.();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.attendanceCorrections.create({ date, reason, scans: scansFor(date, times) });
      notifySuccess("Correction requested", "Your manager will review it.");
      setDate("");
      setReason("");
      setTimes([""]);
      setOpen(false);
      reload();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(correction: AttendanceCorrection) {
    try {
      await api.attendanceCorrections.approve(correction.id);
      notifySuccess("Correction approved", "The scans were added and the day recalculated.");
    } catch (err) {
      notifyError(err);
    }
    reload();
  }

  async function handleReject(correction: AttendanceCorrection) {
    try {
      await api.attendanceCorrections.reject(correction.id);
      notifySuccess("Correction rejected");
    } catch (err) {
      notifyError(err);
    }
    reload();
  }

  const canManage = me?.permissions.includes("attendance.manage") ?? false;

  const columns: DataTableColumn<AttendanceCorrection>[] = [
    ...(canManage
      ? [
          {
            id: "employee",
            header: "Employee",
            primary: true,
            cell: (c: AttendanceCorrection) => <span className="font-medium">{c.employee.name}</span>,
            sortValue: (c: AttendanceCorrection) => c.employee.name,
            searchValue: (c: AttendanceCorrection) => c.employee.name,
          },
        ]
      : []),
    {
      id: "date",
      header: "Date",
      primary: !canManage,
      className: "whitespace-nowrap",
      cell: (c) =>
        new Date(dateOnly(c.date) + "T00:00:00").toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }),
      sortValue: (c) => dateOnly(c.date),
    },
    {
      id: "scans",
      header: "Scans to add",
      cell: (c) => <span className="tabular-nums text-muted-foreground">{c.requested_times.map(formatTime).join(" · ") || "—"}</span>,
      sortValue: (c) => c.requested_times[0],
      sortLabels: ["Earliest first", "Latest first"],
    },
    {
      id: "reason",
      header: "Reason",
      // Truncated in the table; wraps in full on a phone card.
      className: "max-w-48 truncate",
      cell: (c) => <span className="text-muted-foreground">{c.reason}</span>,
      searchValue: (c) => c.reason,
      sortValue: (c) => c.reason,
    },
    {
      id: "status",
      header: "Status",
      cell: (c) => <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>,
      sortValue: (c) => c.status,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Fix a missed check-in or check-out.</p>
        <div className="flex flex-wrap gap-2">
          <ExcelActions
            onExport={exportCorrections}
            // Importing files rows for other people, which only attendance managers may do.
            importSpec={me?.permissions.includes("attendance.manage") ? attendanceImport : undefined}
            onImported={reload}
          />
          {me?.employee && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button>
                    <Plus className="size-4" />
                    Request correction
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request a correction</DialogTitle>
                  <DialogDescription>Your manager will need to approve this.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Scans you missed</Label>
                    <p className="-mt-1 text-xs text-muted-foreground">
                      Only the ones you forgot — e.g. just 12:00 if you didn&apos;t scan out for lunch. Your schedule
                      decides whether each is an IN or an OUT.
                    </p>
                    {times.map((time, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          required
                          aria-label={`Scan ${i + 1}`}
                          value={time}
                          onChange={(e) => setTimes((all) => all.map((t, j) => (j === i ? e.target.value : t)))}
                          className="w-32"
                        />
                        {times.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove this time"
                            onClick={() => setTimes((all) => all.filter((_, j) => j !== i))}
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {times.length < 8 && (
                      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setTimes((all) => [...all, ""])}>
                        <Plus className="size-3.5" />
                        Add another time
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Input id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  {error && <Alert variant="destructive">{error}</Alert>}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Submitting…" : "Submit request"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* A table on desktop, stacked cards on phones. */}
      <DataTable
        data={corrections}
        getRowId={(correction) => correction.id}
        columns={columns}
        filters={[
          {
            type: "select",
            id: "status",
            label: "Status",
            options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
            getValue: (correction) => correction.status,
          },
        ]}
        searchPlaceholder={canManage ? "Search by employee or reason…" : "Search by reason…"}
        initialFilters={initialStatus && initialStatus in STATUS ? { status: initialStatus } : undefined}
        emptyState={{ icon: FileEdit, title: "No correction requests", description: "Nothing to review right now." }}
        rowActions={
          canManage
            ? (correction) =>
                correction.status === "pending" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleApprove(correction)}>
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReject(correction)}>
                      Reject
                    </Button>
                  </>
                ) : null
            : undefined
        }
      />
    </div>
  );
}
