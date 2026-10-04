"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Eye, FileClock, FileDown, Hourglass, ListChecks, Sigma } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { AttendanceCorrections } from "@/components/dashboard/attendance-corrections";
import { AttendanceDayDialog } from "@/components/dashboard/attendance-day-dialog";
import { AttendanceExportDialog } from "@/components/dashboard/attendance-export-dialog";
import { AttendanceSummary } from "@/components/dashboard/attendance-summary";
import { AttendanceTodayCard } from "@/components/dashboard/attendance-today-card";
import { currentMonth, parseDate, shiftMonth } from "@/components/dashboard/calendar-shared";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { OvertimeReview } from "@/components/dashboard/overtime-review";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { displayOrderColumn } from "@/components/dashboard/display-order";
import { api, type AttendanceDay, type AttendanceDayStatus, type AttendanceException, type DaySlot } from "@/lib/api";
import { attendanceImport } from "@/lib/excel-specs/time";
import { clock, DAY_STATUS, EXCEPTIONS, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Tab = "records" | "overtime" | "corrections" | "summary";

const TABS: Tab[] = ["records", "overtime", "corrections", "summary"];

type Punch = {
  at: string | null;
  expected: string | null;
  status: DaySlot["status"] | "unscheduled";
  late: number;
  early: number;
};

/**
 * The day's check-in (first IN) and check-out (last OUT), and how many scans
 * fall between them (a lunch break, a split shift, an extra tap). Without a
 * schedule, the first and last scan.
 */
function dayEnds(day: AttendanceDay): { in: Punch | null; out: Punch | null; between: number } {
  if (day.slots.length === 0) {
    const first = day.scans[0];
    const last = day.scans.length > 1 ? day.scans[day.scans.length - 1] : undefined;
    const punch = (at: string): Punch => ({ at, expected: null, status: "unscheduled", late: 0, early: 0 });
    return { in: first ? punch(first.at) : null, out: last ? punch(last.at) : null, between: Math.max(0, day.scans.length - 2) };
  }

  const toPunch = (slot: DaySlot): Punch => ({
    at: slot.actual_at,
    expected: slot.expected_at,
    status: slot.status,
    late: slot.late_minutes,
    early: slot.early_minutes,
  });
  const firstIn = day.slots.find((slot) => slot.type === "in");
  const lastOut = [...day.slots].reverse().find((slot) => slot.type === "out");
  const answeredBetween = day.slots.filter((slot) => slot !== firstIn && slot !== lastOut && slot.actual_at).length;

  return {
    in: firstIn ? toPunch(firstIn) : null,
    out: lastOut ? toPunch(lastOut) : null,
    between: answeredBetween + day.extra_scans.length,
  };
}

/** One time, coloured by how it went, with the reason underneath. */
function PunchCell({ punch, more }: { punch: Punch | null; more?: number }) {
  const extra = more ? <span className="text-xs text-muted-foreground">+{more} more {more === 1 ? "scan" : "scans"}</span> : null;

  if (!punch) {
    return (
      <span className="flex flex-col">
        <span className="text-muted-foreground">—</span>
        {extra}
      </span>
    );
  }

  const note =
    punch.status === "late"
      ? `${punch.late}m late`
      : punch.status === "early"
        ? `${punch.early}m early`
        : punch.status === "missing" || punch.status === "pending"
          ? `expected ${clock(punch.expected)}`
          : null;

  return (
    <span className="flex flex-col">
      <span
        className={cn(
          "font-medium tabular-nums",
          punch.status === "ok" && "text-success",
          (punch.status === "late" || punch.status === "early") && "text-warning",
          punch.status === "missing" && "text-destructive",
          (punch.status === "pending" || punch.status === "unscheduled") && "text-muted-foreground",
        )}
      >
        {punch.at ? clock(punch.at) : punch.status === "missing" ? "Missing" : "Not yet"}
      </span>
      {note && <span className={cn("text-xs", punch.status === "missing" ? "text-destructive/80" : "text-muted-foreground")}>{note}</span>}
      {extra}
    </span>
  );
}

function AttendancePageContent() {
  const { me } = useMe();
  const canManage = me?.permissions.includes("attendance.manage") ?? false;
  // ?tab=corrections deep-links to a tab (the old Corrections page redirects here).
  // The tab lives in the address (?tab=corrections), so links — e.g. from a notification — open the right one,
  // even when you're already on this page.
  const params = useSearchParams();
  const wanted = params.get("tab");
  // Filters a link can preset, e.g. from the dashboard: ?tab=corrections&status=pending, or ?date=2026-10-04.
  const linkedStatus = params.get("status") ?? undefined;
  const linkedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : null;
  const tab: Tab = TABS.includes(wanted as Tab) ? (wanted as Tab) : "records";
  const pathname = usePathname();
  // The table shows one month at a time; a busy company records far more than one page a day.
  // A linked date opens its own month.
  const [month, setMonth] = useState(() => linkedDate?.slice(0, 7) ?? currentMonth());
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: string; data: AttendanceDay[]; total: number } | null>(null);
  // The signed-in person's own days that are missing a scan, so they can ask for a correction.
  const [myIncomplete, setMyIncomplete] = useState<AttendanceDay[]>([]);
  const [preview, setPreview] = useState<AttendanceDay | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingOvertime, setPendingOvertime] = useState(0);
  const [pendingCorrections, setPendingCorrections] = useState(0);

  const key = `${month}|${reloads}`;
  const days = result?.key === key ? result.data : null;
  const truncated = result?.key === key && result.total > result.data.length;
  const employeeId = me?.employee?.id;
  const load = () => setReloads((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const first = parseDate(`${month}-01`);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

    api.attendance
      .list({ from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, per_page: 1000 })
      .then((res) => !cancelled && setResult({ key, data: res.data, total: res.total }))
      .catch(() => !cancelled && setResult({ key, data: [], total: 0 }));

    return () => {
      cancelled = true;
    };
  }, [month, key]);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    const from = new Date();
    from.setDate(from.getDate() - 45);
    const iso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;

    api.attendance
      .list({ employee_id: employeeId, from: iso, status: "incomplete", per_page: 100 })
      .then((res) => !cancelled && setMyIncomplete(res.data))
      .catch(() => !cancelled && setMyIncomplete([]));

    return () => {
      cancelled = true;
    };
  }, [employeeId, reloads]);

  useEffect(() => {
    if (!canManage) return;
    api.attendance
      .overtime({ status: "pending" })
      .then((entries) => setPendingOvertime(entries.length))
      .catch(() => setPendingOvertime(0));
    api.attendanceCorrections
      .all()
      .then((all) => setPendingCorrections(all.filter((c) => c.status === "pending").length))
      .catch(() => setPendingCorrections(0));
  }, [canManage, reloads]);

  function switchTab(next: Tab) {
    window.history.replaceState(null, "", next === "records" ? pathname : `${pathname}?tab=${next}`);
  }

  const columns: DataTableColumn<AttendanceDay>[] = [
    ...(canManage
      ? [
          {
            id: "employee",
            header: "Employee",
            primary: true,
            cell: (d: AttendanceDay) => (
              <div className="flex flex-col">
                <span className="font-medium">{d.employee?.name}</span>
                <span className="text-xs text-muted-foreground">{d.employee?.branch?.name ?? ""}</span>
              </div>
            ),
            sortValue: (d: AttendanceDay) => d.employee?.name,
            searchValue: (d: AttendanceDay) => [d.employee?.name, d.employee?.employee_code].filter(Boolean).join(" "),
          },
          displayOrderColumn<AttendanceDay>((d) => d.employee?.sort_order),
        ]
      : []),
    {
      id: "date",
      header: "Date",
      primary: !canManage,
      cell: (d) => (
        <div className="flex flex-col">
          <span>{parseDate(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="text-xs text-muted-foreground">{d.schedule ?? d.label ?? ""}</span>
        </div>
      ),
      sortValue: (d) => d.date,
      searchValue: (d) => d.schedule,
    },
    {
      id: "check_in",
      header: "Check in",
      cell: (d) => <PunchCell punch={dayEnds(d).in} />,
      // By time of day ("08:01"); days without one go last.
      sortValue: (d) => (dayEnds(d).in?.at ? clock(dayEnds(d).in!.at) : null),
      sortLabels: ["Earliest first", "Latest first"],
    },
    {
      id: "check_out",
      header: "Check out",
      cell: (d) => {
        const ends = dayEnds(d);
        return <PunchCell punch={ends.out} more={ends.between} />;
      },
      sortValue: (d) => (dayEnds(d).out?.at ? clock(dayEnds(d).out!.at) : null),
      sortLabels: ["Earliest first", "Latest first"],
    },
    {
      id: "worked",
      header: "Worked",
      cell: (d) => (
        <div className="flex flex-col text-sm">
          <span className="tabular-nums">{d.worked_minutes ? formatMinutes(d.worked_minutes) : "—"}</span>
          {d.overtime_minutes > 0 && (
            <span className="text-xs text-info">
              +{formatMinutes(d.overtime_minutes)} OT{d.overtime_status === "pending" ? " (to review)" : ""}
            </span>
          )}
        </div>
      ),
      sortValue: (d) => d.worked_minutes,
    },
    {
      id: "status",
      header: "Status",
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={DAY_STATUS[d.status].tone}>{DAY_STATUS[d.status].label}</Badge>
          {d.exceptions
            .filter((code) => code !== "absent")
            .map((code) => (
              <Badge key={code} variant={EXCEPTIONS[code].tone}>
                {EXCEPTIONS[code].label}
                {code === "late" && d.late_minutes ? ` ${d.late_minutes}m` : ""}
              </Badge>
            ))}
        </div>
      ),
      sortValue: (d) => d.status,
    },
  ];

  const employeeOptions = Array.from(new Map((days ?? []).filter((d) => d.employee).map((d) => [d.employee!.id, d.employee!.name])).entries())
    .map(([value, label]) => ({ value: String(value), label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filters: DataTableFilter<AttendanceDay>[] = [
    {
      type: "select",
      id: "status",
      label: "Status",
      options: (Object.keys(DAY_STATUS) as AttendanceDayStatus[]).map((s) => ({ value: s, label: DAY_STATUS[s].label })),
      getValue: (d) => d.status,
    },
    {
      type: "select",
      id: "exception",
      label: "Problem",
      options: (Object.keys(EXCEPTIONS) as AttendanceException[]).map((e) => ({ value: e, label: EXCEPTIONS[e].label })),
      getValue: (d) => d.exceptions[0],
      // A day can have several problems; it matches if it has the chosen one.
      matches: (d, selected) => d.exceptions.includes(selected as AttendanceException),
    },
    ...(canManage
      ? [
          {
            type: "select" as const,
            id: "employee",
            label: "Employee",
            options: employeeOptions,
            getValue: (d: AttendanceDay) => String(d.employee?.id ?? ""),
          },
        ]
      : []),
    { type: "date-range", id: "date", label: "Date", getValue: (d) => d.date },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Clock; visible: boolean; count?: number }[] = [
    { id: "records", label: "Records", icon: ListChecks, visible: true },
    { id: "overtime", label: "Overtime", icon: Hourglass, visible: canManage, count: pendingOvertime },
    // Everyone: employees request their own corrections here, managers review them.
    { id: "corrections", label: "Corrections", icon: FileClock, visible: true, count: canManage ? pendingCorrections : 0 },
    { id: "summary", label: "Monthly summary", icon: Sigma, visible: true },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Attendance"
          action={
            <div className="flex flex-wrap gap-2">
              {/* Export has its own dialog (date range, employee), so only Import comes from here. */}
              <ExcelActions importSpec={canManage ? attendanceImport : undefined} onImported={load} />
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <FileDown className="size-4" />
                Export
              </Button>
            </div>
          }
        />

        {myIncomplete.length > 0 && (
          <Alert
            variant="warning"
            title={myIncomplete.length === 1 ? "One of your days is missing a scan" : `${myIncomplete.length} of your days are missing a scan`}
            action={
              <button type="button" onClick={() => switchTab("corrections")} className="text-sm font-medium underline">
                Request a correction
              </button>
            }
          >
            {myIncomplete.map((d) => d.date).join(", ")} — those hours aren&apos;t fully counted until a correction adds the
            missing scan.
          </Alert>
        )}

        {me?.employee ? (
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            <AttendanceTodayCard onScanned={load} />
            <Card>
              <CardHeader>
                <CardTitle>Set up a one-tap shortcut</CardTitle>
                <CardDescription>
                  Open instant-scan mode on your phone, then use your browser&apos;s &quot;Add to Home Screen&quot; option.
                  The icon opens straight to the camera, ready to scan — no need to open the app each time.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your account isn&apos;t linked to an employee record, so you can&apos;t scan yourself.
          </p>
        )}

        {/* Scrolls sideways on a narrow phone instead of widening the page. */}
        <div className="inline-flex max-w-full self-start overflow-x-auto rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
          {tabs
            .filter((t) => t.visible)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => switchTab(t.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
                {t.count ? (
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab === t.id ? "bg-primary-foreground/20" : "bg-info/15 text-info")}>
                    {t.count}
                  </span>
                ) : null}
              </button>
            ))}
        </div>

        {tab === "records" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <h2 className="min-w-40 text-center text-base font-semibold">
                {parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
              <Button variant="outline" onClick={() => setMonth(currentMonth())}>
                Today
              </Button>
            </div>

            {truncated && result && (
              <Alert variant="warning">
                This month has {result.total.toLocaleString()} records; showing the newest {result.data.length.toLocaleString()}. Use the
                filters, or open a single employee, to see the rest.
              </Alert>
            )}

            <DataTable
              key={linkedDate ?? "all"}
              initialFilters={linkedDate ? { "date.from": linkedDate, "date.to": linkedDate } : undefined}
              data={days}
              getRowId={(d) => d.id}
              columns={columns}
              filters={filters}
              searchPlaceholder="Search by employee or schedule…"
              emptyState={{
                icon: Clock,
                title: "No attendance this month",
                description: "Scans and work days show up here once people have a work schedule.",
              }}
              rowActions={(d) => (
                <Button variant="outline" size="sm" onClick={() => setPreview(d)}>
                  <Eye className="size-3.5" />
                  Details
                </Button>
              )}
            />
          </>
        )}

        {tab === "overtime" && canManage && <OvertimeReview onChanged={load} />}

        {tab === "corrections" && <AttendanceCorrections key={linkedStatus ?? "all"} onChanged={load} initialStatus={linkedStatus} />}

        {tab === "summary" && <AttendanceSummary canManage={canManage} />}
      </div>

      <AttendanceExportDialog open={exportOpen} onOpenChange={setExportOpen} month={month} canPickEmployee={canManage} />
      <AttendanceDayDialog
        day={preview}
        onOpenChange={(open) => !open && setPreview(null)}
        canManage={canManage}
        onAdjusted={(day) => {
          setPreview(day);
          load();
        }}
      />
    </div>
  );
}

// useSearchParams needs a Suspense boundary so the page can still be prerendered.
export default function AttendancePage() {
  return (
    <Suspense>
      <AttendancePageContent />
    </Suspense>
  );
}
