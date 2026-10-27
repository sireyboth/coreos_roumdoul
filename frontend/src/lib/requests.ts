import { parseDate } from "@/components/dashboard/calendar-shared";
import type { DayPart, EmployeeRequest, RequestStatus } from "@/lib/api";
import { dateLocale, translate, type Lang, type TKey } from "@/lib/i18n";

// The helpers take the screen's language (useLang()); without it they answer in English.

/** `label` is the English word; on screen use t(REQUEST_STATUS[s].key). */
export const REQUEST_STATUS: Record<RequestStatus, { label: string; key: TKey; tone: "warning" | "success" | "destructive" | "secondary" }> = {
  pending: { label: "Waiting", key: "leave.shared.status.pending", tone: "warning" },
  approved: { label: "Approved", key: "leave.shared.status.approved", tone: "success" },
  rejected: { label: "Rejected", key: "leave.shared.status.rejected", tone: "destructive" },
  cancelled: { label: "Cancelled", key: "leave.shared.status.cancelled", tone: "secondary" },
};

/** English words; on screen use t(DAY_PART_KEY[part]). */
export const DAY_PART_LABEL: Record<DayPart, string> = { full: "Full day", am: "Morning", pm: "Afternoon" };
export const DAY_PART_KEY: Record<DayPart, TKey> = { full: "leave.shared.dayPart.full", am: "leave.shared.dayPart.am", pm: "leave.shared.dayPart.pm" };

/** What the request is, in words: the leave type's name (company data, as sent), or "Late arrival" / "Early leave". */
export function requestLabel(r: Pick<EmployeeRequest, "type" | "label" | "details">, lang: Lang = "en"): string {
  if (r.type === "late_early" && r.details) return translate(lang, r.details.kind === "late" ? "leave.shared.kind.late" : "leave.shared.kind.early");
  return r.label;
}

/** "Mon 12 Oct". */
export const shortDate = (date: string, lang: Lang = "en") =>
  parseDate(date).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "numeric", month: "short" });

/** "Thu 8 Oct – Fri 9 Oct", or "Wed 14 Oct (morning)" for a half day. */
export function requestDates(r: Pick<EmployeeRequest, "start_date" | "end_date" | "day_part">, lang: Lang = "en"): string {
  if (r.start_date === r.end_date) {
    return r.day_part === "full"
      ? shortDate(r.start_date, lang)
      : translate(lang, "leave.shared.halfDay", { date: shortDate(r.start_date, lang), part: translate(lang, DAY_PART_KEY[r.day_part]).toLowerCase() });
  }
  return `${shortDate(r.start_date, lang)} – ${shortDate(r.end_date, lang)}`;
}

/** 1 → "1 day", 2.5 → "2.5 days". */
export function dayCount(days: number, lang: Lang = "en"): string {
  const n = Number.isInteger(days) ? String(days) : days.toFixed(1).replace(/\.0$/, "");
  return translate(lang, days === 1 ? "leave.shared.dayOne" : "leave.shared.dayOther", { n });
}

/** A short list of the dates themselves: "Thu 8, Fri 9, Tue 13 Oct". */
export function dateList(dates: { date: string }[], max = 8, lang: Lang = "en"): string {
  const shown = dates
    .slice(0, max)
    .map((d) => shortDate(d.date, lang))
    .join(", ");
  return dates.length > max ? translate(lang, "leave.shared.andMore", { list: shown, n: dates.length - max }) : shown;
}

/** The second line under the dates: "3 days", or "in at 09:00 · 60 min" for a late arrival. */
export function requestAmount(r: Pick<EmployeeRequest, "type" | "days" | "details">, lang: Lang = "en"): string {
  if (r.type === "late_early" && r.details) {
    const { time, minutes } = r.details;
    return translate(lang, r.details.kind === "late" ? "leave.shared.inAt" : "leave.shared.outAt", { time, minutes });
  }
  return dayCount(r.days, lang);
}
