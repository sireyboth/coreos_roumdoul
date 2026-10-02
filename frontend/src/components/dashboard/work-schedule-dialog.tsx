"use client";

import { useMemo, useState } from "react";
import { Copy, Moon, Plus, X } from "lucide-react";
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
import { api, ApiError, type OvertimeMode, type ScheduleSlot, type WorkSchedule, type WorkScheduleInput } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatMinutes, slotsOn, WEEK_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/schedule";
import { cn } from "@/lib/utils";

/** One stretch of work: scan IN at `in`, scan OUT at `out`. */
type Stretch = { in: string; out: string };

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Turns a day's stretches into slots. Times are typed as on a clock: a time
 * earlier than the one before it is the next morning (22:00 → 06:00), so
 * nobody has to tick a "next day" box.
 */
function toSlots(stretches: Stretch[]): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  let nextDay = false;
  let previous = -1;
  for (const stretch of stretches) {
    for (const [type, time] of [["in", stretch.in], ["out", stretch.out]] as const) {
      if (previous >= 0 && minutesOf(time) <= previous) nextDay = true;
      previous = minutesOf(time);
      slots.push({ type, time, next_day: nextDay });
    }
  }
  return slots;
}

function fromSlots(slots: ScheduleSlot[]): Stretch[] {
  const stretches: Stretch[] = [];
  for (let i = 0; i + 1 < slots.length; i += 2) stretches.push({ in: slots[i].time.slice(0, 5), out: slots[i + 1].time.slice(0, 5) });
  return stretches;
}

function dayMinutes(stretches: Stretch[]): number {
  return toSlots(stretches).reduce((total, slot, i, all) => {
    if (slot.type !== "out") return total;
    const start = all[i - 1];
    return total + minutesOf(slot.time) + (slot.next_day ? 1440 : 0) - (minutesOf(start.time) + (start.next_day ? 1440 : 0));
  }, 0);
}

const OVERTIME_MODES: { value: OvertimeMode; label: string; help: string }[] = [
  { value: "off", label: "Don't count overtime", help: "Time past the schedule is recorded as worked, but never as overtime." },
  { value: "after_last_out", label: "Time after the last OUT", help: "Staying past the day's final OUT counts as overtime." },
  { value: "above_scheduled", label: "Hours above the schedule", help: "Worked hours beyond the day's scheduled hours count as overtime." },
];

/** Create or edit a work schedule: the week's slots, plus the tolerance and overtime rules. */
export function WorkScheduleDialog({
  schedule,
  open,
  onOpenChange,
  onSaved,
}: {
  schedule: WorkSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(schedule?.name ?? "");
  const [description, setDescription] = useState(schedule?.description ?? "");
  const [active, setActive] = useState(schedule?.is_active ?? true);
  // Per weekday: its stretches (empty = day off).
  const [week, setWeek] = useState<Record<number, Stretch[]>>(() =>
    Object.fromEntries(
      WEEK_ORDER.map((d) => [
        d,
        schedule ? fromSlots(slotsOn(schedule, d)) : d === 0 ? [] : [{ in: "08:00", out: "17:00" }],
      ]),
    ),
  );
  const [lateGrace, setLateGrace] = useState(String(schedule?.late_grace_minutes ?? 5));
  const [earlyGrace, setEarlyGrace] = useState(String(schedule?.early_leave_grace_minutes ?? 0));
  const [breakMinutes, setBreakMinutes] = useState(String(schedule?.break_minutes ?? 60));
  const [breakPaid, setBreakPaid] = useState(schedule?.is_break_paid ?? false);
  const [daysOff, setDaysOff] = useState<number[]>(schedule?.default_days_off ?? [0]);
  const [overtimeMode, setOvertimeMode] = useState<OvertimeMode>(schedule?.overtime_mode ?? "off");
  const [overtimeMin, setOvertimeMin] = useState(String(schedule?.overtime_min_minutes ?? 30));
  const [overtimeEarly, setOvertimeEarly] = useState(schedule?.overtime_count_early ?? false);
  const [overtimeRound, setOvertimeRound] = useState(String(schedule?.overtime_round_minutes ?? 15));
  const [overtimeApproval, setOvertimeApproval] = useState(schedule?.overtime_requires_approval ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weeklyMinutes = useMemo(
    () =>
      WEEK_ORDER.reduce((total, d) => {
        const stretches = week[d];
        const unpaidBreak = stretches.length === 1 && !breakPaid ? Number(breakMinutes) || 0 : 0;
        return total + Math.max(0, dayMinutes(stretches) - unpaidBreak);
      }, 0),
    [week, breakMinutes, breakPaid],
  );
  const singleStretchDays = WEEK_ORDER.some((d) => week[d].length === 1);

  function setDay(weekday: number, stretches: Stretch[]) {
    setWeek((w) => ({ ...w, [weekday]: stretches }));
  }

  function updateStretch(weekday: number, index: number, patch: Partial<Stretch>) {
    setDay(weekday, week[weekday].map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  /** A new stretch an hour after the last one ends (e.g. back from lunch). */
  function addStretch(weekday: number) {
    const last = week[weekday][week[weekday].length - 1];
    if (!last) return setDay(weekday, [{ in: "08:00", out: "17:00" }]);
    const start = (minutesOf(last.out) + 60) % 1440;
    const end = (start + 240) % 1440;
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    setDay(weekday, [...week[weekday], { in: hhmm(start), out: hhmm(end) }]);
  }

  function copyMondayToAll() {
    setWeek((w) => Object.fromEntries(WEEK_ORDER.map((d) => [d, w[d].length > 0 ? w[1].map((s) => ({ ...s })) : []])));
  }

  function toggleDayOff(weekday: number) {
    setDaysOff((days) => (days.includes(weekday) ? days.filter((d) => d !== weekday) : [...days, weekday]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (WEEK_ORDER.every((d) => week[d].length === 0)) {
      setError("Add hours to at least one day.");
      return;
    }

    const payload: WorkScheduleInput = {
      name,
      description: description || null,
      is_active: active,
      late_grace_minutes: Number(lateGrace) || 0,
      early_leave_grace_minutes: Number(earlyGrace) || 0,
      break_minutes: Number(breakMinutes) || 0,
      is_break_paid: breakPaid,
      default_days_off: daysOff,
      overtime_mode: overtimeMode,
      overtime_min_minutes: Number(overtimeMin) || 0,
      overtime_count_early: overtimeEarly,
      overtime_round_minutes: Number(overtimeRound) || 0,
      overtime_requires_approval: overtimeApproval,
      days: WEEK_ORDER.filter((d) => week[d].length > 0).map((d) => ({ weekday: d, slots: toSlots(week[d]) })),
    };

    setSaving(true);
    try {
      if (schedule) {
        await api.workSchedules.update(schedule.id, payload);
        notifySuccess("Schedule updated", "Days already finished keep the hours they were judged by.");
      } else {
        await api.workSchedules.create(payload);
        notifySuccess("Schedule created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? (err.errors ? Object.values(err.errors)[0][0] : err.message) : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{schedule ? `Edit "${schedule.name}"` : "New work schedule"}</DialogTitle>
          <DialogDescription>
            When people on this schedule should scan in and out. Add as many IN → OUT stretches per day as you need — a
            split shift is simply two.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" required placeholder="Split shift" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-description">Description (optional)</Label>
              <Input id="ws-description" placeholder="Shop floor, Mon–Sat" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* ── The week ── */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Hours</h3>
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(weeklyMinutes)} per week. A time earlier than the one before it is the next morning
                  (night shifts).
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyMondayToAll} disabled={week[1].length === 0}>
                <Copy className="size-3.5" />
                Copy Monday to every working day
              </Button>
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border">
              {WEEK_ORDER.map((weekday) => {
                const stretches = week[weekday];
                const slots = toSlots(stretches);
                return (
                  <li key={weekday} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
                    <div className="flex w-32 shrink-0 items-center justify-between gap-2 pt-1.5 sm:justify-start">
                      <span className="text-sm font-medium">{WEEKDAY_LONG[weekday]}</span>
                      {stretches.length > 0 && <span className="text-xs text-muted-foreground">{formatMinutes(dayMinutes(stretches))}</span>}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {stretches.length === 0 ? (
                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-sm text-muted-foreground">No hours</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addStretch(weekday)}>
                            <Plus className="size-3.5" />
                            Add hours
                          </Button>
                        </div>
                      ) : (
                        stretches.map((stretch, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2">
                            <span className="w-8 text-xs font-semibold text-success">IN</span>
                            <Input
                              type="time"
                              required
                              aria-label={`${WEEKDAY_LONG[weekday]} stretch ${i + 1} in`}
                              value={stretch.in}
                              onChange={(e) => updateStretch(weekday, i, { in: e.target.value })}
                              className="w-32"
                            />
                            <span className="text-muted-foreground">→</span>
                            <span className="w-9 text-xs font-semibold text-destructive">OUT</span>
                            <Input
                              type="time"
                              required
                              aria-label={`${WEEKDAY_LONG[weekday]} stretch ${i + 1} out`}
                              value={stretch.out}
                              onChange={(e) => updateStretch(weekday, i, { out: e.target.value })}
                              className="w-32"
                            />
                            {slots[i * 2 + 1]?.next_day && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-info/12 px-1.5 py-0.5 text-xs text-info">
                                <Moon className="size-3" />
                                next day
                              </span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove these hours"
                              onClick={() => setDay(weekday, stretches.filter((_, j) => j !== i))}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                      {stretches.length > 0 && stretches.length < 6 && (
                        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => addStretch(weekday)}>
                          <Plus className="size-3.5" />
                          Add a stretch (e.g. after lunch)
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ── Tolerances ── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Tolerances</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-late">Late after (min)</Label>
                <Input id="ws-late" type="number" min={0} max={240} value={lateGrace} onChange={(e) => setLateGrace(e.target.value)} />
                <p className="text-xs text-muted-foreground">Grace after each IN before it counts as late.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-early">Early leave allowance (min)</Label>
                <Input id="ws-early" type="number" min={0} max={240} value={earlyGrace} onChange={(e) => setEarlyGrace(e.target.value)} />
                <p className="text-xs text-muted-foreground">How early an OUT may be before it counts.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-break">Unpaid break (min)</Label>
                <Input
                  id="ws-break"
                  type="number"
                  min={0}
                  max={480}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  disabled={!singleStretchDays}
                />
                <p className="text-xs text-muted-foreground">
                  {singleStretchDays
                    ? "Taken off days with one IN/OUT, where people don't scan out for lunch."
                    : "Not needed: the gap between your stretches is the break."}
                </p>
              </div>
            </div>
            {singleStretchDays && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={breakPaid} onChange={(e) => setBreakPaid(e.target.checked)} className="size-4 rounded border-input" />
                The break is paid (counts as worked time)
              </label>
            )}
          </section>

          {/* ── Days off ── */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Suggested weekly days off</h3>
            <p className="-mt-1 text-xs text-muted-foreground">
              Pre-filled when you assign this schedule. Each person can have their own days off.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_ORDER.map((weekday) => (
                <button
                  key={weekday}
                  type="button"
                  aria-pressed={daysOff.includes(weekday)}
                  onClick={() => toggleDayOff(weekday)}
                  className={cn(
                    "h-8 w-12 rounded-md border text-sm font-medium transition-colors",
                    daysOff.includes(weekday) ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted",
                  )}
                >
                  {WEEKDAY_SHORT[weekday]}
                </button>
              ))}
            </div>
          </section>

          {/* ── Overtime ── */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Overtime</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {OVERTIME_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors",
                    overtimeMode === mode.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name="overtime-mode"
                      checked={overtimeMode === mode.value}
                      onChange={() => setOvertimeMode(mode.value)}
                      className="size-4"
                    />
                    {mode.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{mode.help}</span>
                </label>
              ))}
            </div>

            {overtimeMode !== "off" && (
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ws-ot-min">Ignore overtime shorter than (min)</Label>
                  <Input id="ws-ot-min" type="number" min={0} max={480} value={overtimeMin} onChange={(e) => setOvertimeMin(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ws-ot-round">Round overtime down to</Label>
                  <select id="ws-ot-round" value={overtimeRound} onChange={(e) => setOvertimeRound(e.target.value)} className={SELECT_CLASS}>
                    <option value="0">Exact minutes</option>
                    {[5, 10, 15, 30, 60].map((m) => (
                      <option key={m} value={m}>
                        {m === 60 ? "Whole hours" : `${m} minutes`}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={overtimeEarly} onChange={(e) => setOvertimeEarly(e.target.checked)} className="size-4 rounded border-input" />
                  Coming in before the first IN counts too
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overtimeApproval}
                    onChange={(e) => setOvertimeApproval(e.target.checked)}
                    className="size-4 rounded border-input"
                  />
                  A manager must approve it before it counts
                </label>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Work on a day off or a holiday is overtime in full, recorded as day-off or holiday overtime.
                </p>
              </div>
            )}
          </section>

          {schedule && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 rounded border-input" />
              Active — inactive schedules can&apos;t be newly assigned
            </label>
          )}

          {error && <Alert variant="destructive">{error}</Alert>}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : schedule ? "Save changes" : "Create schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
