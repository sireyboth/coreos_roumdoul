"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ATTENDANCE,
  currentMonth,
  DayDialog,
  parseDate,
  shiftMonth,
  TYPE_STYLES,
  HalfDayShade,
  halfDayLabel,
  halfDayLeave,
  WEEKDAY_KEYS,
} from "@/components/dashboard/calendar-shared";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { useApi } from "@/hooks/use-api";
import { api, Branch, CalendarAttendance, CalendarDay, CalendarDayType, TeamCalendar as TeamData } from "@/lib/api";
import { dayOffImport, exportTeamCalendar } from "@/lib/excel-specs/time";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { khmerDay } from "@/lib/khmer";
import { slotsSummary } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <span className={cn("size-2.5 rounded-full", tone)} />
      <div>
        <p className="text-xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function TeamCalendar({ canManage, refreshKey = 0 }: { canManage: boolean; refreshKey?: number }) {
  const t = useT();
  const lang = useLang();
  const [month, setMonth] = useState(currentMonth);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ employee: { id: number; name: string }; day: CalendarDay } | null>(null);

  useEffect(() => {
    api.branches.list().then((res) => setBranches(res.data)).catch(() => {});
  }, []);

  const { data, error, loading, reload } = useApi<TeamData>(
    () => api.calendar.team(month, branchId ? Number(branchId) : undefined),
    [month, branchId, refreshKey],
    { errorMessage: t("calendar.team.loadFailed"), keepPrevious: true },
  );

  const employees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.employees ?? []).filter(
      (e) => !term || e.name.toLowerCase().includes(term) || e.employee_code?.toLowerCase().includes(term),
    );
  }, [data, search]);

  // How today looks across the whole team (only when the month on screen has today).
  const todayStats = useMemo(() => {
    if (!data) return null;
    const counts = { working: 0, present: 0, late: 0, absent: 0, off: 0 };
    let found = false;

    for (const employee of employees) {
      const day = employee.days.find((d) => d.date === data.today);
      if (!day) continue;
      found = true;
      if (day.type === "work") counts.working++;
      if (day.type === "day_off" || day.type === "weekly_off" || day.type === "holiday" || day.type === "leave") counts.off++;
      if (day.attendance === "present" || day.attendance === "incomplete" || day.attendance === "worked") counts.present++;
      if (day.attendance === "late") counts.late++;
      if (day.attendance === "absent") counts.absent++;
    }

    return found ? counts : null;
  }, [data, employees]);

  const dates = data?.employees[0]?.days.map((d) => d.date) ?? [];
  const monthLabel = parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("common.time.previousMonth")}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="min-w-40 text-center text-base font-semibold">{monthLabel}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("common.time.nextMonth")}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" onClick={() => setMonth(currentMonth())}>
          {t("common.time.today")}
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("calendar.team.searchPlaceholder")}
              aria-label={t("calendar.team.searchLabel")}
              className="w-52 pl-8"
            />
          </div>
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label={t("common.field.branch")}
              className={SELECT_CLASS}
            >
              <option value="">{t("calendar.team.allBranches")}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
          <ExcelActions
            onExport={() => exportTeamCalendar(month, branchId ? Number(branchId) : undefined)}
            // Days off are what the calendar adds by hand; one-off schedule changes go through the Roster.
            importSpec={canManage ? dayOffImport : undefined}
            onImported={reload}
          />
        </div>
      </div>

      {error && <Alert variant="warning">{error}</Alert>}
      {data?.truncated && (
        <Alert variant="warning">
          {t("calendar.team.truncated", { shown: data.employees.length, total: data.total })}
        </Alert>
      )}

      {todayStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label={t("calendar.team.stat.scheduled")} value={todayStats.working} tone="bg-info" />
          <Stat label={t("calendar.team.stat.present")} value={todayStats.present} tone="bg-success" />
          <Stat label={t("calendar.team.stat.late")} value={todayStats.late} tone="bg-warning" />
          <Stat label={t("calendar.team.stat.absent")} value={todayStats.absent} tone="bg-destructive" />
          <Stat label={t("calendar.team.stat.off")} value={todayStats.off} tone="bg-muted-foreground/50" />
        </div>
      )}

      {loading && <Skeleton className="h-96 w-full" />}

      {data && !loading && employees.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {data.employees.length === 0 ? t("calendar.team.noEmployees") : t("calendar.team.noMatches")}
        </p>
      )}

      {data && !loading && employees.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                {/* Narrow on a phone so more days fit beside it; names are cut short there. */}
                <th className="sticky left-0 z-20 min-w-28 border-b border-r border-border bg-muted px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:min-w-44 sm:px-3">
                  {t("calendar.team.colEmployee")}
                </th>
                {dates.map((date) => {
                  const d = parseDate(date);
                  const khmer = khmerDay(date);
                  const isToday = date === data.today;

                  return (
                    <th
                      key={date}
                      title={[khmer.full, ...khmer.holidays.map((h) => (lang === "km" ? h.nameKm : h.nameEn))].join(" — ")}
                      className={cn(
                        "border-b border-border bg-muted px-0.5 py-1.5 text-center font-normal",
                        isToday && "bg-primary/10",
                      )}
                    >
                      <div className={cn("text-[10px] uppercase text-muted-foreground", (d.getDay() === 0 || d.getDay() === 6) && "text-foreground/70")}>
                        {t(`calendar.shared.weekday.min.${WEEKDAY_KEYS[d.getDay()]}`)}
                      </div>
                      <div className={cn("text-sm font-semibold", isToday && "text-primary", khmer.holidays.length > 0 && "text-destructive")}>
                        {d.getDate()}
                      </div>
                      <div className="text-[9px] leading-tight text-muted-foreground">{khmer.short}</div>
                    </th>
                  );
                })}
                <th className="border-b border-l border-border bg-muted px-2 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  {t("calendar.team.colPresent")}
                </th>
                <th className="border-b border-border bg-muted px-2 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  {t("calendar.team.colLate")}
                </th>
                <th className="border-b border-border bg-muted px-2 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  {t("calendar.team.colAbsent")}
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="group">
                  <td
                    title={employee.name}
                    className="sticky left-0 z-10 border-b border-r border-border bg-card px-2 py-1.5 group-hover:bg-accent/40 sm:px-3"
                  >
                    <div className="max-w-24 truncate text-sm font-medium sm:max-w-56">{employee.name}</div>
                    <div className="max-w-24 truncate text-[11px] text-muted-foreground sm:max-w-56">
                      {[employee.employee_code, employee.branch].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  {employee.days.map((day) => {
                    const style = TYPE_STYLES[day.type as CalendarDayType];
                    const attendance = day.attendance as CalendarAttendance | null;
                    const halfDay = halfDayLeave(day);
                    const tip = [
                      `${employee.name} · ${day.date}`,
                      day.label ?? t(`calendar.shared.dayType.${day.type as CalendarDayType}`),
                      halfDay ? halfDayLabel(halfDay, lang) : null,
                      day.schedule ? `${day.schedule.name} ${slotsSummary(day.schedule.slots, lang)}` : null,
                      day.scans?.length ? t("calendar.team.tipScans", { scans: day.scans.join(", ") }) : null,
                      attendance ? t(`calendar.shared.attendance.${attendance}`) : null,
                    ]
                      .filter(Boolean)
                      .join(" — ");

                    return (
                      <td
                        key={day.date}
                        className={cn(
                          "border-b border-border p-0.5 text-center group-hover:bg-accent/40",
                          day.date === data.today && "bg-primary/5",
                        )}
                      >
                        <button
                          type="button"
                          title={tip}
                          aria-label={tip}
                          onClick={() => setSelected({ employee: { id: employee.id, name: employee.name }, day })}
                          className={cn(
                            "relative isolate mx-auto block size-7 rounded-md border transition-transform hover:scale-110",
                            style.cell,
                          )}
                        >
                          {halfDay && <HalfDayShade part={halfDay.part} className="-z-10" />}
                          {attendance && (
                            <span
                              className={cn("absolute right-0.5 top-0.5 size-1.5 rounded-full", ATTENDANCE[attendance].dot)}
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-b border-l border-border px-2 text-center font-medium tabular-nums">{employee.summary.present}</td>
                  <td className="border-b border-border px-2 text-center tabular-nums text-warning">{employee.summary.late || "·"}</td>
                  <td className="border-b border-border px-2 text-center tabular-nums text-destructive">{employee.summary.absent || "·"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground">
        {(Object.keys(TYPE_STYLES) as CalendarDayType[]).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", TYPE_STYLES[type].swatch)} />
            {t(`calendar.shared.dayType.${type}`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="relative size-3 overflow-hidden rounded-sm bg-info/40">
            <span className="absolute inset-y-0 left-0 w-1/2 bg-violet-500/60" />
          </span>
          {t("calendar.shared.halfDayLegend")}
        </span>
        {(Object.keys(ATTENDANCE) as CalendarAttendance[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", ATTENDANCE[status].dot)} />
            {t(`calendar.shared.attendance.${status}`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-destructive">12</span>
          {t("calendar.team.khmerHoliday")}
        </span>
      </div>

      <DayDialog
        key={selected ? `${selected.employee.id}-${selected.day.date}` : "none"}
        day={selected?.day ?? null}
        employee={selected?.employee ?? null}
        canManage={canManage}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelected(null);
        }}
        onChanged={reload}
      />
    </div>
  );
}
