import type { AttendanceReport } from "@/lib/excel-specs/time";
import type { TKey } from "@/lib/i18n";

/**
 * Numbers a reviewer needs from the attendance report: per person, how often
 * they were late, absent or missed a scan, as counts and as rates, plus the
 * day-by-day rows behind them. The Report tab's Late detail view, its
 * tiles and its Excel export all read from here.
 */

export type IssueKind = "late" | "early" | "missed" | "absent";

// `label` goes into the exported files (English); screens show t(key).
export const ISSUES: { kind: IssueKind; label: string; key: TKey }[] = [
  { kind: "late", label: "Late", key: "attendance.report.issue.late" },
  { kind: "early", label: "Early leave", key: "attendance.report.issue.early" },
  { kind: "missed", label: "Missed scan", key: "attendance.report.issue.missed" },
  { kind: "absent", label: "Absent", key: "attendance.report.issue.absent" },
];

export type ReportDay = {
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  dayType: string;
  status: string;
  schedule: string;
  /** The first expected IN and last expected OUT, HH:MM. */
  expectedIn: string | null;
  expectedOut: string | null;
  /** The first IN and last OUT scanned, HH:MM. */
  in: string | null;
  out: string | null;
  /** A scan on the day was added or changed by an admin or a correction. */
  edited: boolean;
  late: number;
  early: number;
  note: string;
  leave: string;
  /** Which of the issues the day has (late ignores the minimum set by the reviewer). */
  issues: IssueKind[];
  /** Counted as a scheduled work day: present, late, incomplete or absent. */
  workDay: boolean;
};

export type PersonInsight = {
  key: string;
  /** The internal employee id, when the report was asked for with ids. */
  employeeId: number | null;
  code: string;
  name: string;
  branch: string;
  department: string;
  days: ReportDay[];
  workDays: number;
  /** Days they came in at all (not absent). */
  attended: number;
  lateDays: number;
  lateMinutes: number;
  longestLate: number;
  earlyDays: number;
  earlyMinutes: number;
  missedDays: number;
  absentDays: number;
  leaveDays: number;
  /** Late days ÷ days attended, 0–100. */
  latePct: number;
  /** Absent days ÷ work days, 0–100. */
  absencePct: number;
  /**
   * Bradford score: separate absence spells² × days absent. Many short
   * absences score far higher than one long one — a prompt for a
   * conversation, not a verdict.
   */
  bradford: number;
  /** The weekday most lates fall on, when there's a clear pattern. */
  lateWeekday: { weekday: number; count: number } | null;
};

export type ReportTotals = {
  people: number;
  workDays: number;
  attended: number;
  lateDays: number;
  lateMinutes: number;
  missedDays: number;
  absentDays: number;
  leaveDays: number;
  latePct: number;
  absencePct: number;
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** "IN 08:30, OUT 17:30 (adjusted)" → the first IN and last OUT, and whether any was edited. */
function ends(text: string): { in: string | null; out: string | null; edited: boolean } {
  let first: string | null = null;
  let last: string | null = null;
  for (const part of text.split(",")) {
    const match = /^\s*(IN|OUT)\s+(\d{1,2}:\d{2})/i.exec(part);
    if (!match) continue;
    if (match[1].toUpperCase() === "IN") first ??= match[2];
    else last = match[2];
  }
  return { in: first, out: last, edited: /\((adjusted|correction)\)/.test(text) };
}

/**
 * The report as people with their numbers. `minLate` ignores lateness under
 * that many minutes (a few minutes' drift), in the counts and the rates.
 */
export function buildInsights(report: AttendanceReport, minLate = 1): PersonInsight[] {
  const { header, rows } = report;
  const col = (title: string) => header.indexOf(title);
  const c = {
    code: col("Employee ID"), name: col("Employee"), branch: col("Branch"), department: col("Department"),
    date: col("Date"), dayType: col("Day type"), leave: col("Leave / holiday"), schedule: col("Schedule"),
    expected: col("Expected"), scans: col("Scans"), late: col("Late (min)"), early: col("Early leave (min)"),
    status: col("Status"), note: col("Note"), key: col("Employee key"),
  };
  const at = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "") : "");

  const people = new Map<string, PersonInsight>();
  for (const row of rows) {
    const key = at(row, c.code) || at(row, c.name);
    let person = people.get(key);
    if (!person) {
      const id = Number(at(row, c.key));
      person = {
        key, employeeId: Number.isFinite(id) && id > 0 ? id : null,
        code: at(row, c.code), name: at(row, c.name), branch: at(row, c.branch), department: at(row, c.department),
        days: [], workDays: 0, attended: 0, lateDays: 0, lateMinutes: 0, longestLate: 0, earlyDays: 0, earlyMinutes: 0,
        missedDays: 0, absentDays: 0, leaveDays: 0, latePct: 0, absencePct: 0, bradford: 0, lateWeekday: null,
      };
      people.set(key, person);
    }

    const date = at(row, c.date);
    const status = at(row, c.status);
    const expected = ends(at(row, c.expected));
    const scanned = ends(at(row, c.scans));
    const late = Number(at(row, c.late)) || 0;
    const early = Number(at(row, c.early)) || 0;
    const workDay = ["Complete", "In progress", "Incomplete", "Absent"].includes(status);

    const issues: IssueKind[] = [];
    if (late > 0) issues.push("late");
    if (early > 0) issues.push("early");
    if (status === "Incomplete") issues.push("missed");
    if (status === "Absent") issues.push("absent");

    person.days.push({
      date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), dayType: at(row, c.dayType), status,
      schedule: at(row, c.schedule), expectedIn: expected.in, expectedOut: expected.out,
      in: scanned.in, out: scanned.out, edited: scanned.edited, late, early,
      note: at(row, c.note), leave: at(row, c.leave), issues, workDay,
    });
  }

  for (const person of people.values()) {
    person.days.sort((a, b) => a.date.localeCompare(b.date));
    const byWeekday = new Array(7).fill(0);
    let spells = 0;
    let previousAbsent = false;

    for (const day of person.days) {
      // A whole day on leave, or half of a work day ("Annual leave (am)").
      if (day.dayType === "Leave") person.leaveDays += 1;
      else if (day.dayType === "Work" && /\((am|pm|morning|afternoon)\)$/.test(day.leave)) person.leaveDays += 0.5;
      if (!day.workDay) continue;

      person.workDays++;
      if (day.status === "Absent") {
        person.absentDays++;
        // Absent days with only days off between them are one spell.
        if (!previousAbsent) spells++;
        previousAbsent = true;
        continue;
      }
      previousAbsent = false;
      person.attended++;

      if (day.late >= minLate) {
        person.lateDays++;
        person.lateMinutes += day.late;
        person.longestLate = Math.max(person.longestLate, day.late);
        byWeekday[day.weekday]++;
      }
      if (day.early > 0) {
        person.earlyDays++;
        person.earlyMinutes += day.early;
      }
      if (day.status === "Incomplete") person.missedDays++;
    }

    person.latePct = pct(person.lateDays, person.attended);
    person.absencePct = pct(person.absentDays, person.workDays);
    person.bradford = spells * spells * person.absentDays;

    // A pattern is at least 3 lates, 40% or more of them on the same weekday.
    const top = byWeekday.reduce((best, count, weekday) => (count > byWeekday[best] ? weekday : best), 0);
    if (byWeekday[top] >= 3 && byWeekday[top] / person.lateDays >= 0.4) {
      person.lateWeekday = { weekday: top, count: byWeekday[top] };
    }
  }

  return [...people.values()];
}

export function totalsOf(people: PersonInsight[]): ReportTotals {
  const sum = (pick: (p: PersonInsight) => number) => people.reduce((n, p) => n + pick(p), 0);
  const workDays = sum((p) => p.workDays);
  const attended = sum((p) => p.attended);
  const lateDays = sum((p) => p.lateDays);
  const absentDays = sum((p) => p.absentDays);
  return {
    people: people.length,
    workDays,
    attended,
    lateDays,
    lateMinutes: sum((p) => p.lateMinutes),
    missedDays: sum((p) => p.missedDays),
    absentDays,
    leaveDays: sum((p) => p.leaveDays),
    latePct: pct(lateDays, attended),
    absencePct: pct(absentDays, workDays),
  };
}

/** The days a reviewer asked to see: any of the chosen issues, with lateness from `minLate` minutes. */
export function daysWith(person: PersonInsight, kinds: IssueKind[], minLate: number): ReportDay[] {
  return person.days.filter((day) =>
    day.issues.some((issue) => kinds.includes(issue) && (issue !== "late" || day.late >= minLate)),
  );
}

/** Minutes as "1h 05m" / "35m". */
export function duration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
