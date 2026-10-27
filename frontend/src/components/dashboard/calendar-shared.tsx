"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { api, ApiError, CalendarAttendance, CalendarDay, CalendarDayType } from "@/lib/api";
import { dateLocale, translate, useLang, useT, type Lang } from "@/lib/i18n";
import { khmerDay } from "@/lib/khmer";
import { notifyError, notifySuccess } from "@/lib/notify";
import { EXCEPTIONS, formatMinutes, slotsSummary } from "@/lib/schedule";

// English names, kept for code that hasn't moved to keys. On screen use
// t(`calendar.shared.weekday.short.${WEEKDAY_KEYS[day]}`) (also .min and .full).
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Full class strings so Tailwind can see them. `label` is English; on screen use
// t(`calendar.shared.dayType.${type}`).
export const TYPE_STYLES: Record<CalendarDayType, { cell: string; label: string; swatch: string }> = {
  work: { cell: "border-info/30 bg-info/10", label: "Work day", swatch: "bg-info/40" },
  holiday: { cell: "border-destructive/30 bg-destructive/10", label: "Holiday", swatch: "bg-destructive/40" },
  day_off: { cell: "border-warning/40 bg-warning/15", label: "Day off", swatch: "bg-warning/50" },
  weekly_off: { cell: "border-border bg-muted", label: "Weekly day off", swatch: "bg-muted-foreground/30" },
  leave: { cell: "border-violet-500/30 bg-violet-500/10", label: "On leave", swatch: "bg-violet-500/40" },
  none: { cell: "border-border bg-background", label: "Nothing planned", swatch: "bg-background border border-border" },
};

/** Morning or afternoon leave on a day that is still a work day; null for none or a full day. */
export function halfDayLeave(day: Pick<CalendarDay, "leave">): { type: string; part: "am" | "pm" } | null {
  return day.leave && day.leave.part !== "full" ? { type: day.leave.type, part: day.leave.part } : null;
}

export const halfDayLabel = (leave: { type: string; part: "am" | "pm" }, lang: Lang = "en") =>
  translate(lang, "calendar.shared.halfDay", {
    type: leave.type,
    part: translate(lang, leave.part === "am" ? "calendar.shared.morning" : "calendar.shared.afternoon"),
  });

/** Shades the half of a cell taken as leave: left for the morning, right for the afternoon. */
export function HalfDayShade({ part, className }: { part: "am" | "pm"; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 w-1/2 bg-violet-500/25 ${part === "am" ? "left-0 rounded-l-[inherit]" : "right-0 rounded-r-[inherit]"} ${className ?? ""}`}
    />
  );
}

// `label` is English; on screen use t(`calendar.shared.attendance.${status}`).
export const ATTENDANCE: Record<CalendarAttendance, { label: string; dot: string; variant: "success" | "warning" | "destructive" }> = {
  present: { label: "Present", dot: "bg-success", variant: "success" },
  late: { label: "Late", dot: "bg-warning", variant: "warning" },
  incomplete: { label: "Missing a scan", dot: "bg-warning", variant: "warning" },
  absent: { label: "Absent", dot: "bg-destructive", variant: "destructive" },
  worked: { label: "Worked", dot: "bg-success", variant: "success" },
};

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The first and last day of a month ("2026-10"), for a from / to query. */
export function monthBounds(month: string): { from: string; to: string } {
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** ‹ October 2026 › Today — the month a list shows. */
export function MonthBar({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, -1))} aria-label={t("common.time.previousMonth")}>
        <ChevronLeft className="size-4" />
      </Button>
      <h2 className="min-w-40 text-center text-base font-semibold">
        {parseDate(`${month}-01`).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" })}
      </h2>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, 1))} aria-label={t("common.time.nextMonth")}>
        <ChevronRight className="size-4" />
      </Button>
      <Button variant="outline" onClick={() => onChange(currentMonth())}>
        {t("common.time.today")}
      </Button>
    </div>
  );
}

export function DayDialog({
  day,
  employee,
  canManage,
  onOpenChange,
  onChanged,
}: {
  day: CalendarDay | null;
  employee: { id: number; name: string } | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function markDayOff() {
    if (!day || !employee) return;
    setError(null);
    setSaving(true);

    try {
      await api.daysOff.create({ employee_id: employee.id, date: day.date, reason: reason || null });
      notifySuccess(t("calendar.shared.dialog.added"));
      onOpenChange(false);
      onChanged();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  async function removeDayOff() {
    if (!day?.day_off_id) return;
    setSaving(true);

    try {
      await api.daysOff.remove(day.day_off_id);
      notifySuccess(t("calendar.shared.dialog.removed"));
      onOpenChange(false);
      onChanged();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  const khmer = day ? khmerDay(day.date) : null;

  const heading = day
    ? parseDate(day.date).toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{employee?.name}</DialogDescription>
        </DialogHeader>
        {day && khmer && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
              <p className="font-medium leading-relaxed">{khmer.full}</p>
              {khmer.isSil && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Moon className="size-3.5" />
                  {t("calendar.shared.dialog.silNote")}
                </span>
              )}
              {khmer.holidays.map((holiday) => (
                <div key={holiday.date} className="flex flex-col">
                  <span className="font-medium text-destructive">{lang === "km" ? holiday.nameKm : holiday.nameEn}</span>
                  <span className="text-xs text-muted-foreground">{lang === "km" ? holiday.nameEn : holiday.nameKm}</span>
                </div>
              ))}
              {khmer.holidays.length > 0 && day.type !== "holiday" && (
                <p className="text-xs text-muted-foreground">
                  {t("calendar.shared.dialog.notInList")}{" "}
                  {canManage && (
                    <Link href="/dashboard/holidays" className="font-medium text-primary hover:underline">
                      {t("calendar.shared.dialog.importLink")}
                    </Link>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t(`calendar.shared.dayType.${day.type}`)}</Badge>
              {day.label && day.type !== "work" && day.type !== "weekly_off" && (
                <span className="text-muted-foreground">{day.label}</span>
              )}
              {day.attendance && <Badge variant={ATTENDANCE[day.attendance].variant}>{t(`calendar.shared.attendance.${day.attendance}`)}</Badge>}
              {/* Half a day on leave: still a work day, with only the other half expected. */}
              {day.leave && day.leave.part !== "full" && (
                <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-400">
                  {t("calendar.shared.dialog.leavePart", {
                    type: day.leave.type,
                    part: t(day.leave.part === "am" ? "calendar.shared.morning" : "calendar.shared.afternoon"),
                  })}
                </Badge>
              )}
            </div>

            {day.schedule && (
              <div className="flex flex-col gap-0.5">
                <p>
                  <span className="font-medium">{day.schedule.name}</span>{" "}
                  <span className="text-muted-foreground">{slotsSummary(day.schedule.slots, lang)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {day.schedule.source === "override" ? t("calendar.shared.dialog.overrideSource") : t("calendar.shared.dialog.usualSource")}
                  {day.work_location && t("calendar.shared.dialog.atLocation", { location: day.work_location })}
                  {day.holiday && t("calendar.shared.dialog.onHoliday", { holiday: day.holiday })}
                </p>
              </div>
            )}

            {day.scans && day.scans.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-muted-foreground">
                  {t("calendar.shared.dialog.scans")} <span className="font-medium text-foreground tabular-nums">{day.scans.join(" · ")}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("calendar.shared.dialog.worked", { time: formatMinutes(day.worked_minutes, lang) })}
                  {day.late_minutes ? t("calendar.shared.dialog.late", { n: day.late_minutes }) : ""}
                  {day.early_leave_minutes ? t("calendar.shared.dialog.early", { n: day.early_leave_minutes }) : ""}
                  {day.overtime_minutes ? t("calendar.shared.dialog.overtime", { time: formatMinutes(day.overtime_minutes, lang) }) : ""}
                </p>
              </div>
            )}

            {day.exceptions && day.exceptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {day.exceptions.map((code) => (
                  <Badge key={code} variant={EXCEPTIONS[code].tone}>
                    {t(`attendance.status.exception.${code}`)}
                  </Badge>
                ))}
              </div>
            )}

            {canManage && (day.type === "none" || day.type === "weekly_off" || (day.type === "work" && day.schedule?.source === "assignment")) && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <Label htmlFor="reason">{t("calendar.shared.dialog.markOffLabel", { name: employee?.name ?? "" })}</Label>
                <Input
                  id="reason"
                  placeholder={t("calendar.shared.dialog.reasonPlaceholder")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {error && <Alert variant="destructive">{error}</Alert>}
                <Button onClick={markDayOff} disabled={saving} className="self-start">
                  {saving ? t("calendar.shared.dialog.saving") : t("calendar.shared.dialog.markOff")}
                </Button>
              </div>
            )}

            {canManage && day.type === "day_off" && day.day_off_id && (
              <Button variant="outline" onClick={removeDayOff} disabled={saving} className="self-start">
                {saving ? t("calendar.shared.dialog.removing") : t("calendar.shared.dialog.removeOff")}
              </Button>
            )}

            {canManage && (day.type === "work" || day.type === "none") && (
              <p className="text-muted-foreground">
                {day.schedule?.source === "override"
                  ? t("calendar.shared.dialog.rosterOverride")
                  : day.type === "none"
                    ? t("calendar.shared.dialog.rosterNone")
                    : t("calendar.shared.dialog.rosterWork")}
                <Link href="/dashboard/employees?tab=roster" className="font-medium text-primary hover:underline">
                  {t("calendar.shared.dialog.roster")}
                </Link>
                {t("calendar.shared.dialog.rosterEnd")}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

