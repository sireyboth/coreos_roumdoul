"use client";

import { useMemo, useState } from "react";
import { AlarmClock, CalendarClock, Clock, Copy, FileText, Moon, Plus, Timer, X, CircleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, type OvertimeMode, type ScheduleSlot, type WorkSchedule, type WorkScheduleInput } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatMinutes, slotsOn, WEEK_ORDER, weekdayLong, weekdayShort } from "@/lib/schedule";
import { translateNow, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DisplayOrderField, fromSortOrder, toSortOrder } from "@/components/dashboard/shared/display-order";
import { ChoiceCards, FormField, FormSection, ToggleRow } from "@/components/dashboard/shared/form-section";

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

// Labels are schedules.form.mode.<value> and schedules.form.mode.<value>Help.
const OVERTIME_MODES: OvertimeMode[] = ["off", "after_last_out", "above_scheduled"];

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
  const t = useT();
  const lang = useLang();
  const [name, setName] = useState(schedule?.name ?? "");
  const [description, setDescription] = useState(schedule?.description ?? "");
  const [active, setActive] = useState(schedule?.is_active ?? true);
  const [autoAttendance, setAutoAttendance] = useState(schedule?.auto_attendance ?? false);
  const [sortOrder, setSortOrder] = useState(fromSortOrder(schedule?.sort_order));
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
  // No hours on any day: an overtime-only schedule, for one-day holiday overrides.
  const noHours = WEEK_ORDER.every((d) => week[d].length === 0);

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

    if (noHours && overtimeMode === "off") {
      setError(t("schedules.form.needHours"));
      return;
    }

    const payload: WorkScheduleInput = {
      name,
      description: description || null,
      is_active: active,
      auto_attendance: autoAttendance,
      sort_order: toSortOrder(sortOrder),
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
        notifySuccess(translateNow("schedules.form.updated"), translateNow("schedules.form.updatedHint"));
      } else {
        await api.workSchedules.create(payload);
        notifySuccess(translateNow("schedules.form.created"));
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? (err.errors ? Object.values(err.errors)[0][0] : err.message) : translateNow("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }


  /** The working-day switch: on gives the day standard hours, off makes it a day without hours. */
  function toggleWorking(weekday: number, working: boolean) {
    if (working) addStretch(weekday);
    else setDay(weekday, []);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,920px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border px-5 py-4 pr-12 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500 text-white shadow-sm">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{schedule ? t("schedules.form.titleEdit", { name: schedule.name }) : t("schedules.form.titleNew")}</DialogTitle>
            <DialogDescription>{t("schedules.form.description")}</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              {/* 1. Basics. */}
              <FormSection icon={FileText} tone="from-sky-500 to-indigo-500" title={t("schedules.form.basicsTitle")} hint={t("schedules.form.basicsHint")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="ws-name" label={t("schedules.form.name")}>
                    <Input id="ws-name" required placeholder={t("schedules.form.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
                  </FormField>
                  <FormField id="ws-description" label={t("schedules.form.descriptionLabel")}>
                    <Input id="ws-description" placeholder={t("schedules.form.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </FormField>
                </div>
                <ToggleRow id="ws-auto" label={t("schedules.form.auto")} hint={t("schedules.form.autoHint")} checked={autoAttendance} onChange={setAutoAttendance} />
                {schedule && <ToggleRow id="ws-active" label={t("schedules.form.active")} hint={t("schedules.form.activeHint")} checked={active} onChange={setActive} />}
                <DisplayOrderField id="ws-order" value={sortOrder} onChange={setSortOrder} example={t("schedules.form.orderExample")} />
              </FormSection>

              {/* 2. Working hours, day by day. */}
              <FormSection
                icon={Clock}
                tone="from-amber-500 to-orange-500"
                title={t("schedules.form.hours")}
                hint={t("schedules.form.hoursHint")}
                aside={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-semibold tabular-nums">
                    <Timer className="size-4 text-amber-500" />
                    {t("schedules.form.weekTotal", { time: formatMinutes(weeklyMinutes, lang) })}
                  </span>
                }
              >
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={copyMondayToAll} disabled={week[1].length === 0}>
                    <Copy className="size-3.5" />
                    {t("schedules.form.copyMonday")}
                  </Button>
                </div>

                {noHours && (
                  <Alert variant={overtimeMode === "off" ? "warning" : "info"} title={t("schedules.form.overtimeOnlyTitle")}>
                    {overtimeMode === "off" ? t("schedules.form.overtimeOnlyOff") : t("schedules.form.overtimeOnlyOn")}
                  </Alert>
                )}

                <ul className="flex flex-col gap-2">
                  {WEEK_ORDER.map((weekday) => {
                    const stretches = week[weekday];
                    const slots = toSlots(stretches);
                    const working = stretches.length > 0;
                    const day = weekdayLong(weekday, lang);
                    return (
                      <li
                        key={weekday}
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-start",
                          working ? "border-border bg-card" : "border-dashed border-border bg-transparent",
                        )}
                      >
                        <div className="flex w-full shrink-0 items-center gap-2.5 pt-1 sm:w-44">
                          <Switch checked={working} onCheckedChange={(on) => toggleWorking(weekday, on)} aria-label={t("schedules.form.dayWorking", { day })} />
                          <span className={cn("text-sm font-medium", !working && "text-muted-foreground")}>{day}</span>
                          {working && <span className="ml-auto text-xs text-muted-foreground tabular-nums sm:ml-0">{formatMinutes(dayMinutes(stretches), lang)}</span>}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          {!working ? (
                            <span className="pt-1.5 text-sm text-muted-foreground">{t("schedules.form.noHours")}</span>
                          ) : (
                            stretches.map((stretch, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-success/12 px-1.5 py-0.5 text-xs font-semibold text-success">{t("schedules.form.in")}</span>
                                <Input
                                  type="time"
                                  required
                                  aria-label={t("schedules.form.stretchIn", { day, n: i + 1 })}
                                  value={stretch.in}
                                  onChange={(e) => updateStretch(weekday, i, { in: e.target.value })}
                                  className="w-30"
                                />
                                <span className="text-muted-foreground">→</span>
                                <span className="rounded bg-destructive/12 px-1.5 py-0.5 text-xs font-semibold text-destructive">{t("schedules.form.out")}</span>
                                <Input
                                  type="time"
                                  required
                                  aria-label={t("schedules.form.stretchOut", { day, n: i + 1 })}
                                  value={stretch.out}
                                  onChange={(e) => updateStretch(weekday, i, { out: e.target.value })}
                                  className="w-30"
                                />
                                {slots[i * 2 + 1]?.next_day && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-info/12 px-1.5 py-0.5 text-xs text-info">
                                    <Moon className="size-3" />
                                    {t("schedules.form.nextDay")}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("schedules.form.removeHours")}
                                  onClick={() => setDay(weekday, stretches.filter((_, j) => j !== i))}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            ))
                          )}
                          {working && stretches.length < 6 && (
                            <Button type="button" variant="ghost" size="sm" className="self-start text-primary" onClick={() => addStretch(weekday)}>
                              <Plus className="size-3.5" />
                              {t("schedules.form.addStretch")}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Suggested weekly days off (pre-filled when assigning). */}
                <div className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{t("schedules.form.daysOff")}</p>
                    <p className="text-xs text-muted-foreground">{t("schedules.form.daysOffHint")}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_ORDER.map((weekday) => (
                      <button
                        key={weekday}
                        type="button"
                        aria-pressed={daysOff.includes(weekday)}
                        onClick={() => toggleDayOff(weekday)}
                        className={cn(
                          "h-9 min-w-12 rounded-full border px-3 text-sm font-medium transition-colors",
                          daysOff.includes(weekday) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                        )}
                      >
                        {weekdayShort(weekday, lang)}
                      </button>
                    ))}
                  </div>
                </div>
              </FormSection>

              {/* 3. Late, early leave and break. */}
              <FormSection icon={AlarmClock} tone="from-rose-500 to-pink-500" title={t("schedules.form.tolerances")} hint={t("schedules.form.tolerancesHint")}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="ws-late" label={t("schedules.form.late")} hint={t("schedules.form.lateHint")}>
                    <Input id="ws-late" type="number" min={0} max={240} value={lateGrace} onChange={(e) => setLateGrace(e.target.value)} />
                  </FormField>
                  <FormField id="ws-early" label={t("schedules.form.early")} hint={t("schedules.form.earlyHint")}>
                    <Input id="ws-early" type="number" min={0} max={240} value={earlyGrace} onChange={(e) => setEarlyGrace(e.target.value)} />
                  </FormField>
                  <FormField id="ws-break" label={t("schedules.form.break")} hint={singleStretchDays ? t("schedules.form.breakHint") : t("schedules.form.breakNotNeeded")}>
                    <Input
                      id="ws-break"
                      type="number"
                      min={0}
                      max={480}
                      value={breakMinutes}
                      onChange={(e) => setBreakMinutes(e.target.value)}
                      disabled={!singleStretchDays}
                    />
                  </FormField>
                </div>
                {singleStretchDays && <ToggleRow id="ws-break-paid" label={t("schedules.form.breakPaid")} checked={breakPaid} onChange={setBreakPaid} />}
              </FormSection>

              {/* 4. Overtime. */}
              <FormSection icon={Moon} tone="from-violet-500 to-fuchsia-500" title={t("schedules.form.overtime")} hint={t("schedules.form.overtimeHint")}>
                <ChoiceCards
                  name="overtime-mode"
                  value={overtimeMode}
                  onChange={setOvertimeMode}
                  options={OVERTIME_MODES.map((mode) => ({
                    value: mode,
                    label: t(`schedules.form.mode.${mode}`),
                    help: t(`schedules.form.mode.${mode}Help`),
                  }))}
                />

                {overtimeMode !== "off" && (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField id="ws-ot-min" label={t("schedules.form.ignoreShorter")}>
                        <Input id="ws-ot-min" type="number" min={0} max={480} value={overtimeMin} onChange={(e) => setOvertimeMin(e.target.value)} />
                      </FormField>
                      <FormField id="ws-ot-round" label={t("schedules.form.roundDown")}>
                        <select id="ws-ot-round" value={overtimeRound} onChange={(e) => setOvertimeRound(e.target.value)} className={SELECT_CLASS}>
                          <option value="0">{t("schedules.form.exactMinutes")}</option>
                          {[5, 10, 15, 30, 60].map((m) => (
                            <option key={m} value={m}>
                              {m === 60 ? t("schedules.form.wholeHours") : t("schedules.form.minutes", { n: m })}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <ToggleRow id="ws-ot-early" label={t("schedules.form.countEarly")} checked={overtimeEarly} onChange={setOvertimeEarly} />
                    <ToggleRow id="ws-ot-approval" label={t("schedules.form.needsApproval")} checked={overtimeApproval} onChange={setOvertimeApproval} />
                    <p className="text-xs text-muted-foreground">{t("schedules.form.dayOffNote")}</p>
                  </div>
                )}
              </FormSection>
            </div>
          </div>

          {/* Footer: always in view, so Save is never a scroll away. */}
          <div className="flex items-center justify-end gap-3 border-t border-border bg-popover px-5 py-3">
            {/* The error sits next to Save, so it's seen right where the click happened. */}
            {error && (
              <p role="alert" className="mr-auto flex min-w-0 items-start gap-1.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="line-clamp-2">{error}</span>
              </p>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : schedule ? t("common.action.saveChanges") : t("schedules.form.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
