import type { AttendanceDayStatus, AttendanceException, ScheduleSlot, WorkSchedule } from "@/lib/api";

/*
 * How work schedules and attendance read on screen, in one place, so every
 * page says "08:00–12:00 · 13:00–17:00" or "Missing OUT" the same way.
 */

// 0 = Sunday .. 6 = Saturday, like the API. The week is shown Monday first.
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** IN/OUT pairs as stretches of work: "08:00–12:00 · 13:00–17:00" ("06:00+1" when next day). */
export function slotsSummary(slots: ScheduleSlot[]): string {
  if (slots.length === 0) return "Off";
  const time = (slot: ScheduleSlot) => slot.time.slice(0, 5) + (slot.next_day ? "⁺¹" : "");
  const stretches: string[] = [];
  for (let i = 0; i + 1 < slots.length; i += 2) stretches.push(`${time(slots[i])}–${time(slots[i + 1])}`);
  return stretches.join(" · ");
}

/** "8h", "8h 30m", "45m", "0m". */
export function formatMinutes(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutes ?? 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Weekdays as text: "Sun", "Sat, Sun", "None". */
export function daysOffText(days: number[]): string {
  if (days.length === 0) return "None";
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/** The schedule's slots for a weekday. */
export function slotsOn(schedule: Pick<WorkSchedule, "days">, weekday: number): ScheduleSlot[] {
  return schedule.days.find((d) => d.weekday === weekday)?.slots ?? [];
}

/** A one-line description of a schedule's week: "Mon–Fri 08:00–17:00 · Sat 08:00–12:00". */
export function weekSummary(schedule: Pick<WorkSchedule, "days">): string {
  const groups: { days: number[]; text: string }[] = [];
  for (const weekday of WEEK_ORDER) {
    const text = slotsSummary(slotsOn(schedule, weekday));
    if (text === "Off") continue;
    const last = groups[groups.length - 1];
    const previous = WEEK_ORDER[WEEK_ORDER.indexOf(weekday) - 1];
    if (last && last.text === text && last.days[last.days.length - 1] === previous) last.days.push(weekday);
    else groups.push({ days: [weekday], text });
  }
  if (groups.length === 0) return "No working days";
  return groups
    .map((g) => {
      const label = g.days.length > 2 ? `${WEEKDAY_SHORT[g.days[0]]}–${WEEKDAY_SHORT[g.days[g.days.length - 1]]}` : g.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
      return `${label} ${g.text}`;
    })
    .join(" · ");
}

type Tone = "success" | "warning" | "destructive" | "info" | "secondary" | "outline";

export const DAY_STATUS: Record<AttendanceDayStatus, { label: string; tone: Tone }> = {
  upcoming: { label: "Not yet", tone: "outline" },
  in_progress: { label: "In progress", tone: "info" },
  complete: { label: "Complete", tone: "success" },
  incomplete: { label: "Incomplete", tone: "warning" },
  absent: { label: "Absent", tone: "destructive" },
  off: { label: "Off", tone: "secondary" },
  worked_off: { label: "Worked day off", tone: "info" },
  unscheduled: { label: "No schedule", tone: "outline" },
};

export const EXCEPTIONS: Record<AttendanceException, { label: string; tone: Tone }> = {
  late: { label: "Late", tone: "warning" },
  early_leave: { label: "Left early", tone: "warning" },
  missing_in: { label: "Missing IN", tone: "destructive" },
  missing_out: { label: "Missing OUT", tone: "destructive" },
  absent: { label: "Absent", tone: "destructive" },
  extra_scan: { label: "Extra scan", tone: "secondary" },
  worked_day_off: { label: "Worked day off", tone: "info" },
  worked_holiday: { label: "Worked holiday", tone: "info" },
  unscheduled_work: { label: "No schedule", tone: "secondary" },
  overtime_pending: { label: "Overtime to review", tone: "info" },
};

export const OVERTIME_TYPE: Record<"workday" | "day_off" | "holiday", string> = {
  workday: "Work day",
  day_off: "Day off",
  holiday: "Holiday",
};

/** HH:MM of an ISO time, read as written (the API sends the company's offset). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : iso;
}
