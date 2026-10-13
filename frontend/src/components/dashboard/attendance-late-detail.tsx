"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileDown, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysWith, duration, ISSUES, type IssueKind, type PersonInsight, type ReportDay } from "@/lib/attendance-insights";
import { useMe } from "@/contexts/me-context";
import { printAttendancePdf } from "@/lib/attendance-pdf";
import { exportLateDetail } from "@/lib/excel-specs/time";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SortKey = "lateDays" | "lateMinutes" | "latePct" | "bradford" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "lateDays", label: "Late days" },
  { key: "lateMinutes", label: "Total late" },
  { key: "latePct", label: "Late %" },
  { key: "bradford", label: "Bradford score" },
  { key: "name", label: "Name" },
];

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** "Wed 04 Jun" — one line, with the weekday. */
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

/** Lateness gets darker as it gets worse; the shade differs too, so it still reads printed in black and white. */
function lateChip(minutes: number): string {
  if (minutes > 60) return "bg-destructive/15 text-destructive font-semibold";
  if (minutes >= 15) return "bg-warning/25 text-warning font-semibold";
  return "bg-warning/10 text-warning";
}

const ISSUE_BADGE: Record<Exclude<IssueKind, "late">, string> = {
  early: "bg-info/15 text-info",
  missed: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  absent: "bg-destructive/15 text-destructive",
};

const dash = <span className="text-muted-foreground">—</span>;

/**
 * Who was late (or left early, missed a scan, was absent) and when: an
 * overview table ranked worst first, then a section per person with each
 * day, grouped by month. Prints cleanly and exports to Excel.
 */
export function AttendanceLateDetail({
  people,
  minLate,
  onMinLate,
  range,
  periodLabel,
  scope,
  onOpenDay,
}: {
  people: PersonInsight[];
  minLate: number;
  onMinLate: (minutes: number) => void;
  range: { from: string; to: string };
  periodLabel: string;
  /** Who the report covers, e.g. "All employees · Branch: HQ" — printed in the PDF's header. */
  scope: string;
  /** Opens the day's details; only offered when the person's id is known. */
  onOpenDay?: (person: PersonInsight, date: string) => void;
}) {
  const [kinds, setKinds] = useState<IssueKind[]>(["late"]);
  const [sort, setSort] = useState<SortKey>("lateDays");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const ranked = useMemo(() => {
    const withDays = people
      .map((person) => ({ person, days: daysWith(person, kinds, minLate) }))
      .filter((entry) => entry.days.length > 0);
    return withDays.sort((a, b) =>
      sort === "name" ? a.person.name.localeCompare(b.person.name) : b.person[sort] - a.person[sort] || a.person.name.localeCompare(b.person.name),
    );
  }, [people, kinds, minLate, sort]);

  const toggleKind = (kind: IssueKind) =>
    setKinds((current) => (current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]));

  const toggleSection = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const filterText = [kinds.map((k) => ISSUES.find((i) => i.kind === k)!.label).join(", "), kinds.includes("late") ? `late ≥ ${minLate} min` : null]
    .filter(Boolean)
    .join(" · ");

  async function handleExport() {
    try {
      const filename = await exportLateDetail(
        ranked.map((entry) => entry.person),
        { kinds, minLate, ...range },
      );
      notifySuccess("Excel file downloaded", filename);
    } catch (err) {
      notifyError(err);
    }
  }

  const { me } = useMe();

  // The same PDF report the Export dialog makes, limited to the people and issues shown here.
  async function pdf() {
    try {
      await printAttendancePdf({
        company: me?.company?.name ?? "Business OS",
        generatedBy: me?.user.name,
        periodLabel,
        range,
        scope,
        people: ranked.map((entry) => entry.person),
        detail: { kinds, minLate },
        minLate,
      });
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <span className="text-sm font-medium">Show</span>
        {ISSUES.map((issue) => (
          <label key={issue.kind} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={kinds.includes(issue.kind)} onChange={() => toggleKind(issue.kind)} className="size-4 rounded border-input" />
            {issue.label}
          </label>
        ))}
        <label className="flex items-center gap-1.5 text-sm">
          Late ≥
          <Input
            type="number"
            min={1}
            max={600}
            value={minLate}
            onChange={(e) => onMinLate(Math.max(1, Number(e.target.value) || 1))}
            className="h-8 w-16"
            aria-label="Count lateness from this many minutes"
          />
          min
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={SELECT_CLASS}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={ranked.length === 0}>
            <FileDown className="size-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={pdf} disabled={ranked.length === 0}>
            <FileText className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold">Attendance detail · {periodLabel}</h3>
        <p className="text-xs text-muted-foreground">
          {filterText || "Nothing selected"} · {ranked.length} {ranked.length === 1 ? "person" : "people"}
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {kinds.length === 0 ? "Pick at least one thing to show." : "No one matches — a clean record for this period."}
        </p>
      ) : (
        <>
          <Overview entries={ranked} />
          {ranked.map(({ person, days }) => (
            <PersonSection
              key={person.key}
              person={person}
              days={days}
              kinds={kinds}
              minLate={minLate}
              collapsed={collapsed.has(person.key)}
              onToggle={() => toggleSection(person.key)}
              onOpenDay={onOpenDay && person.employeeId ? (date) => onOpenDay(person, date) : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}

function Overview({ entries }: { entries: { person: PersonInsight; days: ReportDay[] }[] }) {
  const th = "border-b border-border bg-muted px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const td = "border-b border-border px-2 py-1.5 tabular-nums";
  const num = (n: number) => (n ? n : <span className="text-muted-foreground">·</span>);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={th}>Employee</th>
            <th className={cn(th, "text-right")}>Work days</th>
            <th className={cn(th, "text-right")}>Late days</th>
            <th className={cn(th, "text-right")}>Late %</th>
            <th className={cn(th, "text-right")}>Total late</th>
            <th className={cn(th, "text-right")}>Avg</th>
            <th className={cn(th, "text-right")}>Longest</th>
            <th className={cn(th, "text-right")}>Early</th>
            <th className={cn(th, "text-right")}>Missed</th>
            <th className={cn(th, "text-right")}>Absent</th>
            <th className={cn(th, "text-right")}>Absence %</th>
            <th className={cn(th, "text-right")} title="Separate absence spells² × days absent. Many short absences score higher than one long one — worth a conversation, not a verdict.">
              Bradford
            </th>
            <th className={th}>Pattern</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ person: p }) => (
            <tr key={p.key} className="hover:bg-accent/40">
              <td className={td}>
                <button
                  type="button"
                  onClick={() => document.getElementById(`detail-${p.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="text-left font-medium hover:underline"
                >
                  {p.name}
                </button>
                <div className="text-[11px] text-muted-foreground">{[p.code, p.branch].filter(Boolean).join(" · ") || "—"}</div>
              </td>
              <td className={cn(td, "text-right")}>{p.workDays}</td>
              <td className={cn(td, "text-right font-medium")}>{num(p.lateDays)}</td>
              <td className={cn(td, "text-right")}>{p.lateDays ? `${p.latePct}%` : num(0)}</td>
              <td className={cn(td, "text-right")}>{p.lateMinutes ? duration(p.lateMinutes) : num(0)}</td>
              <td className={cn(td, "text-right")}>{p.lateDays ? duration(Math.round(p.lateMinutes / p.lateDays)) : num(0)}</td>
              <td className={cn(td, "text-right")}>{p.longestLate ? duration(p.longestLate) : num(0)}</td>
              <td className={cn(td, "text-right")}>{num(p.earlyDays)}</td>
              <td className={cn(td, "text-right")}>{num(p.missedDays)}</td>
              <td className={cn(td, "text-right")}>{num(p.absentDays)}</td>
              <td className={cn(td, "text-right")}>{p.absentDays ? `${p.absencePct}%` : num(0)}</td>
              <td className={cn(td, "text-right")}>
                {p.bradford ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{p.bradford}</span> : num(0)}
              </td>
              <td className={cn(td, "text-xs text-muted-foreground")}>
                {p.lateWeekday ? `Mostly ${WEEKDAY_NAMES[p.lateWeekday.weekday]} (${p.lateWeekday.count}×)` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonSection({
  person,
  days,
  kinds,
  minLate,
  collapsed,
  onToggle,
  onOpenDay,
}: {
  person: PersonInsight;
  days: ReportDay[];
  kinds: IssueKind[];
  minLate: number;
  collapsed: boolean;
  onToggle: () => void;
  onOpenDay?: (date: string) => void;
}) {
  const months = useMemo(() => {
    const groups = new Map<string, ReportDay[]>();
    for (const day of days) {
      const month = day.date.slice(0, 7);
      groups.set(month, [...(groups.get(month) ?? []), day]);
    }
    return [...groups];
  }, [days]);

  const countedLate = (list: ReportDay[]) => list.filter((d) => d.late >= minLate);
  const stats = [
    `${person.workDays} work days`,
    person.lateDays ? `late ${person.lateDays} (${person.latePct}%) · ${duration(person.lateMinutes)} · avg ${duration(Math.round(person.lateMinutes / person.lateDays))}` : "never late",
    person.missedDays ? `${person.missedDays} missed ${person.missedDays === 1 ? "scan" : "scans"}` : null,
    person.absentDays ? `${person.absentDays} absent` : null,
    person.leaveDays ? `${person.leaveDays} leave` : null,
  ].filter(Boolean);

  const th = "border-b border-border px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <section id={`detail-${person.key}`} className="scroll-mt-4 rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight className="size-4 self-center" /> : <ChevronDown className="size-4 self-center" />}
        <span className="text-base font-semibold text-primary">
          {person.name}
          {person.code && <span className="font-normal text-muted-foreground"> · {person.code}</span>}
        </span>
        {person.branch && <span className="text-xs text-muted-foreground">{person.branch}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{stats.join(" · ")}</span>
      </button>

      {!collapsed && (
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={cn(th, "pl-4")}>Date</th>
              <th className={th}>Schedule</th>
              <th className={th}>In</th>
              <th className={th}>Out</th>
              <th className={th}>Late</th>
              <th className={th}>Issue</th>
              <th className={cn(th, "w-full")}>Note</th>
            </tr>
          </thead>
          {months.map(([month, list]) => {
            const late = countedLate(list);
            return (
              <tbody key={month}>
                <tr>
                  <td colSpan={7} className="bg-muted/50 px-4 py-1 text-xs font-semibold">
                    {monthName(month)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {[
                        late.length ? `${late.length} late · ${duration(late.reduce((n, d) => n + d.late, 0))}` : null,
                        list.filter((d) => d.issues.includes("missed")).length && kinds.includes("missed")
                          ? `${list.filter((d) => d.issues.includes("missed")).length} missed`
                          : null,
                        list.filter((d) => d.issues.includes("absent")).length && kinds.includes("absent")
                          ? `${list.filter((d) => d.issues.includes("absent")).length} absent`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                </tr>
                {list.map((day) => (
                  <tr
                    key={day.date}
                    onClick={onOpenDay ? () => onOpenDay(day.date) : undefined}
                    className={cn(onOpenDay && "cursor-pointer hover:bg-accent/40")}
                  >
                    <td className="whitespace-nowrap border-b border-border/60 py-1.5 pl-4 pr-2 font-medium">{shortDate(day.date)}</td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 tabular-nums text-muted-foreground">
                      {day.expectedIn ? `${day.expectedIn}–${day.expectedOut ?? ""}` : dash}
                    </td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 tabular-nums">{day.in ?? dash}</td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 tabular-nums">
                      {day.out ?? dash}
                      {day.edited && <Pencil className="ml-1 inline size-3 text-muted-foreground" aria-label="A scan was added or changed" />}
                    </td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5">
                      {day.late > 0 ? (
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs tabular-nums", lateChip(day.late))}>
                          {duration(day.late)}
                        </span>
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5">
                      <span className="flex gap-1">
                        {day.issues
                          .filter((k): k is Exclude<IssueKind, "late"> => k !== "late" && kinds.includes(k))
                          .map((k) => (
                            <span key={k} className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", ISSUE_BADGE[k])}>
                              {k === "early" ? `Early ${duration(day.early)}` : ISSUES.find((i) => i.kind === k)!.label}
                            </span>
                          ))}
                      </span>
                    </td>
                    <td className="border-b border-border/60 px-2 py-1.5 text-xs text-muted-foreground">{day.note || day.leave}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      )}
    </section>
  );
}
