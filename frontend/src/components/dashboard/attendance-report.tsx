"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, FileDown, ListTree, Search, Table2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceDayDialog } from "@/components/dashboard/attendance-day-dialog";
import { AttendanceLateDetail } from "@/components/dashboard/attendance-late-detail";
import { AttendanceMonthClose, type ResolveTarget } from "@/components/dashboard/attendance-month-close";
import { currentMonth, parseDate, shiftMonth, WEEKDAYS } from "@/components/dashboard/calendar-shared";
import { api, ApiError, type AttendanceDay } from "@/lib/api";
import { buildInsights, duration, totalsOf, type PersonInsight, type ReportTotals } from "@/lib/attendance-insights";
import {
  buildAttendanceCalendar,
  CALENDAR_CODES,
  DAILY_TOTALS,
  readAttendanceReport,
  type AttendanceCalendar,
  type AttendanceReport as Report,
} from "@/lib/excel-specs/time";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

// The same codes as the Calendar sheet, in the app's own colours (light and dark).
const CODE_STYLE: Record<string, { cell: string; dot: string }> = {
  P: { cell: "bg-success/15 text-success", dot: "bg-success" },
  L: { cell: "bg-warning/20 text-warning", dot: "bg-warning" },
  I: { cell: "bg-orange-500/15 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  A: { cell: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  W: { cell: "bg-info/15 text-info", dot: "bg-info" },
  LV: { cell: "bg-violet-500/15 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  H: { cell: "bg-muted text-foreground/70", dot: "bg-muted-foreground" },
  OFF: { cell: "text-muted-foreground", dot: "bg-muted-foreground/40" },
};

// Codes that have a stored day behind them, so clicking opens its details.
const OPENABLE = new Set(["P", "L", "I", "A", "W"]);

// A year, as the server allows.
const MAX_DAYS = 366;

const label = (code: string) => CALENDAR_CODES.find((c) => c.code === code)!.total;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function monthRange(month: string): { from: string; to: string } {
  const first = parseDate(`${month}-01`);
  return { from: iso(first), to: iso(new Date(first.getFullYear(), first.getMonth() + 1, 0)) };
}

const daysBetween = (from: string, to: string) => Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);

/** The same number of days, just before. */
function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const length = daysBetween(range.from, range.to) + 1;
  const to = parseDate(range.from);
  to.setDate(to.getDate() - 1);
  const from = new Date(to);
  from.setDate(from.getDate() - (length - 1));
  return { from: iso(from), to: iso(to) };
}

const fmt = (date: string) => parseDate(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

async function load(range: { from: string; to: string }): Promise<Report> {
  const { blob } = await api.attendance.export({ ...range, with_ids: true });
  return readAttendanceReport(blob);
}

type View = "calendar" | "detail";

/**
 * Attendance to review before exporting. The same report the export
 * downloads, as a month grid (Calendar) or as who was late / absent / missed
 * a scan and when (Detail), with rates and the change from the period before.
 * Clicking a day opens it, so a problem found here can be fixed here.
 */
export function AttendanceReport({
  canManage,
  onExport,
  onResolve,
}: {
  canManage: boolean;
  onExport: (month: string) => void;
  /** Takes the reviewer to where an item on the close-month checklist is fixed, for that month. */
  onResolve?: (target: ResolveTarget, month: string) => void;
}) {
  const [mode, setMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(currentMonth);
  const [custom, setCustom] = useState(() => monthRange(currentMonth()));
  const [view, setView] = useState<View>("calendar");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [minLate, setMinLate] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [openDay, setOpenDay] = useState<AttendanceDay | null>(null);

  const range = mode === "month" ? monthRange(month) : custom;
  const rangeProblem =
    mode === "range" && (!custom.from || !custom.to)
      ? "Choose both dates."
      : daysBetween(range.from, range.to) < 0
        ? "The end date comes before the start date."
        : daysBetween(range.from, range.to) > MAX_DAYS
          ? "Pick a range of one year or less."
          : null;
  const requestKey = `${range.from}|${range.to}|${reloads}`;

  // Kept with the request they answer; a different key means the new period is still loading.
  const [result, setResult] = useState<{ key: string; report: Report | null; error: string | null } | null>(null);
  const [previous, setPrevious] = useState<{ key: string; report: Report } | null>(null);
  const report = result?.key === requestKey ? result.report : null;
  const loading = !rangeProblem && result?.key !== requestKey;

  useEffect(() => {
    if (rangeProblem) return;
    let cancelled = false;
    const [from, to] = requestKey.split("|");

    load({ from, to })
      .then((data) => !cancelled && setResult({ key: requestKey, report: data, error: null }))
      .catch((err) => !cancelled && setResult({ key: requestKey, report: null, error: err instanceof ApiError ? err.message : "The report couldn't be loaded." }));
    // The period before, only for the trend arrows — a failure just leaves them out.
    load(previousRange({ from, to }))
      .then((data) => !cancelled && setPrevious({ key: requestKey, report: data }))
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [requestKey, rangeProblem]);

  const calendar = useMemo(() => (report ? buildAttendanceCalendar(report, range) : null), [report, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const insights = useMemo(() => (report ? buildInsights(report, minLate) : []), [report, minLate]);
  const previousInsights = useMemo(
    () => (previous?.key === requestKey ? buildInsights(previous.report, minLate) : null),
    [previous, requestKey, minLate],
  );

  const branches = useMemo(() => [...new Set(insights.map((p) => p.branch).filter(Boolean))].sort(), [insights]);
  const departments = useMemo(() => [...new Set(insights.map((p) => p.department).filter(Boolean))].sort(), [insights]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (p: PersonInsight) =>
      (!branch || p.branch === branch) &&
      (!department || p.department === department) &&
      (!term || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)) &&
      (!onlyIssues || p.absentDays > 0 || p.missedDays > 0);
  }, [branch, department, search, onlyIssues]);

  const shownInsights = useMemo(() => insights.filter(matches), [insights, matches]);
  const shownKeys = useMemo(() => new Set(shownInsights.map((p) => p.key)), [shownInsights]);
  const byKey = useMemo(() => new Map(insights.map((p) => [p.key, p])), [insights]);
  const totals = totalsOf(shownInsights);
  // The trend compares like with like: the same people (by the same filters) the period before.
  const before = previousInsights ? totalsOf(previousInsights.filter(matches)) : null;

  const scope = [branch && `Branch: ${branch}`, department && `Department: ${department}`, search.trim() && `Search: “${search.trim()}”`, onlyIssues && "Only absences / missed scans"]
    .filter(Boolean)
    .join(" · ") || (canManage ? "All employees" : "My attendance");

  const periodLabel = mode === "month" ? parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : `${fmt(range.from)} – ${fmt(range.to)}`;

  async function open(person: PersonInsight | undefined, date: string) {
    if (!person?.employeeId) return;
    try {
      const res = await api.attendance.list({ employee_id: person.employeeId, from: date, to: date, per_page: 1 });
      if (res.data[0]) setOpenDay(res.data[0]);
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(["month", "range"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("rounded-md px-3 py-1 text-sm font-medium", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "month" ? "Month" : "Date range"}
            </button>
          ))}
        </div>

        {mode === "month" ? (
          <>
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="min-w-40 text-center text-base font-semibold">{periodLabel}</h2>
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setMonth(currentMonth())}>
              Today
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-40" aria-label="From" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-40" aria-label="To" />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="tablist" aria-label="View">
            {(
              [
                { id: "calendar", label: "Calendar", icon: Table2 },
                { id: "detail", label: "Late detail", icon: ListTree },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium",
                  view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <v.icon className="size-4" />
                {v.label}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => onExport(range.from.slice(0, 7))}>
            <FileDown className="size-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" className="w-52 pl-8" />
        </div>
        {branches.length > 1 && (
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={SELECT_CLASS} aria-label="Branch">
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
        {departments.length > 1 && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={SELECT_CLASS} aria-label="Department">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="size-4 rounded border-input" />
          Only absences / missed scans
        </label>
      </div>

      {/* A finished month is closed from here once everything in it has been checked. */}
      {canManage && mode === "month" && month < currentMonth() && (
        <AttendanceMonthClose
          month={month}
          onResolve={onResolve ? (target) => onResolve(target, month) : undefined}
          onChanged={() => setReloads((n) => n + 1)}
        />
      )}

      {rangeProblem && <Alert variant="warning">{rangeProblem}</Alert>}
      {result?.error && !loading && <Alert variant="warning">{result.error}</Alert>}

      {report && !loading && <Tiles totals={totals} before={before} />}

      {loading && <Skeleton className="h-96 w-full" />}

      {report && !loading && view === "calendar" && calendar && (
        <CalendarGrid
          calendar={calendar}
          people={calendar.people.filter((p) => shownKeys.has(p.key))}
          insights={byKey}
          onOpen={(key, date) => open(byKey.get(key), date)}
        />
      )}

      {report && !loading && view === "detail" && (
        <AttendanceLateDetail
          people={shownInsights}
          minLate={minLate}
          onMinLate={setMinLate}
          range={range}
          periodLabel={periodLabel}
          scope={scope}
          onOpenDay={(person, date) => open(person, date)}
        />
      )}

      <AttendanceDayDialog
        day={openDay}
        onOpenChange={(isOpen) => !isOpen && setOpenDay(null)}
        canManage={canManage}
        onAdjusted={(day) => {
          setOpenDay(day);
          setReloads((n) => n + 1);
        }}
      />
    </div>
  );
}

/** The headline numbers, each with how it moved since the period before (up is worse for all but leave). */
function Tiles({ totals, before }: { totals: ReportTotals; before: ReportTotals | null }) {
  const points = (n: number) => `${n} pts`;
  const tiles: { label: string; value: string; now: number; then?: number; change?: (n: number) => string; neutral?: boolean }[] = [
    { label: "Late rate", value: `${totals.latePct}%`, now: totals.latePct, then: before?.latePct, change: points },
    { label: "Absence rate", value: `${totals.absencePct}%`, now: totals.absencePct, then: before?.absencePct, change: points },
    { label: "Late days", value: String(totals.lateDays), now: totals.lateDays, then: before?.lateDays },
    { label: "Time lost to lateness", value: duration(totals.lateMinutes), now: totals.lateMinutes, then: before?.lateMinutes, change: duration },
    { label: "Missed scans", value: String(totals.missedDays), now: totals.missedDays, then: before?.missedDays },
    { label: "Leave days", value: String(totals.leaveDays), now: totals.leaveDays, then: before?.leaveDays, neutral: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => {
        const change = tile.then === undefined ? null : Math.round((tile.now - tile.then) * 10) / 10;
        return (
          <div key={tile.label} className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xl font-semibold tabular-nums leading-none">{tile.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.label}</p>
            {change !== null && (
              <p
                className={cn(
                  "mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                  change === 0 || tile.neutral ? "text-muted-foreground" : change > 0 ? "text-destructive" : "text-success",
                )}
                title="Compared with the same number of days just before"
              >
                {change > 0 ? <ArrowUp className="size-3" /> : change < 0 ? <ArrowDown className="size-3" /> : null}
                {change === 0 ? "No change" : (tile.change ?? String)(Math.abs(change))}
                {change !== 0 && <span className="ml-1 font-normal text-muted-foreground">vs before</span>}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CalendarGrid({
  calendar,
  people,
  insights,
  onOpen,
}: {
  calendar: AttendanceCalendar;
  people: AttendanceCalendar["people"];
  insights: Map<string, PersonInsight>;
  onOpen: (key: string, date: string) => void;
}) {
  const today = iso(new Date());

  // Day totals follow the rows shown.
  const daily = useMemo(() => {
    const counts = Object.fromEntries(DAILY_TOTALS.map((code) => [code, calendar.dates.map(() => 0)]));
    for (const person of people) {
      person.cells.forEach((cell, d) => {
        if (cell && cell.code in counts) counts[cell.code][d]++;
      });
    }
    return counts;
  }, [calendar, people]);

  if (people.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {calendar.people.length === 0 ? "No attendance to show for this period." : "No one matches these filters."}
      </p>
    );
  }

  return (
    <>
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className="sticky left-0 z-20 min-w-28 border-b border-r border-border bg-muted px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:min-w-44 sm:px-3">
                Employee
              </th>
              {calendar.dates.map((date) => {
                const d = parseDate(date);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={date} className={cn("border-b border-border bg-muted px-0.5 py-1.5 text-center font-normal", date === today && "bg-primary/10")}>
                    <div className={cn("text-[10px] uppercase text-muted-foreground", weekend && "text-foreground/70")}>{WEEKDAYS[d.getDay()].slice(0, 2)}</div>
                    <div className={cn("text-sm font-semibold", date === today && "text-primary")}>{d.getDate()}</div>
                  </th>
                );
              })}
              {CALENDAR_CODES.map((c, i) => (
                <th
                  key={c.code}
                  title={c.legend}
                  className={cn("border-b border-border bg-muted px-2 text-center text-[10px] font-semibold uppercase text-muted-foreground", i === 0 && "border-l")}
                >
                  {c.total}
                </th>
              ))}
              <th className="border-b border-l border-border bg-muted px-2 text-center text-[10px] font-semibold uppercase text-muted-foreground" title="Late days ÷ days attended">
                Late %
              </th>
            </tr>
          </thead>

          <tbody>
            {people.map((person) => {
              const insight = insights.get(person.key);
              return (
                <tr key={person.key} className="group">
                  <td title={person.name} className="sticky left-0 z-10 border-b border-r border-border bg-card px-2 py-1.5 group-hover:bg-accent/40 sm:px-3">
                    <div className="max-w-24 truncate text-sm font-medium sm:max-w-56">{person.name}</div>
                    <div className="max-w-24 truncate text-[11px] text-muted-foreground sm:max-w-56">{[person.code, person.branch].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  {person.cells.map((cell, d) => {
                    const date = calendar.dates[d];
                    const tip = cell ? `${person.name} · ${date}\n${cell.note}` : undefined;
                    const openable = cell && OPENABLE.has(cell.code) && insight?.employeeId;
                    const chip = cell && (
                      <span className={cn("mx-auto flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[11px] font-semibold", CODE_STYLE[cell.code].cell)}>{cell.code}</span>
                    );
                    return (
                      <td key={date} className={cn("border-b border-border p-0.5 text-center group-hover:bg-accent/40", date === today && "bg-primary/5")}>
                        {openable ? (
                          <button type="button" title={tip} aria-label={tip} onClick={() => onOpen(person.key, date)} className="block w-full rounded-md transition-transform hover:scale-110">
                            {chip}
                          </button>
                        ) : (
                          cell && (
                            <span title={tip} aria-label={tip}>
                              {chip}
                            </span>
                          )
                        )}
                      </td>
                    );
                  })}
                  {CALENDAR_CODES.map((c, i) => (
                    <td key={c.code} className={cn("border-b border-border px-2 text-center tabular-nums group-hover:bg-accent/40", i === 0 && "border-l font-medium")}>
                      {person.totals[c.code] || <span className="text-muted-foreground">·</span>}
                    </td>
                  ))}
                  <td className="border-b border-l border-border px-2 text-center tabular-nums group-hover:bg-accent/40">
                    {insight?.lateDays ? `${insight.latePct}%` : <span className="text-muted-foreground">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            {DAILY_TOTALS.map((code) => (
              <tr key={code}>
                <th className="sticky left-0 z-10 border-b border-r border-border bg-muted px-2 py-1 text-left text-[11px] font-semibold sm:px-3">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", CODE_STYLE[code].dot)} />
                    {label(code)}
                  </span>
                </th>
                {daily[code].map((count, d) => (
                  <td key={calendar.dates[d]} className="border-b border-border bg-muted/50 px-0.5 py-1 text-center tabular-nums">
                    {count || <span className="text-muted-foreground">·</span>}
                  </td>
                ))}
                <td colSpan={CALENDAR_CODES.length + 1} className="border-b border-l border-border bg-muted/50" />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground">
        {CALENDAR_CODES.map((c) => (
          <span key={c.code} className="flex items-center gap-1.5">
            <span className={cn("flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-semibold", CODE_STYLE[c.code].cell)}>{c.code}</span>
            {c.legend}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          Click a day to open it; hover for its scans. A blank day is still to come, or has no schedule.
        </span>
      </div>
    </>
  );
}
