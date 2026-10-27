"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarCheck, CalendarPlus, ScanLine, Clock, Eye, FileClock, FileDown, Hourglass, ListChecks, Table2, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { AttendanceAddDialog } from "@/components/dashboard/attendance-add-dialog";
import { AttendanceCorrections } from "@/components/dashboard/attendance-corrections";
import { AttendanceDayDialog } from "@/components/dashboard/attendance-day-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { notifyError, notifySuccess } from "@/lib/notify";
import { AttendanceExportDialog } from "@/components/dashboard/attendance-export-dialog";
import { AttendanceFillMissedDialog } from "@/components/dashboard/attendance-fill-missed-dialog";
import { MissedScansDialog } from "@/components/dashboard/missed-scans-dialog";
import { AttendanceReport } from "@/components/dashboard/attendance-report";
import { AttendanceTodayCard } from "@/components/dashboard/attendance-today-card";
import { currentMonth, monthBounds, MonthBar, parseDate } from "@/components/dashboard/calendar-shared";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { OvertimeReview } from "@/components/dashboard/overtime-review";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { useApi } from "@/hooks/use-api";
import { displayOrderColumn } from "@/components/dashboard/display-order";
import { api, type AttendanceDay, type AttendanceDayStatus, type AttendanceException, type DaySlot } from "@/lib/api";
import { attendanceImport } from "@/lib/excel-specs/time";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { clock, DAY_STATUS, EXCEPTIONS, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Tab = "records" | "overtime" | "corrections" | "report";

const TABS: Tab[] = ["records", "overtime", "corrections", "report"];

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
  const t = useT();
  const extra = more ? (
    <span className="text-xs text-muted-foreground">{t(more === 1 ? "attendance.page.moreScansOne" : "attendance.page.moreScansOther", { n: more })}</span>
  ) : null;

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
      ? t("attendance.page.lateBy", { n: punch.late })
      : punch.status === "early"
        ? t("attendance.page.earlyBy", { n: punch.early })
        : punch.status === "missing" || punch.status === "pending"
          ? t("attendance.page.expected", { time: clock(punch.expected) })
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
        {punch.at ? clock(punch.at) : punch.status === "missing" ? t("attendance.page.missing") : t("attendance.page.notYet")}
      </span>
      {note && <span className={cn("text-xs", punch.status === "missing" ? "text-destructive/80" : "text-muted-foreground")}>{note}</span>}
      {extra}
    </span>
  );
}

function AttendancePageContent() {
  const t = useT();
  const lang = useLang();
  const { me } = useMe();
  const canManage = me?.permissions.includes("attendance.manage") ?? false;
  // ?tab=corrections deep-links to a tab (the old Corrections page redirects here).
  // The tab lives in the address (?tab=corrections), so links — e.g. from a notification — open the right one,
  // even when you're already on this page.
  const params = useSearchParams();
  // The old Monthly summary tab became part of Report; its links still land somewhere useful.
  const wanted = params.get("tab") === "summary" ? "report" : params.get("tab");
  // Filters a link can preset, e.g. from the dashboard: ?tab=corrections&status=pending, or ?date=2026-10-04.
  const linkedStatus = params.get("status") ?? undefined;
  const linkedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : null;
  const tab: Tab = TABS.includes(wanted as Tab) ? (wanted as Tab) : "records";
  const pathname = usePathname();
  // The table shows one month at a time; a busy company records far more than one page a day.
  // A linked date opens its own month.
  const [month, setMonth] = useState(() => linkedDate?.slice(0, 7) ?? currentMonth());
  const [reloads, setReloads] = useState(0);
  const [preview, setPreview] = useState<AttendanceDay | null>(null);
  // The days chosen for "Fill missed scans", and how to clear the table's selection once done.
  const [filling, setFilling] = useState<{ days: AttendanceDay[]; clear: () => void } | null>(null);
  const [missedOpen, setMissedOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingOvertime, setPendingOvertime] = useState(0);
  const [pendingCorrections, setPendingCorrections] = useState(0);

  const { data: page, error: pageError } = useApi(() => api.attendance.list({ ...monthBounds(month), per_page: 1000 }), [month, reloads]);
  const result = page ?? (pageError ? { data: [] as AttendanceDay[], total: 0 } : null);
  const days = result?.data ?? null;
  const missedCount = days?.filter((d) => d.slots.some((s) => s.scan_id === null && s.status === "missing")).length ?? 0;
  const truncated = result !== null && result.total > result.data.length;
  const employeeId = me?.employee?.id;
  // The signed-in person's own days that are missing a scan, so they can ask for a correction.
  const { data: incomplete } = useApi(
    employeeId
      ? () => {
          const from = new Date();
          from.setDate(from.getDate() - 45);
          const iso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
          return api.attendance.list({ employee_id: employeeId, from: iso, status: "incomplete", per_page: 100 }).then((res) => res.data);
        }
      : null,
    [employeeId, reloads],
    { keepPrevious: true },
  );
  const myIncomplete = incomplete ?? [];
  const load = () => setReloads((n) => n + 1);
  const confirm = useConfirm();

  async function deleteDays(selected: AttendanceDay[], clearSelection: () => void) {
    const ok = await confirm({
      title: selected.length === 1 ? t("attendance.page.deleteTitleOne") : t("attendance.page.deleteTitleOther", { n: selected.length }),
      description: t("attendance.day.deleteWarning"),
      destructive: true,
    });
    if (!ok) return;

    try {
      const { deleted } = await api.attendance.deleteDays(selected.map((d) => d.id));
      notifySuccess(t(deleted === 1 ? "attendance.page.deletedOne" : "attendance.page.deletedOther", { n: deleted }));
      clearSelection();
    } catch (err) {
      notifyError(err);
    }
    load();
  }

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
            header: t("common.field.employee"),
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
      header: t("common.field.date"),
      primary: !canManage,
      cell: (d) => (
        <div className="flex flex-col">
          <span>{parseDate(d.date).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="text-xs text-muted-foreground">{d.schedule ?? d.label ?? ""}</span>
        </div>
      ),
      sortValue: (d) => d.date,
      searchValue: (d) => d.schedule,
    },
    {
      id: "check_in",
      header: t("attendance.page.checkIn"),
      cell: (d) => <PunchCell punch={dayEnds(d).in} />,
      // By time of day ("08:01"); days without one go last.
      sortValue: (d) => (dayEnds(d).in?.at ? clock(dayEnds(d).in!.at) : null),
      sortLabels: [t("attendance.page.earliestFirst"), t("attendance.page.latestFirst")],
    },
    {
      id: "check_out",
      header: t("attendance.page.checkOut"),
      cell: (d) => {
        const ends = dayEnds(d);
        return <PunchCell punch={ends.out} more={ends.between} />;
      },
      sortValue: (d) => (dayEnds(d).out?.at ? clock(dayEnds(d).out!.at) : null),
      sortLabels: [t("attendance.page.earliestFirst"), t("attendance.page.latestFirst")],
    },
    {
      id: "worked",
      header: t("attendance.page.worked"),
      cell: (d) => (
        <div className="flex flex-col text-sm">
          <span className="tabular-nums">{d.worked_minutes ? formatMinutes(d.worked_minutes, lang) : "—"}</span>
          {d.overtime_minutes > 0 && (
            <span className="text-xs text-info">
              {t("attendance.page.overtime", { time: formatMinutes(d.overtime_minutes, lang) })}
              {d.overtime_status === "pending" ? t("attendance.page.toReview") : ""}
            </span>
          )}
        </div>
      ),
      sortValue: (d) => d.worked_minutes,
    },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={DAY_STATUS[d.status].tone}>{t(`attendance.status.day.${d.status}`)}</Badge>
          {d.exceptions
            .filter((code) => code !== "absent")
            .map((code) => (
              <Badge key={code} variant={EXCEPTIONS[code].tone}>
                {t(`attendance.status.exception.${code}`)}
                {code === "late" && d.late_minutes ? ` ${t("common.time.minutes", { n: d.late_minutes })}` : ""}
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
      label: t("common.field.status"),
      options: (Object.keys(DAY_STATUS) as AttendanceDayStatus[]).map((s) => ({ value: s, label: t(`attendance.status.day.${s}`) })),
      getValue: (d) => d.status,
    },
    {
      type: "select",
      id: "exception",
      label: t("attendance.page.problem"),
      options: (Object.keys(EXCEPTIONS) as AttendanceException[]).map((e) => ({ value: e, label: t(`attendance.status.exception.${e}`) })),
      getValue: (d) => d.exceptions[0],
      // A day can have several problems; it matches if it has the chosen one.
      matches: (d, selected) => d.exceptions.includes(selected as AttendanceException),
    },
    ...(canManage
      ? [
          {
            type: "select" as const,
            id: "employee",
            label: t("common.field.employee"),
            options: employeeOptions,
            getValue: (d: AttendanceDay) => String(d.employee?.id ?? ""),
          },
        ]
      : []),
    { type: "date-range", id: "date", label: t("common.field.date"), getValue: (d) => d.date },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Clock; visible: boolean; count?: number }[] = [
    { id: "records", label: t("attendance.page.tabs.records"), icon: ListChecks, visible: true },
    { id: "overtime", label: t("attendance.page.tabs.overtime"), icon: Hourglass, visible: canManage, count: pendingOvertime },
    // Everyone: employees request their own corrections here, managers review them.
    { id: "corrections", label: t("attendance.page.tabs.corrections"), icon: FileClock, visible: true, count: canManage ? pendingCorrections : 0 },
    // Reviewing a period, exporting it, and closing a finished month.
    { id: "report", label: t("attendance.page.tabs.report"), icon: Table2, visible: true },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("attendance.page.title")}
          action={
            <div className="flex flex-wrap gap-2">
              {/* Export has its own dialog (date range, employee), so only Import comes from here. */}
              {canManage && (
                <Button variant="outline" onClick={() => setMissedOpen(true)}>
                  <ScanLine className="size-4" />
                  {t("attendance.page.missedScans")}
                  {missedCount > 0 && (
                    <span className="rounded-full bg-warning/15 px-1.5 text-xs font-semibold tabular-nums text-warning">{missedCount}</span>
                  )}
                </Button>
              )}
              <ExcelActions importSpec={canManage ? attendanceImport : undefined} onImported={load} />
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <FileDown className="size-4" />
                {t("common.action.export")}
              </Button>
              {/* The page's main action: solid, and last, where the eye lands. */}
              {canManage && (
                <Button onClick={() => setAddOpen(true)}>
                  <CalendarPlus className="size-4" />
                  {t("attendance.page.addAttendance")}
                </Button>
              )}
            </div>
          }
        />

        {myIncomplete.length > 0 && (
          <Alert
            variant="warning"
            title={myIncomplete.length === 1 ? t("attendance.page.missingOne") : t("attendance.page.missingOther", { n: myIncomplete.length })}
            action={
              <button type="button" onClick={() => switchTab("corrections")} className="text-sm font-medium underline">
                {t("attendance.page.requestCorrection")}
              </button>
            }
          >
            {t("attendance.page.missingHint", { dates: myIncomplete.map((d) => d.date).join(", ") })}
          </Alert>
        )}

        {me?.employee ? (
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            <AttendanceTodayCard onScanned={load} />
            <Card>
              <CardHeader>
                <CardTitle>{t("attendance.page.shortcutTitle")}</CardTitle>
                <CardDescription>{t("attendance.page.shortcutHint")}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("attendance.page.noEmployee")}</p>
        )}

        {/* Scrolls sideways on a narrow phone instead of widening the page. */}
        <div className="inline-flex max-w-full self-start overflow-x-auto rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
          {tabs
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => switchTab(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === item.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.count ? (
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab === item.id ? "bg-primary-foreground/20" : "bg-info/15 text-info")}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
        </div>

        {tab === "records" && (
          <>
            <MonthBar month={month} onChange={setMonth} />

            {truncated && result && (
              <Alert variant="warning">
                {t("attendance.page.truncated", { total: result.total.toLocaleString(), shown: result.data.length.toLocaleString() })}
              </Alert>
            )}

            <DataTable
              key={linkedDate ?? "all"}
              initialFilters={linkedDate ? { "date.from": linkedDate, "date.to": linkedDate } : undefined}
              data={days}
              getRowId={(d) => d.id}
              columns={columns}
              filters={filters}
              searchPlaceholder={t("attendance.page.searchPlaceholder")}
              emptyState={{
                icon: Clock,
                title: t("attendance.page.emptyTitle"),
                description: t("attendance.page.emptyHint"),
              }}
              bulkActions={
                canManage
                  ? (selected, clearSelection) => (
                      <>
                        <Button size="sm" onClick={() => setFilling({ days: selected, clear: clearSelection })}>
                          <CalendarCheck className="size-3.5" />
                          {t("attendance.page.fillMissed")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteDays(selected, clearSelection)}>
                          <Trash2 className="size-3.5" />
                          {t("attendance.page.deleteCount", { n: selected.length })}
                        </Button>
                      </>
                    )
                  : undefined
              }
              rowActions={(d) => (
                <Button variant="outline" size="sm" onClick={() => setPreview(d)}>
                  <Eye className="size-3.5" />
                  {t("attendance.page.details")}
                </Button>
              )}
            />
          </>
        )}

        {tab === "overtime" && canManage && <OvertimeReview month={month} onMonthChange={setMonth} onChanged={load} />}

        {tab === "corrections" && <AttendanceCorrections key={linkedStatus ?? "all"} month={month} onMonthChange={setMonth} onChanged={load} initialStatus={linkedStatus} />}

        {tab === "report" && (
          <AttendanceReport
            canManage={canManage}
            month={month}
            onMonthChange={setMonth}
            onExport={(reportMonth) => {
              setMonth(reportMonth);
              setExportOpen(true);
            }}
            onResolve={(target, reportMonth) => {
              setMonth(reportMonth);
              if (target === "missed") setMissedOpen(true);
              else switchTab(target === "absences" ? "records" : target);
            }}
          />
        )}
      </div>

      <AttendanceExportDialog open={exportOpen} onOpenChange={setExportOpen} month={month} canPickEmployee={canManage} />
      {/* Keyed by month, so opening it for another month (e.g. from the report's close-month checklist) starts on that month. */}
      {canManage && <MissedScansDialog key={month} open={missedOpen} onOpenChange={setMissedOpen} initialMonth={month} onChanged={load} />}
      {canManage && (
        <AttendanceAddDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSaved={(day) => {
            setAddOpen(false);
            setPreview(day);
            load();
          }}
          onOpenDay={(day) => {
            setAddOpen(false);
            setPreview(day);
          }}
        />
      )}
      <AttendanceFillMissedDialog
        days={filling?.days ?? null}
        onOpenChange={(open) => !open && setFilling(null)}
        onDone={() => {
          filling?.clear();
          load();
        }}
      />
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
