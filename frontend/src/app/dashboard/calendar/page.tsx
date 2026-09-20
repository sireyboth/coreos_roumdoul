"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, CalendarAttendance, CalendarDay, CalendarDayType, CalendarMonth, Employee } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Full class strings so Tailwind can see them.
const TYPE_STYLES: Record<CalendarDayType, { cell: string; label: string; swatch: string }> = {
  work: { cell: "border-info/30 bg-info/10", label: "Work day", swatch: "bg-info/40" },
  holiday: { cell: "border-destructive/30 bg-destructive/10", label: "Holiday", swatch: "bg-destructive/40" },
  day_off: { cell: "border-warning/40 bg-warning/15", label: "Day off", swatch: "bg-warning/50" },
  weekly_off: { cell: "border-border bg-muted", label: "Weekly day off", swatch: "bg-muted-foreground/30" },
  none: { cell: "border-border bg-background", label: "Nothing planned", swatch: "bg-background border border-border" },
};

const ATTENDANCE: Record<CalendarAttendance, { label: string; dot: string; variant: "success" | "warning" | "destructive" }> = {
  present: { label: "Present", dot: "bg-success", variant: "success" },
  late: { label: "Late", dot: "bg-warning", variant: "warning" },
  missing_checkout: { label: "No check-out", dot: "bg-warning", variant: "warning" },
  absent: { label: "Absent", dot: "bg-destructive", variant: "destructive" },
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function WeeklyOffDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: number[];
  onSaved: () => void;
}) {
  const [days, setDays] = useState<number[]>(initial);
  const [saving, setSaving] = useState(false);

  function toggle(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await api.calendar.setWeeklyOffDays(days);
      notifySuccess("Weekly days off updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Weekly days off</DialogTitle>
          <DialogDescription>
            Days your company doesn&apos;t normally work. A shift can still be scheduled on one if needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2">
            {WEEKDAYS.map((name, index) => (
              <label
                key={name}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm",
                  days.includes(index) ? "border-primary bg-primary/10 font-medium" : "border-input",
                )}
              >
                <input
                  type="checkbox"
                  checked={days.includes(index)}
                  onChange={() => toggle(index)}
                  className="sr-only"
                />
                {name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayDialog({
  day,
  employee,
  canManage,
  onOpenChange,
  onChanged,
}: {
  day: CalendarDay | null;
  employee: CalendarMonth["employee"] | null;
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
        {day && (
          <div className="flex flex-col gap-4 text-sm">
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
                <Link href="/dashboard/schedule" className="font-medium text-primary hover:underline">
                  Schedule page
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

export default function CalendarPage() {
  const { me } = useMe();
  const canManage = me?.permissions.includes("schedules.manage") ?? false;

  const [month, setMonth] = useState(currentMonth);
  // "" = my own calendar; managers can pick anyone else.
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: string; data: CalendarMonth | null; error: string | null } | null>(null);
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyKey, setWeeklyKey] = useState(0);

  const requestKey = `${month}|${employeeId}|${reloads}`;

  useEffect(() => {
    if (canManage) {
      api.employees.list().then((res) => setEmployees(res.data)).catch(() => {});
    }
  }, [canManage]);

  useEffect(() => {
    let cancelled = false;

    api.calendar
      .month(month, employeeId ? Number(employeeId) : undefined)
      .then((data) => !cancelled && setResult({ key: requestKey, data, error: null }))
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, data: null, error: err instanceof ApiError ? err.message : "Couldn't load the calendar." });
      });

    return () => {
      cancelled = true;
    };
  }, [month, employeeId, requestKey]);

  const loading = result?.key !== requestKey;
  const data = result?.data ?? null;
  const reload = () => setReloads((n) => n + 1);

  const leadingBlanks = data ? parseDate(data.days[0].date).getDay() : 0;
  const monthLabel = parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Calendar"
          description="Work days, holidays and days off — and how each day actually went."
          action={
            canManage && (
              <Button
                variant="outline"
                onClick={() => {
                  setWeeklyKey((k) => k + 1);
                  setWeeklyOpen(true);
                }}
              >
                <Settings2 className="size-4" />
                Weekly days off
              </Button>
            )
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-40 text-center text-base font-semibold">{monthLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setMonth(currentMonth())}>
            Today
          </Button>

          {canManage && (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              aria-label="Employee"
              className="ml-auto h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              <option value="">My calendar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {result?.error && !loading && <Alert variant="warning">{result.error}</Alert>}

        {data && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="info">{data.summary.work_days} work days</Badge>
            <Badge variant="outline">{data.summary.holidays} holidays</Badge>
            <Badge variant="warning">{data.summary.days_off} days off</Badge>
            <Badge variant="success">{data.summary.present} present</Badge>
            <Badge variant="warning">{data.summary.late} late</Badge>
            <Badge variant="destructive">{data.summary.absent} absent</Badge>
          </div>
        )}

        {loading && <Skeleton className="h-96 w-full" />}

        {data && !loading && (
          <div className="flex flex-col gap-3">
            {canManage && employeeId !== "" && (
              <p className="text-sm text-muted-foreground">Showing {data.employee.name}. Click a day to see details or mark a day off.</p>
            )}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAYS.map((name) => (
                <div key={name} className="pb-1 text-center text-xs font-medium text-muted-foreground">
                  {name}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {data.days.map((day) => {
                const style = TYPE_STYLES[day.type];
                const isToday = day.date === data.today;

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={cn(
                      "flex min-h-14 flex-col items-start gap-0.5 rounded-md border p-1 text-left text-xs transition-colors hover:brightness-95 sm:min-h-24 sm:p-2",
                      style.cell,
                      isToday && "ring-2 ring-primary",
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className={cn("font-medium", isToday && "text-primary")}>{Number(day.date.slice(8))}</span>
                      {day.attendance && (
                        <span
                          className={cn("size-2 rounded-full", ATTENDANCE[day.attendance].dot)}
                          title={ATTENDANCE[day.attendance].label}
                        />
                      )}
                    </span>
                    {day.label && <span className="hidden w-full truncate sm:block">{day.label}</span>}
                    {day.shift && (
                      <span className="hidden text-muted-foreground sm:block">
                        {day.shift.start_time}–{day.shift.end_time}
                      </span>
                    )}
                    {day.attendance && (
                      <span className="hidden text-muted-foreground sm:block">{ATTENDANCE[day.attendance].label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
              {(Object.keys(TYPE_STYLES) as CalendarDayType[]).map((type) => (
                <span key={type} className="flex items-center gap-1.5">
                  <span className={cn("size-3 rounded-sm", TYPE_STYLES[type].swatch)} />
                  {TYPE_STYLES[type].label}
                </span>
              ))}
              {(Object.keys(ATTENDANCE) as CalendarAttendance[]).map((status) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", ATTENDANCE[status].dot)} />
                  {ATTENDANCE[status].label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <DayDialog
        key={selected?.date ?? "none"}
        day={selected}
        employee={data?.employee ?? null}
        canManage={canManage}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelected(null);
        }}
        onChanged={reload}
      />

      <WeeklyOffDialog
        key={weeklyKey}
        open={weeklyOpen}
        onOpenChange={setWeeklyOpen}
        initial={data?.weekly_off_days ?? []}
        onSaved={reload}
      />
    </div>
  );
}
