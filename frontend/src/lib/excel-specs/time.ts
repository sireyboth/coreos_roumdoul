import {
  api,
  ApiError,
  type AttendanceSummary,
  type CalendarDay,
  type Employee,
  type Holiday,
  type OvertimeMode,
  type Schedule,
  type ScheduleAssignment,
  type ScheduleSlot,
  type WorkLocation,
  type WorkSchedule,
  type WorkScheduleInput,
} from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { downloadSheet, today, type SheetColumn } from "@/lib/excel";
import { Lookup, Row, RowError, yesNo, type ImportField, type ImportSpec } from "@/lib/excel-import";
import { daysOffText, formatMinutes, slotsOn, slotsSummary, WEEK_ORDER, WEEKDAY_SHORT } from "@/lib/schedule";

/*
 * Excel import/export for time and attendance: work schedules, holidays, the
 * roster, days off, attendance records, correction requests, the calendar and
 * the monthly summary payroll reads.
 */

const WEEKDAY = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// ───────────────────── Picking an employee by ID or name ─────────────────────

/** Rows that point at a person accept their Employee ID, their name, or both. */
const EMPLOYEE_FIELDS: ImportField[] = [
  { key: "employee_code", header: "Employee ID", hint: "Employee ID. Fill this in, or Employee (the name), or both.", example: "E-0001" },
  { key: "employee", header: "Employee", hint: "The employee's full name — used when there is no Employee ID.", example: "Sok Dara" },
];

type EmployeeLookups = { byCode: Lookup<Employee>; byName: Lookup<Employee> };

async function employeeLookups(): Promise<EmployeeLookups> {
  const employees = await api.employees.all();
  return {
    byCode: new Lookup(employees, [(e) => e.employee_code], "employee with the ID"),
    byName: new Lookup(employees, [(e) => e.name], "employee"),
  };
}

function findEmployee(row: Row, lookups: EmployeeLookups): Employee {
  const code = row.text("employee_code");
  const name = row.text("employee");
  if (code) return lookups.byCode.require(code);
  if (name) return lookups.byName.require(name);
  throw new RowError("Fill in the Employee ID or the Employee name.");
}

// ─────────────────────────── Work schedules ──────────────────────────
//
// One row per schedule, one column per weekday holding that day's hours as
// text — "08:00-12:00, 13:00-17:00", or "Off" / blank — so a schedule reads
// in Excel the way people describe it.

const OVERTIME_OPTIONS: { value: OvertimeMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "after_last_out", label: "After last OUT" },
  { value: "above_scheduled", label: "Above scheduled hours" },
];

/** A day's slots as "08:00-12:00, 13:00-17:00" (the reverse of parseHours). */
function hoursText(slots: ScheduleSlot[]): string {
  if (slots.length === 0) return "Off";
  const parts: string[] = [];
  for (let i = 0; i + 1 < slots.length; i += 2) parts.push(`${slots[i].time.slice(0, 5)}-${slots[i + 1].time.slice(0, 5)}`);
  return parts.join(", ");
}

/**
 * "08:00-12:00, 13:00-17:00" → slots. Each stretch is IN-OUT; a time earlier
 * than the one before it is the next morning (night shifts). "Off" or blank
 * means no hours that day.
 */
function parseHours(text: string, weekday: string): ScheduleSlot[] {
  const value = text.trim();
  if (value === "" || /^(off|-|none|day off)$/i.test(value)) return [];

  const slots: ScheduleSlot[] = [];
  let previous = -1;
  let nextDay = false;

  for (const stretch of value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    const match = /^(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})$/.exec(stretch);
    if (!match) throw new RowError(`${weekday}: "${stretch}" isn't a time range like 08:00-12:00.`);

    for (const [type, h, m] of [["in", match[1], match[2]], ["out", match[3], match[4]]] as const) {
      const hours = Number(h);
      const minutes = Number(m);
      if (hours > 23 || minutes > 59) throw new RowError(`${weekday}: "${stretch}" has an impossible time.`);
      const total = hours * 60 + minutes;
      if (previous >= 0 && total <= previous) nextDay = true;
      previous = total;
      slots.push({ type, time: `${String(hours).padStart(2, "0")}:${m}`, next_day: nextDay });
    }
  }

  return slots;
}

/** "Sat, Sun" (or "Saturday, Sunday") → [6, 0]. "None" → no days off. */
function parseDaysOff(text: string, column: string): number[] {
  if (/^(none|no|-)$/i.test(text.trim())) return [];
  return text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((name) => {
      const index = WEEKDAY_SHORT.findIndex((d) => d.toLowerCase() === name.slice(0, 3).toLowerCase());
      if (index < 0) throw new RowError(`"${name}" in ${column} isn't a weekday.`);
      return index;
    });
}

/** For the import review: the problem with a days-off cell, or null. */
function daysOffProblem(text: string, column: string): string | null {
  try {
    parseDaysOff(text, column);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Not a list of weekdays.";
  }
}

export async function exportWorkSchedules(): Promise<string> {
  const filename = `work-schedules-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Work schedules",
    rows: await api.workSchedules.list(),
    columns: [
      { header: "Name", value: (s) => s.name },
      { header: "Display order", value: (s) => s.sort_order, type: "number" },
      ...WEEK_ORDER.map((weekday) => ({
        header: WEEKDAY_SHORT[weekday],
        value: (s: WorkSchedule) => hoursText(slotsOn(s, weekday)),
        width: 24,
      })),
      { header: "Late after (min)", value: (s) => s.late_grace_minutes, type: "number" },
      { header: "Early leave allowance (min)", value: (s) => s.early_leave_grace_minutes, type: "number" },
      { header: "Unpaid break (min)", value: (s) => (s.is_break_paid ? 0 : s.break_minutes), type: "number" },
      { header: "Usual days off", value: (s) => daysOffText(s.default_days_off) },
      { header: "Overtime", value: (s) => OVERTIME_OPTIONS.find((o) => o.value === s.overtime_mode)?.label },
      { header: "Ignore overtime under (min)", value: (s) => s.overtime_min_minutes, type: "number" },
      { header: "Overtime needs approval", value: (s) => yesNo(s.overtime_requires_approval) },
      { header: "Hours per week", value: (s) => formatMinutes(s.weekly_minutes) },
      { header: "People", value: (s) => s.assigned_count ?? 0, type: "number" },
      { header: "Active", value: (s) => yesNo(s.is_active) },
      { header: "Description", value: (s) => s.description },
    ],
  });
  return filename;
}

const HOURS_HINT = 'Hours as IN-OUT ranges, e.g. "08:00-17:00" or a split shift "08:00-12:00, 13:00-17:00". "Off" or blank = no hours.';

export const workScheduleImport: ImportSpec<{ schedules: Lookup<WorkSchedule> }> = {
  noun: { one: "work schedule", many: "work schedules" },
  templateFile: "work-schedules",
  matching: "A row whose Name matches an existing schedule updates it — its hours are replaced by the row's.",
  notes: [
    "Each weekday column holds that day's hours. Add as many IN-OUT ranges as needed, separated by commas.",
    "A range ending earlier than it starts (22:00-06:00) is a night shift ending the next morning.",
    "Usual days off is a list like \"Sun\" or \"Sat, Sun\" — it's pre-filled when the schedule is assigned.",
  ],
  fields: [
    { key: "name", header: "Name", required: true, hint: "The schedule's name.", example: "Split shift" },
    { key: "sort_order", header: "Display order", type: "number", hint: "Optional. Lowest is listed first, e.g. 1 for the most used schedule.", example: "1" },
    ...WEEK_ORDER.map((weekday) => ({
      key: `day_${weekday}`,
      header: WEEKDAY_SHORT[weekday],
      hint: HOURS_HINT,
      example: weekday === 0 ? "Off" : "08:00-12:00, 13:00-17:00",
      // Checked while reviewing, so a typo is flagged before anything is saved.
      validate: (text: string) => {
        try {
          parseHours(text, WEEKDAY_SHORT[weekday]);
          return null;
        } catch (err) {
          return err instanceof Error ? err.message : "Not a valid list of hours.";
        }
      },
    })),
    { key: "late_grace_minutes", header: "Late after (min)", type: "integer", hint: "Grace after each IN before it counts as late.", example: "5" },
    { key: "early_leave_grace_minutes", header: "Early leave allowance (min)", type: "integer", hint: "How early an OUT may be before it counts.", example: "0" },
    { key: "break_minutes", header: "Unpaid break (min)", type: "integer", hint: "Only used on days with a single IN-OUT range.", example: "60" },
    { key: "days_off", header: "Usual days off", hint: 'e.g. "Sun" or "Sat, Sun".', example: "Sun", validate: (t) => daysOffProblem(t, "Usual days off") },
    { key: "overtime_mode", header: "Overtime", options: OVERTIME_OPTIONS, hint: "How overtime is counted.", example: "After last OUT" },
    { key: "overtime_min_minutes", header: "Ignore overtime under (min)", type: "integer", hint: "Shorter overtime is ignored.", example: "30" },
    { key: "overtime_requires_approval", header: "Overtime needs approval", type: "boolean", hint: "Yes: a manager must approve it.", example: "Yes" },
    { key: "is_active", header: "Active", type: "boolean", hint: "Yes or No. New schedules are active.", example: "Yes" },
    { key: "description", header: "Description", hint: "Optional." },
  ],
  load: async () => ({ schedules: new Lookup(await api.workSchedules.list(), [(s) => s.name], "work schedule") }),
  save: async (row, ctx) => {
    const payload: WorkScheduleInput = row.pick(
      "name", "late_grace_minutes", "early_leave_grace_minutes", "break_minutes", "overtime_mode",
      "overtime_min_minutes", "overtime_requires_approval", "is_active", "description", "sort_order",
    ) as WorkScheduleInput;

    const anyDay = WEEK_ORDER.some((d) => row.has(`day_${d}`));
    if (anyDay) {
      payload.days = WEEK_ORDER.map((d) => ({ weekday: d, slots: parseHours(row.text(`day_${d}`) ?? "", WEEKDAY_SHORT[d]) })).filter(
        (day) => day.slots.length > 0,
      );
    }

    const daysOff = row.text("days_off");
    if (daysOff !== undefined) payload.default_days_off = parseDaysOff(daysOff, "Usual days off");

    const existing = ctx.schedules.find(row.text("name"));
    if (existing) {
      ctx.schedules.put(await api.workSchedules.update(existing.id, payload));
      return "updated";
    }

    if (!payload.days || payload.days.length === 0) throw new RowError("A new schedule needs hours on at least one weekday.");
    ctx.schedules.add(await api.workSchedules.create(payload));
    return "created";
  },
};

// ───────────────────────── Schedule assignments ──────────────────────
//
// Who follows which schedule, from when. Importing goes through the same
// rules as the Assign dialog: a new start date takes over from the schedule
// running then, and a row with an end date is temporary.

const ASSIGNMENT_STATE: Record<string, string> = { current: "Current", upcoming: "Upcoming", ended: "Ended" };

export async function exportAssignments(): Promise<string> {
  const filename = `schedule-assignments-${today()}.xlsx`;
  const rows = (await api.scheduleAssignments.list()).sort(
    (a, b) => (a.employee?.name ?? "").localeCompare(b.employee?.name ?? "") || a.effective_from.localeCompare(b.effective_from),
  );

  await downloadSheet(filename, {
    name: "Assignments",
    rows,
    columns: [
      { header: "Employee ID", value: (a) => a.employee?.employee_code },
      { header: "Employee", value: (a) => a.employee?.name },
      { header: "Work schedule", value: (a) => a.work_schedule?.name },
      { header: "From", value: (a) => a.effective_from, type: "date" },
      { header: "To", value: (a) => a.effective_to, type: "date" },
      { header: "Days off", value: (a) => daysOffText(a.days_off) },
      { header: "State", value: (a) => (a.state ? ASSIGNMENT_STATE[a.state] : null) },
      { header: "Notes", value: (a) => a.notes },
    ],
  });
  return filename;
}

type AssignmentCtx = EmployeeLookups & {
  schedules: Lookup<WorkSchedule>;
  // "employeeId|from" → existing assignment, so a re-imported row updates instead of duplicating.
  existing: Map<string, ScheduleAssignment>;
};

export const assignmentImport: ImportSpec<AssignmentCtx> = {
  noun: { one: "assignment", many: "assignments" },
  templateFile: "schedule-assignments",
  matching:
    "A row for an employee with the same From date as an existing assignment updates it. Otherwise it starts a new one: from that date it replaces the schedule they had.",
  notes: [
    "Leave To empty for an ongoing schedule. With a To date it's temporary — afterwards they go back to their usual schedule.",
    'Days off is a list like "Sun" or "Sat, Sun" ("None" for no days off). Left empty, the schedule\'s usual days off are used.',
    "Days already worked in the period are re-checked against the new schedule; locked months can't be changed.",
  ],
  fields: [
    ...EMPLOYEE_FIELDS,
    { key: "work_schedule", header: "Work schedule", required: true, hint: "One of your work schedules, by name.", example: "Split shift" },
    { key: "effective_from", header: "From", type: "date", required: true, hint: "The first day, YYYY-MM-DD.", example: "2026-10-15" },
    { key: "effective_to", header: "To", type: "date", hint: "The last day, YYYY-MM-DD. Empty = ongoing.", example: "" },
    { key: "days_off", header: "Days off", hint: 'Weekly days off, e.g. "Sun" or "Sat, Sun".', example: "Sun", validate: (t) => daysOffProblem(t, "Days off") },
    { key: "notes", header: "Notes", hint: "Optional." },
  ],
  load: async () => {
    const [lookups, schedules, assignments] = await Promise.all([employeeLookups(), api.workSchedules.list(), api.scheduleAssignments.list()]);
    return {
      ...lookups,
      // Inactive schedules can't be newly assigned, so they aren't offered.
      schedules: new Lookup(schedules.filter((s) => s.is_active), [(s) => s.name], "active work schedule"),
      existing: new Map(assignments.map((a) => [`${a.employee_id}|${a.effective_from}`, a])),
    };
  },
  choices: (ctx) => ({ work_schedule: ctx.schedules.names(), employee: ctx.byName.names() }),
  save: async (row, ctx) => {
    const employee = findEmployee(row, ctx);
    const schedule = ctx.schedules.require(row.text("work_schedule")!);
    const from = row.text("effective_from")!;
    const to = row.text("effective_to") ?? null;
    if (to && to < from) throw new RowError("To is before From.");

    const daysOffText = row.text("days_off");
    const daysOff = daysOffText === undefined ? undefined : parseDaysOff(daysOffText, "Days off");
    const existing = ctx.existing.get(`${employee.id}|${from}`);

    if (existing) {
      const unchanged =
        existing.work_schedule?.id === schedule.id &&
        existing.effective_to === to &&
        (daysOff === undefined || [...daysOff].sort().join() === [...existing.days_off].sort().join()) &&
        (!row.has("notes") || existing.notes === row.text("notes"));
      if (unchanged) return "skipped";

      const updated = await api.scheduleAssignments.update(existing.id, {
        work_schedule_id: schedule.id,
        effective_to: to,
        ...(daysOff === undefined ? {} : { days_off: daysOff }),
        ...(row.has("notes") ? { notes: row.text("notes") } : {}),
      });
      ctx.existing.set(`${employee.id}|${from}`, updated);
      return "updated";
    }

    const created = await api.scheduleAssignments.create({
      employee_id: employee.id,
      work_schedule_id: schedule.id,
      effective_from: from,
      effective_to: to,
      days_off: daysOff ?? null,
      notes: row.text("notes") ?? null,
    });
    ctx.existing.set(`${employee.id}|${from}`, created);
    return "created";
  },
};

// ────────────────────────────── Holidays ─────────────────────────────

export async function exportHolidays(): Promise<string> {
  const filename = `holidays-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Holidays",
    rows: await api.holidays.all(),
    columns: [
      { header: "Name", value: (h) => h.name },
      { header: "Date", value: (h) => dateOnly(h.date), type: "date" },
      { header: "Day", value: (h) => WEEKDAY(dateOnly(h.date)) },
      { header: "Repeats yearly", value: (h) => yesNo(h.is_recurring_yearly) },
    ],
  });
  return filename;
}

export const holidayImport: ImportSpec<{ holidays: Lookup<Holiday> }> = {
  noun: { one: "holiday", many: "holidays" },
  templateFile: "holidays",
  matching: "A row whose Date already has a holiday updates that holiday.",
  fields: [
    { key: "name", header: "Name", required: true, hint: "The holiday's name.", example: "Khmer New Year" },
    { key: "date", header: "Date", type: "date", required: true, hint: "YYYY-MM-DD.", example: "2026-04-14" },
    { key: "is_recurring_yearly", header: "Repeats yearly", type: "boolean", hint: "Yes for a fixed date every year.", example: "No" },
  ],
  load: async () => ({ holidays: new Lookup(await api.holidays.all(), [(h) => dateOnly(h.date)], "holiday") }),
  save: async (row, ctx) => {
    const fields = row.pick("name", "date", "is_recurring_yearly") as Partial<Holiday>;
    const existing = ctx.holidays.find(row.text("date"));
    if (existing) {
      const unchanged =
        existing.name === row.text("name") &&
        (!row.has("is_recurring_yearly") || existing.is_recurring_yearly === row.flag("is_recurring_yearly"));
      if (unchanged) return "skipped";
      ctx.holidays.put(await api.holidays.update(existing.id, fields));
      return "updated";
    }
    ctx.holidays.add(await api.holidays.create(fields));
    return "created";
  },
};

// ─────────────────────────────── Roster ──────────────────────────────
//
// The roster holds one-off changes: "on this date, follow that schedule".

export async function exportRoster(month: string, employee?: { id: number; name: string }): Promise<string> {
  const filename = `roster-${employee ? `${employee.name.replace(/\s+/g, "-").toLowerCase()}-` : ""}${month}.xlsx`;
  await downloadSheet(filename, {
    name: `Roster ${month}`,
    rows: await api.schedules.all({ ...monthRange(month), employeeId: employee?.id }),
    columns: [
      { header: "Date", value: (s) => dateOnly(s.date), type: "date" },
      { header: "Day", value: (s) => WEEKDAY(dateOnly(s.date)) },
      { header: "Employee ID", value: (s) => s.employee?.employee_code },
      { header: "Employee", value: (s) => s.employee?.name },
      { header: "Work schedule", value: (s) => s.work_schedule?.name },
      {
        header: "Hours that day",
        value: (s) => (s.work_schedule ? slotsSummary(slotsOn(s.work_schedule, new Date(`${dateOnly(s.date)}T00:00:00`).getDay())) : null),
        width: 26,
      },
      { header: "Work location", value: (s) => s.work_location?.name },
      { header: "Notes", value: (s) => s.notes },
    ],
  });
  return filename;
}

type RosterCtx = EmployeeLookups & {
  schedules: Lookup<WorkSchedule>;
  locations: Lookup<WorkLocation>;
  // Each month's existing entries, fetched the first time a row needs that month.
  months: Map<string, Promise<Schedule[]>>;
};

export const rosterImport: ImportSpec<RosterCtx> = {
  noun: { one: "roster entry", many: "roster entries" },
  templateFile: "roster",
  matching: "A row for an employee and date that is already on the roster changes that day's schedule, location or notes.",
  notes: [
    "Use the roster for one-off changes. For someone's regular hours, assign them a work schedule instead.",
    "A date already marked as that employee's day off is refused — remove the day off first.",
  ],
  fields: [
    ...EMPLOYEE_FIELDS,
    { key: "date", header: "Date", type: "date", required: true, hint: "YYYY-MM-DD.", example: "2026-10-05" },
    { key: "work_schedule", header: "Work schedule", required: true, hint: "One of your work schedules, by name.", example: "Split shift", aliases: ["Shift"] },
    { key: "work_location", header: "Work location", hint: "Where they work that day, optional.", example: "Phnom Penh HQ" },
    { key: "notes", header: "Notes", hint: "Optional, up to 255 characters." },
  ],
  load: async () => {
    const [lookups, schedules, locations] = await Promise.all([employeeLookups(), api.workSchedules.list(), api.workLocations.all()]);
    return {
      ...lookups,
      schedules: new Lookup(schedules, [(s) => s.name], "work schedule"),
      locations: new Lookup(locations, [(l) => l.name], "work location"),
      months: new Map(),
    };
  },
  choices: (ctx) => ({ work_schedule: ctx.schedules.names(), work_location: ctx.locations.names(), employee: ctx.byName.names() }),
  save: async (row, ctx) => {
    const employee = findEmployee(row, ctx);
    const date = row.text("date")!;
    const schedule = ctx.schedules.require(row.text("work_schedule")!);
    const location = row.text("work_location");

    const payload: { employee_id: number; work_schedule_id: number; date: string; work_location_id?: number | null; notes?: string } = {
      employee_id: employee.id,
      work_schedule_id: schedule.id,
      date,
    };
    if (location) payload.work_location_id = ctx.locations.require(location).id;
    if (row.has("notes")) payload.notes = row.text("notes");

    const month = date.slice(0, 7);
    if (!ctx.months.has(month)) ctx.months.set(month, api.schedules.all(monthRange(month)));
    const existing = (await ctx.months.get(month)!).find((s) => s.employee?.id === employee.id && dateOnly(s.date) === date);

    if (existing) {
      const unchanged =
        existing.work_schedule?.id === schedule.id &&
        (payload.work_location_id === undefined || existing.work_location?.id === payload.work_location_id) &&
        (payload.notes === undefined || existing.notes === payload.notes);
      if (unchanged) return "skipped";
      await api.schedules.update(existing.id, payload);
      return "updated";
    }

    const created = await api.schedules.create(payload);
    (await ctx.months.get(month)!).push({ ...created, employee, work_schedule: schedule } as Schedule);
    return "created";
  },
};

// ────────────────────────────── Days off ─────────────────────────────

export const dayOffImport: ImportSpec<EmployeeLookups> = {
  noun: { one: "day off", many: "days off" },
  templateFile: "days-off",
  matching: "A day that is already marked as a day off for that employee is left as it is.",
  notes: ["A date with a one-off roster change is refused — remove that roster entry first."],
  fields: [
    ...EMPLOYEE_FIELDS,
    { key: "date", header: "Date", type: "date", required: true, hint: "YYYY-MM-DD.", example: "2026-10-12" },
    { key: "reason", header: "Reason", hint: "Optional, up to 255 characters.", example: "Annual leave" },
  ],
  load: employeeLookups,
  choices: (ctx) => ({ employee: ctx.byName.names() }),
  save: async (row, ctx) => {
    try {
      await api.daysOff.create({ employee_id: findEmployee(row, ctx).id, date: row.text("date")!, reason: row.text("reason") ?? null });
      return "created";
    } catch (err) {
      if (err instanceof ApiError && err.errors?.date?.some((m) => m.includes("already marked"))) return "skipped";
      throw err;
    }
  },
};

// ───────────────────────────── Attendance ────────────────────────────

/** A CSV line → cells, honouring quotes ("a, b" stays one cell, "" is a quote). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/**
 * The attendance report comes from the server (it applies the company's time
 * zone and who-can-see-what). It arrives as CSV and is turned into a proper
 * workbook here: real dates and numbers, styled header, filters.
 */
export async function attendanceReportToExcel(csv: Blob, filename: string): Promise<string> {
  const [header, ...body] = parseCsv((await csv.text()).replace(/^﻿/, ""));
  // The server escapes text that looks like a formula with a leading ' for CSV;
  // a workbook cell is never run as a formula, so the escape is taken off again.
  const unescape = (value: string) => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);
  const minutes = new Set(["Late (min)", "Early leave (min)"]);
  const hours = new Set(["Worked (hours)", "Overtime (hours)", "Night (hours)"]);

  const columns: SheetColumn<string[]>[] = (header ?? []).map((title, i) => ({
    header: title,
    value: (row) => unescape(row[i] ?? ""),
    type: title === "Date" ? "date" : minutes.has(title) || hours.has(title) ? "number" : "text",
    format: hours.has(title) ? "0.00" : undefined,
    width: title === "Expected" || title === "Scans" || title === "Exceptions" ? 32 : undefined,
  }));

  const xlsxName = filename.replace(/\.csv$/i, "") + ".xlsx";
  await downloadSheet(xlsxName, { name: "Attendance", rows: body, columns });
  return xlsxName;
}

/**
 * HH:MM times on `date` as wall-clock datetimes, in order. A time earlier
 * than the one before it is the next morning (a night shift's OUT).
 */
function scansOn(date: string, times: string[]): string[] {
  let day = date;
  let previous = "";
  return times.map((time) => {
    if (previous && time <= previous) {
      const next = new Date(`${day}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      day = next.toISOString().slice(0, 10);
    }
    previous = time;
    return `${day}T${time}`;
  });
}

export const attendanceImport: ImportSpec<EmployeeLookups> = {
  noun: { one: "attendance record", many: "attendance records" },
  templateFile: "attendance",
  matching:
    "Each row adds that day's scans as a correction request, so it is reviewed and logged like any other correction. The person's work schedule decides which scan is an IN and which an OUT.",
  notes: [
    'Scans: every scan of the day, in order — e.g. "08:00, 12:00, 13:00, 17:00" for a split shift. Times are on the company\'s clock.',
    "A time earlier than the one before it is read as the next morning (night shifts).",
  ],
  settings: [
    {
      key: "approve",
      label: "Approve imported records right away",
      description: "Turns each row straight into attendance. Untick to leave them as pending requests for review.",
      default: true,
    },
  ],
  fields: [
    ...EMPLOYEE_FIELDS,
    { key: "date", header: "Date", type: "date", required: true, hint: "The work day, YYYY-MM-DD.", example: "2026-09-10" },
    { key: "scans", header: "Scans", required: true, hint: "The day's scan times, comma-separated, 24-hour HH:MM.", example: "08:00, 12:00, 13:00, 17:00" },
    { key: "reason", header: "Reason", required: true, hint: "Why it is being added, e.g. where it came from.", example: "Imported from paper timesheet" },
  ],
  load: employeeLookups,
  choices: (ctx) => ({ employee: ctx.byName.names() }),
  save: async (row, ctx, settings) => {
    const employee = findEmployee(row, ctx);
    const date = row.text("date")!;
    const times = row
      .text("scans")!
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((t) => {
        const match = /^(\d{1,2})[:.](\d{2})$/.exec(t);
        if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new RowError(`"${t}" in Scans isn't a time like 08:00.`);
        return `${match[1].padStart(2, "0")}:${match[2]}`;
      });
    if (times.length === 0) throw new RowError("Fill in at least one scan time.");

    const correction = await api.attendanceCorrections.create({
      employee_id: employee.id,
      date,
      reason: row.text("reason")!,
      scans: scansOn(date, times),
    });

    if (settings.approve) {
      try {
        await api.attendanceCorrections.approve(correction.id);
      } catch (err) {
        const reason = err instanceof ApiError ? err.message : "it couldn't be approved";
        throw new RowError(`Saved as a pending correction, but not approved: ${reason}`);
      }
    }
    return "created";
  },
};

// ───────────────────────────── Corrections ───────────────────────────

const localTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export async function exportCorrections(): Promise<string> {
  const filename = `attendance-corrections-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Corrections",
    rows: await api.attendanceCorrections.all(),
    columns: [
      { header: "Employee ID", value: (c) => c.employee?.employee_code },
      { header: "Employee", value: (c) => c.employee?.name },
      { header: "Date", value: (c) => dateOnly(c.date), type: "date" },
      { header: "Scans to add", value: (c) => c.requested_times.map(localTime).join(", ") },
      { header: "Reason", value: (c) => c.reason, width: 40 },
      { header: "Status", value: (c) => c.status.charAt(0).toUpperCase() + c.status.slice(1) },
      { header: "Requested by", value: (c) => c.requested_by?.name },
      { header: "Reviewed by", value: (c) => c.reviewed_by?.name },
      { header: "Review notes", value: (c) => c.review_notes },
    ],
  });
  return filename;
}

// ────────────────────────────── Calendar ─────────────────────────────

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  incomplete: "Missing a scan",
  worked: "Worked",
};

const DAY_TYPE_LABEL: Record<string, string> = {
  work: "Work day",
  holiday: "Holiday",
  day_off: "Day off",
  weekly_off: "Weekly off",
  none: "",
};

/** One day as a short cell: the hours and how it went, or why there was no work. */
function dayCell(day: CalendarDay): string {
  if (day.type === "holiday") return day.label ? `Holiday: ${day.label}` : "Holiday";
  if (day.type === "day_off") return "Day off";
  if (day.type === "weekly_off") return day.attendance ? `Off · ${ATTENDANCE_LABEL[day.attendance]}` : "Weekly off";
  const parts = [day.schedule ? slotsSummary(day.schedule.slots) : null, day.attendance ? ATTENDANCE_LABEL[day.attendance] : null].filter(Boolean);
  return parts.join(" · ");
}

/** Everyone's month as a grid: one row per employee, one column per day. */
export async function exportTeamCalendar(month: string, branchId?: number): Promise<string> {
  const data = await api.calendar.team(month, branchId);
  const days = data.employees[0]?.days.map((d) => d.date) ?? [];
  type Person = (typeof data.employees)[number];

  const filename = `team-calendar-${month}.xlsx`;
  await downloadSheet(filename, {
    name: `Team ${month}`,
    rows: data.employees,
    columns: [
      { header: "Employee ID", value: (e: Person) => e.employee_code },
      { header: "Employee", value: (e: Person) => e.name },
      { header: "Branch", value: (e: Person) => e.branch },
      ...days.map((date, i) => ({
        header: `${Number(date.slice(8))} ${WEEKDAY(date)}`,
        value: (e: Person) => (e.days[i] ? dayCell(e.days[i]) : ""),
        width: 18,
      })),
      { header: "Work days", value: (e: Person) => e.summary.work_days, type: "number" as const },
      { header: "Present", value: (e: Person) => e.summary.present, type: "number" as const },
      { header: "Late", value: (e: Person) => e.summary.late, type: "number" as const },
      { header: "Absent", value: (e: Person) => e.summary.absent, type: "number" as const },
      { header: "Missing a scan", value: (e: Person) => e.summary.incomplete, type: "number" as const },
      { header: "Holidays", value: (e: Person) => e.summary.holidays, type: "number" as const },
      { header: "Days off", value: (e: Person) => e.summary.days_off, type: "number" as const },
      { header: "Worked", value: (e: Person) => formatMinutes(e.summary.worked_minutes) },
      { header: "Overtime", value: (e: Person) => formatMinutes(e.summary.overtime_minutes) },
    ],
  });
  return filename;
}

/** One person's month, a row per day. */
export async function exportMonthCalendar(month: string, employeeId?: number): Promise<string> {
  const data = await api.calendar.month(month, employeeId);
  const filename = `calendar-${data.employee.name.replace(/\s+/g, "-").toLowerCase()}-${month}.xlsx`;
  await downloadSheet(filename, {
    name: month,
    rows: data.days,
    columns: [
      { header: "Date", value: (d) => d.date, type: "date" },
      { header: "Day", value: (d) => WEEKDAY(d.date) },
      { header: "Type", value: (d) => DAY_TYPE_LABEL[d.type] ?? d.type },
      { header: "Holiday / note", value: (d) => (d.type === "work" ? d.holiday : d.label) },
      { header: "Work schedule", value: (d) => d.schedule?.name },
      { header: "Hours", value: (d) => (d.schedule ? slotsSummary(d.schedule.slots) : null), width: 26 },
      { header: "Work location", value: (d) => d.work_location },
      { header: "Scans", value: (d) => (d.scans ?? []).join(", ") },
      { header: "Attendance", value: (d) => (d.attendance ? ATTENDANCE_LABEL[d.attendance] : null) },
      { header: "Late (min)", value: (d) => d.late_minutes, type: "number" },
      { header: "Worked", value: (d) => (d.worked_minutes ? formatMinutes(d.worked_minutes) : null) },
      { header: "Overtime", value: (d) => (d.overtime_minutes ? formatMinutes(d.overtime_minutes) : null) },
    ],
  });
  return filename;
}

// ─────────────────────────── Monthly summary ─────────────────────────

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** The month per employee — what payroll reads. Hours as decimals so they can be multiplied by a rate. */
export async function exportAttendanceSummary(summary: AttendanceSummary): Promise<string> {
  const filename = `attendance-summary-${summary.month}${summary.locked ? "-locked" : ""}.xlsx`;
  await downloadSheet(filename, {
    name: `Summary ${summary.month}`,
    rows: summary.rows,
    columns: [
      { header: "Employee ID", value: (r) => r.employee.employee_code },
      { header: "Employee", value: (r) => r.employee.name },
      { header: "Branch", value: (r) => r.employee.branch },
      { header: "Work days", value: (r) => r.scheduled_days, type: "number" },
      { header: "Present", value: (r) => r.present_days, type: "number" },
      { header: "Absent", value: (r) => r.absent_days, type: "number" },
      { header: "Missing a scan", value: (r) => r.incomplete_days, type: "number" },
      { header: "Late days", value: (r) => r.late_days, type: "number" },
      { header: "Late (min)", value: (r) => r.late_minutes, type: "number" },
      { header: "Early leave (min)", value: (r) => r.early_leave_minutes, type: "number" },
      { header: "Scheduled (h)", value: (r) => hours(r.scheduled_minutes), type: "number", format: "0.00" },
      { header: "Worked (h)", value: (r) => hours(r.worked_minutes), type: "number", format: "0.00" },
      { header: "Night (h)", value: (r) => hours(r.night_minutes), type: "number", format: "0.00" },
      { header: "Overtime work day (h)", value: (r) => hours(r.overtime_workday_minutes), type: "number", format: "0.00" },
      { header: "Overtime day off (h)", value: (r) => hours(r.overtime_day_off_minutes), type: "number", format: "0.00" },
      { header: "Overtime holiday (h)", value: (r) => hours(r.overtime_holiday_minutes), type: "number", format: "0.00" },
      { header: "Overtime not approved (h)", value: (r) => hours(r.overtime_pending_minutes), type: "number", format: "0.00" },
      { header: "Days off worked", value: (r) => r.worked_days_off, type: "number" },
      { header: "Holidays worked", value: (r) => r.worked_holidays, type: "number" },
      { header: "Holidays", value: (r) => r.holidays, type: "number" },
      { header: "Weekly days off", value: (r) => r.weekly_days_off, type: "number" },
      { header: "Other days off", value: (r) => r.days_off, type: "number" },
    ],
  });
  return filename;
}
