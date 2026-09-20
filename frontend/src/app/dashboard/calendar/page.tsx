"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Moon, Settings2, Users } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ATTENDANCE,
  currentMonth,
  DayDialog,
  parseDate,
  shiftMonth,
  TYPE_STYLES,
  WEEKDAYS,
} from "@/components/dashboard/calendar-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamCalendar } from "@/components/dashboard/team-calendar";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, CalendarAttendance, CalendarDay, CalendarDayType, CalendarMonth, Employee } from "@/lib/api";
import { khmerDay } from "@/lib/khmer";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

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

export default function CalendarPage() {
  const { me } = useMe();
  const canManage = me?.permissions.includes("schedules.manage") ?? false;

  const [month, setMonth] = useState(currentMonth);
  // Managers land on the whole-team roster; everyone else only has their own month.
  const [view, setView] = useState<"team" | "individual">("team");
  // "" = my own calendar; managers can pick anyone else.
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: string; data: CalendarMonth | null; error: string | null } | null>(null);
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyKey, setWeeklyKey] = useState(0);
  // Read fresh from the server when the dialog opens — the month on screen
  // (or the team roster) isn't a reliable source, and saving from a stale
  // or empty list would overwrite the company's real weekly days off.
  const [weeklyInitial, setWeeklyInitial] = useState<number[]>([]);

  async function openWeekly() {
    try {
      const res = await api.calendar.weeklyOffDays();
      setWeeklyInitial(res.weekly_off_days);
      setWeeklyKey((k) => k + 1);
      setWeeklyOpen(true);
    } catch (err) {
      notifyError(err);
    }
  }

  // An admin who isn't an employee has no "my calendar" — they pick someone
  // (defaulting to the first person) instead of hitting a "no employee" error.
  const hasOwnCalendar = Boolean(me?.employee);
  const needsPick = canManage && !hasOwnCalendar;
  const effectiveEmployeeId = employeeId || (needsPick ? String(employees[0]?.id ?? "") : "");
  const requestKey = `${month}|${effectiveEmployeeId}|${reloads}`;

  useEffect(() => {
    if (canManage) {
      api.employees.list().then((res) => setEmployees(res.data)).catch(() => {});
    }
  }, [canManage]);

  useEffect(() => {
    if (view !== "individual" && canManage) return;
    if (needsPick && !effectiveEmployeeId) return;

    let cancelled = false;

    api.calendar
      .month(month, effectiveEmployeeId ? Number(effectiveEmployeeId) : undefined)
      .then((data) => !cancelled && setResult({ key: requestKey, data, error: null }))
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: requestKey, data: null, error: err instanceof ApiError ? err.message : "Couldn't load the calendar." });
      });

    return () => {
      cancelled = true;
    };
  }, [month, effectiveEmployeeId, requestKey, view, canManage, needsPick]);

  const loading = result?.key !== requestKey && !(needsPick && employees.length === 0);
  const data = result?.data ?? null;
  const reload = () => setReloads((n) => n + 1);

  const leadingBlanks = data ? parseDate(data.days[0].date).getDay() : 0;
  const monthLabel = parseDate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const showTeam = canManage && view === "team";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Calendar"
          description={
            showTeam
              ? "Everyone's month at a glance — shifts, days off and attendance."
              : "Work days, holidays and days off — and how each day actually went."
          }
          action={
            canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
                  {(
                    [
                      { id: "team", label: "Team", icon: Users },
                      { id: "individual", label: "Individual", icon: CalendarDays },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={view === tab.id}
                      onClick={() => setView(tab.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        view === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <tab.icon className="size-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
                <Button variant="outline" onClick={openWeekly}>
                  <Settings2 className="size-4" />
                  Weekly days off
                </Button>
              </div>
            )
          }
        />

        {showTeam && <TeamCalendar canManage={canManage} refreshKey={reloads} />}

        {!showTeam && (
          <>
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
                  value={effectiveEmployeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  aria-label="Employee"
                  className="ml-auto h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                >
                  {hasOwnCalendar && <option value="">My calendar</option>}
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {needsPick && employees.length === 0 && (
              <Alert variant="info">There are no employees yet. Add one from the Employees page to see their calendar.</Alert>
            )}

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
                {canManage && (
                  <p className="text-sm text-muted-foreground">
                    Showing {data.employee.name}. Click a day to see details or mark a day off.
                  </p>
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
                    const khmer = khmerDay(day.date);
                    const khmerHoliday = khmer.holidays[0];

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelected(day)}
                        className={cn(
                          "flex min-h-16 flex-col items-start gap-0.5 rounded-md border p-1 text-left text-xs transition-colors hover:brightness-95 sm:min-h-28 sm:p-2",
                          style.cell,
                          isToday && "ring-2 ring-primary",
                        )}
                      >
                        <span className="flex w-full items-center justify-between">
                          <span className={cn("font-medium", isToday && "text-primary")}>{Number(day.date.slice(8))}</span>
                          <span className="flex items-center gap-1">
                            {khmer.isSil && <Moon className="size-3 text-muted-foreground" aria-label="Sil day" />}
                            {day.attendance && (
                              <span
                                className={cn("size-2 rounded-full", ATTENDANCE[day.attendance].dot)}
                                title={ATTENDANCE[day.attendance].label}
                              />
                            )}
                          </span>
                        </span>
                        <span className="text-[10px] leading-tight text-muted-foreground">{khmer.short}</span>
                        {day.label && <span className="hidden w-full truncate sm:block">{day.label}</span>}
                        {/* A Khmer holiday the company hasn't added yet: shown for reference, not as a day off. */}
                        {khmerHoliday && day.type !== "holiday" && (
                          <span className="hidden w-full truncate text-[10px] font-medium text-destructive sm:block" title={khmerHoliday.nameKm}>
                            {khmerHoliday.nameEn}
                          </span>
                        )}
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
                  <span className="flex items-center gap-1.5">
                    <Moon className="size-3" />
                    Sil day (ថ្ងៃសីល)
                  </span>
                </div>
              </div>
            )}
          </>
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
        initial={weeklyInitial}
        onSaved={reload}
      />
    </div>
  );
}
