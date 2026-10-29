"use client";

import { useMemo, useState } from "react";
import { Coffee, Flag, Palmtree, UserX, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { useApi } from "@/hooks/use-api";
import { api, CalendarEvent, CalendarEventType, CalendarEvents, Employee } from "@/lib/api";
import { dateLocale, translate, useLang, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Full class strings so Tailwind can see them. Colours match the month grid.
// Labels: t(`calendar.agenda.type.${type}`).
const EVENT_TYPES: Record<CalendarEventType, { icon: LucideIcon; tint: string; bar: string }> = {
  holiday: { icon: Flag, tint: "bg-destructive/10 text-destructive", bar: "bg-destructive/60" },
  leave: { icon: Palmtree, tint: "bg-violet-500/10 text-violet-700 dark:text-violet-300", bar: "bg-violet-500/60" },
  day_off: { icon: Coffee, tint: "bg-warning/15 text-warning", bar: "bg-warning/70" },
  absent: { icon: UserX, tint: "bg-muted text-foreground", bar: "bg-foreground/50" },
};
const ALL_TYPES = Object.keys(EVENT_TYPES) as CalendarEventType[];

// Labels: t(`calendar.agenda.range.${range}`).
const RANGES = ["upcoming", "month", "year", "last_year"] as const;
type Range = (typeof RANGES)[number];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function rangeDates(range: Range): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  switch (range) {
    case "upcoming":
      return [iso(now), iso(new Date(y, now.getMonth() + 3, now.getDate()))];
    case "month":
      return [iso(new Date(y, now.getMonth(), 1)), iso(new Date(y, now.getMonth() + 1, 0))];
    case "year":
      return [`${y}-01-01`, `${y}-12-31`];
    case "last_year":
      return [`${y - 1}-01-01`, `${y - 1}-12-31`];
  }
}

// The same thing for several people on the same dates — a day off given to a whole team — is one row.
type Row = Omit<CalendarEvent, "employee"> & { people: string[] };

function mergeRows(events: CalendarEvent[]): Row[] {
  const rows = new Map<string, Row>();
  for (const { employee, ...event } of events) {
    const key = [event.type, event.start, event.end, event.label, event.part, event.status].join("|");
    const row = rows.get(key) ?? { ...event, people: [] };
    if (employee) row.people.push(employee.name);
    rows.set(key, row);
  }
  return [...rows.values()];
}

function dateRange(start: string, end: string, lang: Lang): { main: string; sub: string } {
  const a = parseDate(start);
  const b = parseDate(end);
  const day = (d: Date) => d.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" });
  const weekday = (d: Date) => d.toLocaleDateString(dateLocale(lang), { weekday: "short" });
  if (start === end) return { main: day(a), sub: weekday(a) };
  return { main: `${day(a)} – ${day(b)}`, sub: `${weekday(a)} – ${weekday(b)}` };
}

function duration(row: Row, lang: Lang): string {
  if (row.part && row.part !== "full") return translate(lang, row.part === "am" ? "calendar.agenda.morning" : "calendar.agenda.afternoon");
  return translate(lang, row.days === 1 ? "calendar.agenda.dayOne" : "calendar.agenda.dayOther", { n: row.days });
}

/**
 * Only the days something happens — holidays, days off, leave, absences —
 * as one list over a whole range, so nobody has to page month by month.
 */
export function CalendarAgenda({ canManage, employees }: { canManage: boolean; employees: Employee[] }) {
  const t = useT();
  const lang = useLang();
  const [range, setRange] = useState<Range>("year");
  // "" = everyone for a manager, yourself for anyone else.
  const [employeeId, setEmployeeId] = useState("");
  const [types, setTypes] = useState<CalendarEventType[]>(ALL_TYPES);

  const [from, to] = rangeDates(range);

  const { data, error, loading } = useApi<CalendarEvents>(
    () => api.calendar.events(from, to, employeeId ? Number(employeeId) : undefined),
    [from, to, employeeId],
    { errorMessage: t("calendar.agenda.loadFailed") },
  );
  const showPeople = canManage && !employeeId;

  // Filtering by type happens here, not on the server: switching chips is instant
  // and the totals for the hidden types stay visible on the chips.
  const totals = useMemo(() => {
    const sums = Object.fromEntries(ALL_TYPES.map((type) => [type, 0])) as Record<CalendarEventType, number>;
    data?.events.forEach((e) => (sums[e.type] += e.type === "holiday" ? 1 : e.days));
    return sums;
  }, [data]);

  const months = useMemo(() => {
    const rows = mergeRows((data?.events ?? []).filter((e) => types.includes(e.type)));
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const month = row.start.slice(0, 7);
      groups.set(month, [...(groups.get(month) ?? []), row]);
    }
    return [...groups.entries()];
  }, [data, types]);

  const toggle = (type: CalendarEventType) =>
    setTypes((current) => (current.includes(type) ? current.filter((other) => other !== type) : [...current, type]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          aria-label={t("calendar.agenda.rangeLabel")}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
        >
          {RANGES.map((key) => (
            <option key={key} value={key}>
              {t(`calendar.agenda.range.${key}`)}
            </option>
          ))}
        </select>
        {canManage && (
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            aria-label={t("common.field.employee")}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
          >
            <option value="">{t("calendar.agenda.everyone")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        )}
        <span className="text-sm text-muted-foreground">
          {parseDate(from).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" })} –{" "}
          {parseDate(to).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* Totals double as the type filter. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ALL_TYPES.map((type) => {
          const style = EVENT_TYPES[type];
          const on = types.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(type)}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm transition-all",
                on ? "border-border" : "border-dashed opacity-50 hover:opacity-80",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", style.tint)}>
                <style.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t(`calendar.agenda.type.${type}`)}</span>
                <span className="block text-lg font-semibold tabular-nums">{data ? totals[type] : "—"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error && <Alert variant="warning">{error}</Alert>}
      {loading && <Skeleton className="h-96 w-full" />}

      {data && months.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("calendar.agenda.empty")}
        </div>
      )}

      {data &&
        months.map(([month, rows]) => (
          <section key={month} className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <h3 className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold">
              {parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" })}
            </h3>
            <ul className="divide-y">
              {rows.map((row) => {
                const style = EVENT_TYPES[row.type];
                const dates = dateRange(row.start, row.end, lang);
                const past = row.end < data.today;
                const now = row.start <= data.today && row.end >= data.today;
                const pending = row.status === "pending";

                return (
                  <li
                    key={[row.type, row.start, row.end, row.label, row.part, row.status].join("|")}
                    className={cn("relative flex items-center gap-4 px-4 py-3", past && "opacity-60", now && "bg-primary/5")}
                  >
                    <span className={cn("absolute inset-y-2 left-0 w-1 rounded-r", style.bar, pending && "opacity-40")} />
                    <div className="w-32 shrink-0 sm:w-40">
                      <div className="text-sm font-medium tabular-nums">{dates.main}</div>
                      <div className="text-xs text-muted-foreground">{dates.sub}</div>
                    </div>
                    <span className={cn("hidden size-8 shrink-0 items-center justify-center rounded-md sm:flex", style.tint)}>
                      <style.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{row.label}</span>
                        {pending && <Badge variant="outline">{t("calendar.agenda.pending")}</Badge>}
                        {now && <Badge variant="info">{t("common.time.today")}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.type === "holiday" ? t("calendar.agenda.companyHoliday") : duration(row, lang)}</div>
                    </div>
                    {showPeople && (
                      <div className="max-w-[40%] text-right text-sm" title={row.people.join(", ")}>
                        {row.type === "holiday" ? (
                          <span className="text-muted-foreground">{t("calendar.agenda.everyone")}</span>
                        ) : (
                          <span className="line-clamp-2">
                            {row.people.slice(0, 3).join(", ")}
                            {row.people.length > 3 && <span className="text-muted-foreground">{t("calendar.agenda.more", { n: row.people.length - 3 })}</span>}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
