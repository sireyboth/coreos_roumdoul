import type { ProbationSettings } from "@/lib/api";
import { dateOnly } from "@/lib/date";

/** Today on this device, as YYYY-MM-DD. */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The last day of probation for someone hired on `hireDate`, the same way
 * Company::probationEndFor works it out: 3 months from 1 Oct ends on 31 Dec,
 * 60 days from 1 Oct ends on 29 Nov. Null without a hire date or a length.
 */
export function defaultProbationEnd(hireDate: string, settings: ProbationSettings | null | undefined): string | null {
  if (!hireDate || !settings?.probation_length) return null;
  const [y, m, d] = dateOnly(hireDate).split("-").map(Number);
  let end: Date;
  if (settings.probation_unit === "days") {
    end = new Date(Date.UTC(y, m - 1, d + settings.probation_length));
  } else {
    // Months without overflow: 31 Jan + 1 month is 28/29 Feb, not 3 Mar.
    const target = new Date(Date.UTC(y, m - 1 + settings.probation_length, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
  }
  end.setUTCDate(end.getUTCDate() - 1);
  return toIso(end);
}

/** Whole days from today to `date`: 0 today, negative once it has passed. */
export function daysUntil(date: string): number {
  const [y, m, d] = dateOnly(date).split("-").map(Number);
  const [ty, tm, td] = localToday().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/** How far through probation they are, 0–1 (1 once it has ended). */
export function probationProgress(hireDate: string | null | undefined, endDate: string): number | null {
  if (!hireDate) return null;
  const start = Date.parse(dateOnly(hireDate));
  const end = Date.parse(dateOnly(endDate)) + 86_400_000;
  const now = Date.parse(localToday());
  if (end <= start) return null;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
