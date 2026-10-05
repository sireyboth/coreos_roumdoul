import { parseDate } from "@/components/dashboard/calendar-shared";
import type { DayPart, EmployeeRequest, RequestStatus } from "@/lib/api";

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: "warning" | "success" | "destructive" | "secondary" }> = {
  pending: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "secondary" },
};

export const DAY_PART_LABEL: Record<DayPart, string> = { full: "Full day", am: "Morning", pm: "Afternoon" };

const short = (date: string) => parseDate(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** "Thu 8 Oct – Fri 9 Oct", or "Wed 14 Oct (morning)" for a half day. */
export function requestDates(r: Pick<EmployeeRequest, "start_date" | "end_date" | "day_part">): string {
  if (r.start_date === r.end_date) {
    return short(r.start_date) + (r.day_part === "full" ? "" : ` (${DAY_PART_LABEL[r.day_part].toLowerCase()})`);
  }
  return `${short(r.start_date)} – ${short(r.end_date)}`;
}

/** 1 → "1 day", 2.5 → "2.5 days". */
export function dayCount(days: number): string {
  const n = Number.isInteger(days) ? String(days) : days.toFixed(1).replace(/\.0$/, "");
  return `${n} ${days === 1 ? "day" : "days"}`;
}

/** A short list of the dates themselves: "Thu 8, Fri 9, Tue 13 Oct". */
export function dateList(dates: { date: string }[], max = 8): string {
  const shown = dates.slice(0, max).map((d) => short(d.date));
  return shown.join(", ") + (dates.length > max ? ` and ${dates.length - max} more` : "");
}

/** The second line under the dates: "3 days", or "in at 09:00 · 60 min" for a late arrival. */
export function requestAmount(r: Pick<EmployeeRequest, "type" | "days" | "details">): string {
  if (r.type === "late_early" && r.details) {
    return `${r.details.kind === "late" ? "in at" : "out at"} ${r.details.time} · ${r.details.minutes} min`;
  }
  return dayCount(r.days);
}
