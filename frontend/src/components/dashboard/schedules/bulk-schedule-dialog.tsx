"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasLeft } from "@/components/dashboard/employee-form";
import { WEEKDAY_KEYS } from "@/components/dashboard/calendar-shared";
import { api, ApiError, Employee, ScheduleBulkInput, ScheduleBulkResult, WorkLocation, WorkSchedule } from "@/lib/api";
import { weekSummary } from "@/lib/schedule";
import { notifyError, notifySuccess } from "@/lib/notify";
import { translate, translateNow, useLang, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";
const MAX_DAYS = 93;

// Local calendar date as YYYY-MM-DD (toISOString would shift it to UTC).
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Quick ranges. Weeks run Monday to Sunday. */
function range(kind: "this-week" | "next-week" | "this-month" | "next-month"): { from: string; to: string } {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));

  if (kind === "this-week" || kind === "next-week") {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (kind === "next-week" ? 7 : 0));
    return { from: iso(start), to: iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)) };
  }

  const offset = kind === "next-month" ? 1 : 0;
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  };
}

const QUICK_RANGES = [
  { id: "this-week", label: "schedules.bulk.thisWeek" },
  { id: "next-week", label: "schedules.bulk.nextWeek" },
  { id: "this-month", label: "schedules.bulk.thisMonth" },
  { id: "next-month", label: "schedules.bulk.nextMonth" },
] as const;

function skippedText(skipped: ScheduleBulkResult["skipped"], lang: Lang): string {
  return [
    skipped.holiday > 0 && translate(lang, "schedules.bulk.skipped.holiday", { n: skipped.holiday }),
    skipped.day_off > 0 && translate(lang, "schedules.bulk.skipped.dayOff", { n: skipped.day_off }),
    skipped.already_scheduled > 0 && translate(lang, "schedules.bulk.skipped.already", { n: skipped.already_scheduled }),
    skipped.employee_left > 0 && translate(lang, "schedules.bulk.skipped.left", { n: skipped.employee_left }),
    skipped.no_hours > 0 && translate(lang, "schedules.bulk.skipped.noHours", { n: skipped.no_hours }),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Roster many people over a date range in one step: pick employees, a work schedule,
 * a range and the weekdays. A live preview asks the server what would really
 * be created, so holidays, days off and existing entries are accounted for.
 */
export function BulkScheduleDialog({
  employees,
  fixedEmployee,
  schedules,
  locations,
  weeklyOffDays = [],
  open,
  onOpenChange,
  onSaved,
}: {
  employees: Employee[];
  // Set when scheduling one specific person (from their own page): no picker is shown.
  fixedEmployee?: Employee;
  schedules: WorkSchedule[];
  locations: WorkLocation[];
  // The company's regular days off — left un-ticked by default.
  // Weekdays to start un-ticked.
  weeklyOffDays?: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const roster = useMemo(() => employees.filter((e) => !hasLeft(e.employment_status)), [employees]);
  const activeSchedules = useMemo(() => schedules.filter((s) => s.is_active), [schedules]);

  const [picked, setPicked] = useState<Set<number>>(() => new Set(fixedEmployee ? [fixedEmployee.id] : []));
  const [search, setSearch] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [dates, setDates] = useState(() => range("this-week"));
  const [weekdays, setWeekdays] = useState<number[]>(() => [0, 1, 2, 3, 4, 5, 6].filter((d) => !weeklyOffDays.includes(d)));
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ key: string; data: ScheduleBulkResult | null; error: string | null } | null>(null);

  // No hours on any day: made for holiday overrides, so holidays are never skipped for it.
  const overtimeOnly = activeSchedules.find((s) => String(s.id) === scheduleId)?.days.length === 0;

  const term = search.trim().toLowerCase();
  const shown = roster.filter((e) => !term || [e.name, e.employee_code, e.job_title].some((v) => v?.toLowerCase().includes(term)));
  const allShownPicked = shown.length > 0 && shown.every((e) => picked.has(e.id));

  const days = dates.from && dates.to && dates.to >= dates.from ? Math.round((parse(dates.to).getTime() - parse(dates.from).getTime()) / 86_400_000) + 1 : 0;
  const rangeProblem =
    !dates.from || !dates.to
      ? t("schedules.bulk.pickDates")
      : dates.to < dates.from
        ? t("schedules.bulk.endBefore")
        : days > MAX_DAYS
          ? t("schedules.bulk.maxDays", { n: MAX_DAYS })
          : weekdays.length === 0
            ? t("schedules.bulk.tickDay")
            : null;

  const payload: ScheduleBulkInput | null =
    picked.size > 0 && scheduleId && !rangeProblem
      ? {
          employee_ids: [...picked],
          work_schedule_id: Number(scheduleId),
          work_location_id: locationId ? Number(locationId) : null,
          from: dates.from,
          to: dates.to,
          weekdays,
          skip_holidays: skipHolidays && !overtimeOnly,
        }
      : null;
  const previewKey = payload ? JSON.stringify(payload) : "";

  // Ask the server what this would do (without doing it), shortly after the last change.
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      api.schedules
        .bulk({ ...payload, dry_run: true })
        .then((data) => !cancelled && setPreview({ key: previewKey, data, error: null }))
        .catch((err) => !cancelled && setPreview({ key: previewKey, data: null, error: err instanceof ApiError ? err.message : translateNow("schedules.bulk.checkFailed") }));
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // payload is derived from previewKey, which is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const previewReady = payload !== null && preview?.key === previewKey;
  const result = previewReady ? preview.data : null;

  function toggleEmployee(id: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllShown() {
    setPicked((current) => {
      const next = new Set(current);
      for (const e of shown) {
        if (allShownPicked) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });
  }

  function toggleWeekday(day: number) {
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setError(null);
    setSaving(true);

    try {
      const res = await api.schedules.bulk(payload);
      const skipped = skippedText(res.skipped, lang);
      notifySuccess(
        translateNow(res.created === 1 ? "schedules.bulk.addedOne" : "schedules.bulk.addedMany", { n: res.created }),
        skipped ? translateNow("schedules.bulk.skippedHint", { list: skipped }) : undefined,
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : translateNow("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("schedules.bulk.title")}</DialogTitle>
          <DialogDescription>
            {fixedEmployee ? t("schedules.bulk.descOne", { name: fixedEmployee.name }) : t("schedules.bulk.descMany")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className={cn("grid gap-5", !fixedEmployee && "md:grid-cols-2")}>
            {/* People */}
            {!fixedEmployee && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>{t("schedules.bulk.employees")}</Label>
                <span className="text-xs text-muted-foreground">{t("common.table.selected", { n: picked.size })}</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("common.table.search")}
                  aria-label={t("schedules.bulk.searchEmployees")}
                  className="pl-8"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <label className="flex cursor-pointer items-center gap-2.5 border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium">
                  <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} className="size-4 rounded border-input" />
                  {term ? t("schedules.bulk.selectShown") : t("schedules.bulk.selectAll")}
                </label>
                {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{t("schedules.bulk.noMatch")}</p>}
                <ul className="divide-y divide-border">
                  {shown.map((employee) => (
                    <li key={employee.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={picked.has(employee.id)}
                          onChange={() => toggleEmployee(employee.id)}
                          className="size-4 rounded border-input"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{employee.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[employee.job_title, employee.department?.name, employee.branch?.name].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            )}

            {/* What and when */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bulk-shift">{t("schedules.bulk.schedule")}</Label>
                <select id="bulk-shift" required value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className={SELECT_CLASS}>
                  <option value="" disabled>
                    {t("common.field.select")}
                  </option>
                  {activeSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.name} — {weekSummary(schedule, lang)}
                    </option>
                  ))}
                </select>
              </div>

              {locations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bulk-location">{t("schedules.bulk.location")}</Label>
                  <select id="bulk-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={SELECT_CLASS}>
                    <option value="">{t("schedules.bulk.ownBranch")}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{t("schedules.bulk.locationHint")}</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>{t("schedules.bulk.dates")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_RANGES.map((quick) => (
                    <Button key={quick.id} type="button" variant="outline" size="sm" onClick={() => setDates(range(quick.id))}>
                      {t(quick.label)}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bulk-from" className="text-xs text-muted-foreground">
                      {t("common.field.from")}
                    </Label>
                    <Input id="bulk-from" type="date" required value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bulk-to" className="text-xs text-muted-foreground">
                      {t("common.field.to")}
                    </Label>
                    <Input id="bulk-to" type="date" required value={dates.to} min={dates.from} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("schedules.bulk.weekdays")}</Label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAY_KEYS.map((key, index) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={weekdays.includes(index)}
                      onClick={() => toggleWeekday(index)}
                      className={cn(
                        "rounded-md border px-1 py-1.5 text-xs font-medium transition-colors",
                        weekdays.includes(index) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {t(`calendar.shared.weekday.short.${key}`)}
                    </button>
                  ))}
                </div>
                {weeklyOffDays.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("schedules.bulk.companyOff", {
                      days: weeklyOffDays.map((d) => t(`calendar.shared.weekday.short.${WEEKDAY_KEYS[d]}`)).join(", "),
                    })}
                  </p>
                )}
              </div>

              {overtimeOnly ? (
                <Alert title={t("schedules.bulk.overtimeOnlyTitle")}>{t("schedules.bulk.overtimeOnlyText")}</Alert>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} className="size-4 rounded border-input" />
                  {t("schedules.bulk.skipHolidays")}
                </label>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {rangeProblem && picked.size > 0 && scheduleId ? (
              <span className="text-destructive">{rangeProblem}</span>
            ) : !payload ? (
              <span className="text-muted-foreground">{t("schedules.bulk.previewPick")}</span>
            ) : !previewReady ? (
              <span className="text-muted-foreground">{t("schedules.bulk.checking")}</span>
            ) : preview?.error ? (
              <span className="text-destructive">{preview.error}</span>
            ) : result ? (
              <span>
                {/* The count is bold wherever the language puts it. */}
                {t(result.created === 1 ? "schedules.bulk.willAddOne" : "schedules.bulk.willAddMany")
                  .split("{n}")
                  .map((part, i) => (
                    <span key={i}>
                      {i > 0 && <strong>{result.created}</strong>}
                      {part}
                    </span>
                  ))}
                {skippedText(result.skipped, lang) && (
                  <span className="text-muted-foreground">{t("schedules.bulk.skipping", { list: skippedText(result.skipped, lang) })}</span>
                )}
              </span>
            ) : null}
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !previewReady || !result || result.created === 0}>
              {saving
                ? t("common.message.adding")
                : result
                  ? t(result.created === 1 ? "schedules.bulk.addOne" : "schedules.bulk.addMany", { n: result.created })
                  : t("schedules.bulk.title")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
