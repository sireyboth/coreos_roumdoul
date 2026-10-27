import type { AttendanceDayStatus, AttendanceException, ScheduleSlot, WorkSchedule } from "@/lib/api";
import { translate, type Lang } from "@/lib/i18n";

/*
 * How work schedules and attendance read on screen, in one place, so every
 * page says "08:00–12:00 · 13:00–17:00" or "Missing OUT" the same way.
 */

// 0 = Sunday .. 6 = Saturday, like the API. The week is shown Monday first.
// WEEKDAY_SHORT/LONG stay English: Excel imports match day names against them.
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** "Mon" / "ច" for a weekday (0 = Sunday), from calendar.shared.weekday. Exports leave `lang` out and stay English. */
export function weekdayShort(weekday: number, lang: Lang = "en"): string {
  return translate(lang, `calendar.shared.weekday.short.${DAY_KEYS[weekday]}`);
}

/** "Monday" / "ច័ន្ទ" for a weekday (0 = Sunday). */
export function weekdayLong(weekday: number, lang: Lang = "en"): string {
  return translate(lang, `calendar.shared.weekday.full.${DAY_KEYS[weekday]}`);
}

/** IN/OUT pairs as stretches of work: "08:00–12:00 · 13:00–17:00" ("06:00+1" when next day). */
export function slotsSummary(slots: ScheduleSlot[], lang: Lang = "en"): string {
  if (slots.length === 0) return translate(lang, "schedules.week.off");
  const time = (slot: ScheduleSlot) => slot.time.slice(0, 5) + (slot.next_day ? "⁺¹" : "");
  const stretches: string[] = [];
  for (let i = 0; i + 1 < slots.length; i += 2) stretches.push(`${time(slots[i])}–${time(slots[i + 1])}`);
  return stretches.join(" · ");
}

/** "8h", "8h 30m", "45m", "0m" — or "8 ម៉ោង 30 នាទី" in Khmer. Exports leave `lang` out and stay English. */
export function formatMinutes(minutes: number | null | undefined, lang: Lang = "en"): string {
  const total = Math.max(0, Math.round(minutes ?? 0));
  const hours = translate(lang, "common.time.hours", { n: Math.floor(total / 60) });
  const rest = translate(lang, "common.time.minutes", { n: total % 60 });
  if (total < 60) return rest;
  return total % 60 === 0 ? hours : `${hours} ${rest}`;
}

/** Weekdays as text: "Sun", "Sat, Sun", "None". */
export function daysOffText(days: number[], lang: Lang = "en"): string {
  if (days.length === 0) return translate(lang, "schedules.week.none");
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => weekdayShort(d, lang)).join(", ");
}

/** The schedule's slots for a weekday. */
export function slotsOn(schedule: Pick<WorkSchedule, "days">, weekday: number): ScheduleSlot[] {
  return schedule.days.find((d) => d.weekday === weekday)?.slots ?? [];
}

/** A one-line description of a schedule's week: "Mon–Fri 08:00–17:00 · Sat 08:00–12:00". */
export function weekSummary(schedule: Pick<WorkSchedule, "days">, lang: Lang = "en"): string {
  const groups: { days: number[]; text: string }[] = [];
  for (const weekday of WEEK_ORDER) {
    const slots = slotsOn(schedule, weekday);
    if (slots.length === 0) continue;
    const text = slotsSummary(slots, lang);
    const last = groups[groups.length - 1];
    const previous = WEEK_ORDER[WEEK_ORDER.indexOf(weekday) - 1];
    if (last && last.text === text && last.days[last.days.length - 1] === previous) last.days.push(weekday);
    else groups.push({ days: [weekday], text });
  }
  // Only an overtime-only schedule can have no hours at all.
  if (groups.length === 0) return translate(lang, "schedules.week.overtimeOnly");
  return groups
    .map((g) => {
      const label = g.days.length > 2 ? `${weekdayShort(g.days[0], lang)}–${weekdayShort(g.days[g.days.length - 1], lang)}` : g.days.map((d) => weekdayShort(d, lang)).join(", ");
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
