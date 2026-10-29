"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileDown, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysWith, ISSUES, type IssueKind, type PersonInsight, type ReportDay } from "@/lib/attendance-insights";
import { useMe } from "@/contexts/me-context";
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";
import { printAttendancePdf } from "@/lib/pdf/attendance";
import { exportLateDetail } from "@/lib/excel/specs/time";
import { formatMinutes } from "@/lib/schedule";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type SortKey = "lateDays" | "lateMinutes" | "latePct" | "bradford" | "name";

// Labels in attendance.lateDetail.sort.<key>.
const SORTS: SortKey[] = ["lateDays", "lateMinutes", "latePct", "bradford", "name"];

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** "Wed 04 Jun" — one line, with the weekday. */
const shortDate = (date: string, lang: Lang) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

const monthName = (month: string, lang: Lang) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric", timeZone: "UTC" });

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
  periodTitle = periodLabel,
  scope,
  onOpenDay,
}: {
  people: PersonInsight[];
  minLate: number;
  onMinLate: (minutes: number) => void;
  range: { from: string; to: string };
  /** The period in English, for the PDF's header. */
  periodLabel: string;
  /** The period in the chosen language, for the heading on screen (defaults to `periodLabel`). */
  periodTitle?: string;
  /** Who the report covers, e.g. "All employees · Branch: HQ" — printed in the PDF's header. */
  scope: string;
  /** Opens the day's details; only offered when the person's id is known. */
  onOpenDay?: (person: PersonInsight, date: string) => void;
}) {
  const t = useT();
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

  const filterText = [
    kinds.map((k) => t(ISSUES.find((i) => i.kind === k)!.key)).join(", "),
    kinds.includes("late") ? t("attendance.lateDetail.heading.lateFilter", { n: minLate }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function handleExport() {
    try {
      const filename = await exportLateDetail(
        ranked.map((entry) => entry.person),
        { kinds, minLate, ...range },
      );
      notifySuccess(t("common.excel.downloaded"), filename);
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
        <span className="text-sm font-medium">{t("attendance.lateDetail.toolbar.show")}</span>
        {ISSUES.map((issue) => (
          <label key={issue.kind} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={kinds.includes(issue.kind)} onChange={() => toggleKind(issue.kind)} className="size-4 rounded border-input" />
            {t(issue.key)}
          </label>
        ))}
        <label className="flex items-center gap-1.5 text-sm">
          {t("attendance.lateDetail.toolbar.lateFrom")}
          <Input
            type="number"
            min={1}
            max={600}
            value={minLate}
            onChange={(e) => onMinLate(Math.max(1, Number(e.target.value) || 1))}
            className="h-8 w-16"
            aria-label={t("attendance.lateDetail.toolbar.lateFromAria")}
          />
          {t("attendance.lateDetail.toolbar.min")}
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          {t("attendance.lateDetail.toolbar.sortBy")}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={SELECT_CLASS}>
            {SORTS.map((key) => (
              <option key={key} value={key}>
                {t(`attendance.lateDetail.sort.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={ranked.length === 0}>
            <FileDown className="size-4" />
            {t("attendance.lateDetail.toolbar.excel")}
          </Button>
          <Button variant="outline" onClick={pdf} disabled={ranked.length === 0}>
            <FileText className="size-4" />
            {t("attendance.lateDetail.toolbar.pdf")}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold">{t("attendance.lateDetail.heading.title", { period: periodTitle })}</h3>
        <p className="text-xs text-muted-foreground">
          {filterText || t("attendance.lateDetail.heading.nothingSelected")} ·{" "}
          {t(ranked.length === 1 ? "attendance.lateDetail.heading.personOne" : "attendance.lateDetail.heading.personMany", { n: ranked.length })}
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {kinds.length === 0 ? t("attendance.lateDetail.heading.pickOne") : t("attendance.lateDetail.heading.clean")}
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
  const t = useT();
  const lang = useLang();
  const duration = (minutes: number) => formatMinutes(minutes, lang);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={th}>{t("common.field.employee")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.workDays")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.lateDays")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.latePct")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.totalLate")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.avg")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.longest")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.early")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.missed")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.absent")}</th>
            <th className={cn(th, "text-right")}>{t("attendance.lateDetail.overview.absencePct")}</th>
            <th className={cn(th, "text-right")} title={t("attendance.lateDetail.overview.bradfordHint")}>
              {t("attendance.lateDetail.overview.bradford")}
            </th>
            <th className={th}>{t("attendance.lateDetail.overview.pattern")}</th>
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
                {p.lateWeekday
                  ? t("attendance.lateDetail.overview.mostly", {
                      day: t(`attendance.lateDetail.weekday.${WEEKDAY_KEYS[p.lateWeekday.weekday]}`),
                      n: p.lateWeekday.count,
                    })
                  : ""}
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

  const t = useT();
  const lang = useLang();
  const duration = (minutes: number) => formatMinutes(minutes, lang);

  const countedLate = (list: ReportDay[]) => list.filter((d) => d.late >= minLate);
  const stats = [
    t("attendance.lateDetail.person.workDays", { n: person.workDays }),
    person.lateDays
      ? t("attendance.lateDetail.person.late", {
          n: person.lateDays,
          pct: person.latePct,
          total: duration(person.lateMinutes),
          avg: duration(Math.round(person.lateMinutes / person.lateDays)),
        })
      : t("attendance.lateDetail.person.neverLate"),
    person.missedDays
      ? t(person.missedDays === 1 ? "attendance.lateDetail.person.missedOne" : "attendance.lateDetail.person.missedMany", { n: person.missedDays })
      : null,
    person.absentDays ? t("attendance.lateDetail.person.absent", { n: person.absentDays }) : null,
    person.leaveDays ? t("attendance.lateDetail.person.leave", { n: person.leaveDays }) : null,
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
              <th className={cn(th, "pl-4")}>{t("common.field.date")}</th>
              <th className={th}>{t("attendance.lateDetail.day.schedule")}</th>
              <th className={th}>{t("attendance.lateDetail.day.in")}</th>
              <th className={th}>{t("attendance.lateDetail.day.out")}</th>
              <th className={th}>{t("attendance.lateDetail.day.late")}</th>
              <th className={th}>{t("attendance.lateDetail.day.issue")}</th>
              <th className={cn(th, "w-full")}>{t("attendance.lateDetail.day.note")}</th>
            </tr>
          </thead>
          {months.map(([month, list]) => {
            const late = countedLate(list);
            return (
              <tbody key={month}>
                <tr>
                  <td colSpan={7} className="bg-muted/50 px-4 py-1 text-xs font-semibold">
                    {monthName(month, lang)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {[
                        late.length
                          ? t("attendance.lateDetail.day.monthLate", { n: late.length, time: duration(late.reduce((n, d) => n + d.late, 0)) })
                          : null,
                        list.filter((d) => d.issues.includes("missed")).length && kinds.includes("missed")
                          ? t("attendance.lateDetail.day.monthMissed", { n: list.filter((d) => d.issues.includes("missed")).length })
                          : null,
                        list.filter((d) => d.issues.includes("absent")).length && kinds.includes("absent")
                          ? t("attendance.lateDetail.day.monthAbsent", { n: list.filter((d) => d.issues.includes("absent")).length })
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
                    <td className="whitespace-nowrap border-b border-border/60 py-1.5 pl-4 pr-2 font-medium">{shortDate(day.date, lang)}</td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 tabular-nums text-muted-foreground">
                      {day.expectedIn ? `${day.expectedIn}–${day.expectedOut ?? ""}` : dash}
                    </td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 tabular-nums">{day.in ?? dash}</td>
                    <td className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 tabular-nums">
                      {day.out ?? dash}
                      {day.edited && <Pencil className="ml-1 inline size-3 text-muted-foreground" aria-label={t("attendance.lateDetail.day.edited")} />}
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
                              {k === "early" ? t("attendance.lateDetail.day.early", { time: duration(day.early) }) : t(ISSUES.find((i) => i.kind === k)!.key)}
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
