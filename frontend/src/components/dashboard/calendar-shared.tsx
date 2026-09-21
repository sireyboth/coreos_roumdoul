"use client";

import { useState } from "react";
import Link from "next/link";
import { Moon } from "lucide-react";
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
import { khmerDay } from "@/lib/khmer";
import { notifyError, notifySuccess } from "@/lib/notify";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Full class strings so Tailwind can see them.
export const TYPE_STYLES: Record<CalendarDayType, { cell: string; label: string; swatch: string }> = {
  work: { cell: "border-info/30 bg-info/10", label: "Work day", swatch: "bg-info/40" },
  holiday: { cell: "border-destructive/30 bg-destructive/10", label: "Holiday", swatch: "bg-destructive/40" },
  day_off: { cell: "border-warning/40 bg-warning/15", label: "Day off", swatch: "bg-warning/50" },
  weekly_off: { cell: "border-border bg-muted", label: "Weekly day off", swatch: "bg-muted-foreground/30" },
  none: { cell: "border-border bg-background", label: "Nothing planned", swatch: "bg-background border border-border" },
};

export const ATTENDANCE: Record<CalendarAttendance, { label: string; dot: string; variant: "success" | "warning" | "destructive" }> = {
  present: { label: "Present", dot: "bg-success", variant: "success" },
  late: { label: "Late", dot: "bg-warning", variant: "warning" },
  missing_checkout: { label: "No check-out", dot: "bg-warning", variant: "warning" },
  absent: { label: "Absent", dot: "bg-destructive", variant: "destructive" },
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
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function markDayOff() {
    if (!day || !employee) return;
    setError(null);
    setSaving(true);

    try {
      await api.daysOff.create({ employee_id: employee.id, date: day.date, reason: reason || null });
      notifySuccess("Day off added");
      onOpenChange(false);
      onChanged();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDayOff() {
    if (!day?.day_off_id) return;
    setSaving(true);

    try {
      await api.daysOff.remove(day.day_off_id);
      notifySuccess("Day off removed");
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
    ? parseDate(day.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
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
                  ថ្ងៃសីល · Buddhist observance day
                </span>
              )}
              {khmer.holidays.map((holiday) => (
                <div key={holiday.date} className="flex flex-col">
                  <span className="font-medium text-destructive">{holiday.nameEn}</span>
                  <span className="text-xs text-muted-foreground">{holiday.nameKm}</span>
                </div>
              ))}
              {khmer.holidays.length > 0 && day.type !== "holiday" && (
                <p className="text-xs text-muted-foreground">
                  A Cambodian holiday, but not in your company&apos;s holiday list, so it doesn&apos;t change anyone&apos;s
                  schedule.{" "}
                  {canManage && (
                    <Link href="/dashboard/holidays" className="font-medium text-primary hover:underline">
                      Import it from Holidays
                    </Link>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{TYPE_STYLES[day.type].label}</Badge>
              {day.label && day.type !== "work" && day.type !== "weekly_off" && (
                <span className="text-muted-foreground">{day.label}</span>
              )}
              {day.attendance && <Badge variant={ATTENDANCE[day.attendance].variant}>{ATTENDANCE[day.attendance].label}</Badge>}
            </div>

            {day.shift && (
              <p>
                <span className="font-medium">{day.shift.name}</span>{" "}
                <span className="text-muted-foreground">
                  {day.shift.start_time} – {day.shift.end_time}
                </span>
                {day.work_location && <span className="text-muted-foreground"> · at {day.work_location}</span>}
              </p>
            )}

            {(day.check_in || day.check_out) && (
              <p className="text-muted-foreground">
                Checked in {day.check_in ?? "—"}, out {day.check_out ?? "—"}
                {day.late_minutes ? ` · ${day.late_minutes} min late` : ""}
              </p>
            )}

            {canManage && (day.type === "none" || day.type === "weekly_off") && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <Label htmlFor="reason">Mark {employee?.name} as off this day</Label>
                <Input
                  id="reason"
                  placeholder="Reason (optional) — e.g. Sick, Family"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {error && <Alert variant="destructive">{error}</Alert>}
                <Button onClick={markDayOff} disabled={saving} className="self-start">
                  {saving ? "Saving…" : "Mark as day off"}
                </Button>
              </div>
            )}

            {canManage && day.type === "day_off" && day.day_off_id && (
              <Button variant="outline" onClick={removeDayOff} disabled={saving} className="self-start">
                {saving ? "Removing…" : "Remove this day off"}
              </Button>
            )}

            {canManage && (day.type === "work" || day.type === "none") && (
              <p className="text-muted-foreground">
                To {day.type === "work" ? "change or remove the shift" : "give them a shift"}, use the{" "}
                <Link href="/dashboard/employees?tab=roster" className="font-medium text-primary hover:underline">
                  Roster
                </Link>
                .
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

