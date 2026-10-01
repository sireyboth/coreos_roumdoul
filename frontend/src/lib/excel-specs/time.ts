import {
  api,
  ApiError,
  type CalendarDay,
  type Employee,
  type Holiday,
  type Schedule,
  type Shift,
  type WorkLocation,
} from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { downloadSheet, today, type SheetColumn } from "@/lib/excel";
import { Lookup, Row, RowError, yesNo, type ImportField, type ImportSpec } from "@/lib/excel-import";

/*
 * Excel import/export for time and attendance: shifts, holidays, the roster,
 * days off, attendance records, correction requests and the calendar.
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

// ─────────────────────────────── Shifts ──────────────────────────────

export async function exportShifts(): Promise<string> {
  const filename = `shifts-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Shifts",
    rows: await api.shifts.all(),
    columns: [
      { header: "Name", value: (s) => s.name },
      { header: "Start", value: (s) => s.start_time.slice(0, 5) },
      { header: "End", value: (s) => s.end_time.slice(0, 5) },
      { header: "Break (min)", value: (s) => s.break_minutes, type: "number" },
      { header: "Break paid", value: (s) => yesNo(s.is_break_paid) },
      { header: "Grace (min)", value: (s) => s.grace_minutes, type: "number" },
      { header: "Active", value: (s) => yesNo(s.is_active) },
    ],
  });
  return filename;
}

export const shiftImport: ImportSpec<{ shifts: Lookup<Shift> }> = {
  noun: { one: "shift", many: "shifts" },
  templateFile: "shifts",
  matching: "A row whose Name matches an existing shift updates that shift.",
  fields: [
    { key: "name", header: "Name", required: true, hint: "The shift's name.", example: "Morning" },
    { key: "start_time", header: "Start", type: "time", required: true, hint: "24-hour HH:MM.", example: "08:00" },
    { key: "end_time", header: "End", type: "time", required: true, hint: "24-hour HH:MM. Earlier than Start means it ends the next day.", example: "17:00" },
    { key: "break_minutes", header: "Break (min)", type: "integer", hint: "0–240 minutes, optional.", example: "60" },
    { key: "is_break_paid", header: "Break paid", type: "boolean", hint: "Yes or No, optional.", example: "No" },
    { key: "grace_minutes", header: "Grace (min)", type: "integer", hint: "Minutes late before it counts as late (0–60).", example: "5" },
    { key: "is_active", header: "Active", type: "boolean", hint: "Yes or No. New shifts are active.", example: "Yes" },
  ],
  load: async () => ({ shifts: new Lookup(await api.shifts.all(), [(s) => s.name], "shift") }),
  save: async (row, ctx) => {
    const fields = row.pick("name", "start_time", "end_time", "break_minutes", "is_break_paid", "grace_minutes", "is_active") as Partial<Shift>;
    const existing = ctx.shifts.find(row.text("name"));
    if (existing) {
      ctx.shifts.put(await api.shifts.update(existing.id, fields));
      return "updated";
    }
    ctx.shifts.add(await api.shifts.create(fields));
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
      { header: "Shift", value: (s) => s.shift?.name },
      { header: "Start", value: (s) => s.shift?.start_time.slice(0, 5) },
      { header: "End", value: (s) => s.shift?.end_time.slice(0, 5) },
      { header: "Work location", value: (s) => s.work_location?.name },
      { header: "Notes", value: (s) => s.notes },
    ],
  });
  return filename;
}

type RosterCtx = EmployeeLookups & {
  shifts: Lookup<Shift>;
  locations: Lookup<WorkLocation>;
  // Each month's existing entries, fetched the first time a row needs that month.
  months: Map<string, Promise<Schedule[]>>;
};

export const rosterImport: ImportSpec<RosterCtx> = {
  noun: { one: "roster entry", many: "roster entries" },
  templateFile: "roster",
  matching: "A row for an employee and date that is already on the roster changes that day's shift, location or notes.",
  notes: ["A date already marked as that employee's day off is refused — remove the day off first."],
  fields: [
    ...EMPLOYEE_FIELDS,
    { key: "date", header: "Date", type: "date", required: true, hint: "YYYY-MM-DD.", example: "2026-10-05" },
    { key: "shift", header: "Shift", required: true, hint: "One of your shifts, by name.", example: "Morning" },
    { key: "work_location", header: "Work location", hint: "Where they work that day, optional.", example: "Phnom Penh HQ" },
    { key: "notes", header: "Notes", hint: "Optional, up to 255 characters." },
  ],
  load: async () => {
    const [lookups, shifts, locations] = await Promise.all([employeeLookups(), api.shifts.all(), api.workLocations.all()]);
    return {
      ...lookups,
      shifts: new Lookup(shifts, [(s) => s.name], "shift"),
      locations: new Lookup(locations, [(l) => l.name], "work location"),
      months: new Map(),
    };
  },
  choices: (ctx) => ({ shift: ctx.shifts.names(), work_location: ctx.locations.names(), employee: ctx.byName.names() }),
  save: async (row, ctx) => {
    const employee = findEmployee(row, ctx);
    const date = row.text("date")!;
    const shift = ctx.shifts.require(row.text("shift")!);
    const location = row.text("work_location");

    const payload: { employee_id: number; shift_id: number; date: string; work_location_id?: number | null; notes?: string } = {
      employee_id: employee.id,
      shift_id: shift.id,
      date,
    };
    if (location) payload.work_location_id = ctx.locations.require(location).id;
    if (row.has("notes")) payload.notes = row.text("notes");

    const month = date.slice(0, 7);
    if (!ctx.months.has(month)) ctx.months.set(month, api.schedules.all(monthRange(month)));
    const existing = (await ctx.months.get(month)!).find((s) => s.employee?.id === employee.id && dateOnly(s.date) === date);

    if (existing) {
      const unchanged =
        existing.shift?.id === shift.id &&
        (payload.work_location_id === undefined || existing.work_location?.id === payload.work_location_id) &&
        (payload.notes === undefined || existing.notes === payload.notes);
      if (unchanged) return "skipped";
      await api.schedules.update(existing.id, payload);
      return "updated";
    }

    const created = await api.schedules.create(payload);
    (await ctx.months.get(month)!).push({ ...created, employee, shift } as Schedule);
    return "created";
  },
};

// ────────────────────────────── Days off ─────────────────────────────

export const dayOffImport: ImportSpec<EmployeeLookups> = {
  noun: { one: "day off", many: "days off" },
  templateFile: "days-off",
  matching: "A day that is already marked as a day off for that employee is left as it is.",
  notes: ["A day the employee is rostered to work is refused — remove the shift from the roster first."],
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
  const numeric = new Set(["Late (min)", "Worked (hours)"]);

  const columns: SheetColumn<string[]>[] = (header ?? []).map((title, i) => ({
    header: title,
    value: (row) => unescape(row[i] ?? ""),
    type: title === "Date" ? "date" : numeric.has(title) ? "number" : "text",
    format: title === "Worked (hours)" ? "0.00" : undefined,
  }));

  const xlsxName = filename.replace(/\.csv$/i, "") + ".xlsx";
  await downloadSheet(xlsxName, { name: "Attendance", rows: body, columns });
  return xlsxName;
}

/** HH:MM on `date`, as the wall-clock datetime the corrections API expects. */
function at(date: string, time: string, nextDay = false): string {
  if (!nextDay) return `${date}T${time}`;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T${time}`;
}

export const attendanceImport: ImportSpec<EmployeeLookups> = {
  noun: { one: "attendance record", many: "attendance records" },
  templateFile: "attendance",
  matching: "Each row becomes a correction request for that employee and day, so it is reviewed and logged like any other correction.",
  notes: [
    "Times are on the company's clock. A Check out earlier than Check in is read as the next morning (night shifts).",
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
    { key: "check_in", header: "Check in", type: "time", hint: "24-hour HH:MM. Fill in Check in, Check out, or both.", example: "08:00" },
    { key: "check_out", header: "Check out", type: "time", hint: "24-hour HH:MM.", example: "17:00" },
    { key: "reason", header: "Reason", required: true, hint: "Why it is being added, e.g. where it came from.", example: "Imported from paper timesheet" },
  ],
  load: employeeLookups,
  choices: (ctx) => ({ employee: ctx.byName.names() }),
  save: async (row, ctx, settings) => {
    const employee = findEmployee(row, ctx);
    const date = row.text("date")!;
    const checkIn = row.text("check_in");
    const checkOut = row.text("check_out");
    if (!checkIn && !checkOut) throw new RowError("Fill in a Check in or Check out time.");

    const correction = await api.attendanceCorrections.create({
      employee_id: employee.id,
      date,
      reason: row.text("reason")!,
      requested_check_in: checkIn ? at(date, checkIn) : undefined,
      requested_check_out: checkOut ? at(date, checkOut, Boolean(checkIn && checkOut < checkIn)) : undefined,
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

const localDateTime = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      { header: "Requested check in", value: (c) => localDateTime(c.requested_check_in) },
      { header: "Requested check out", value: (c) => localDateTime(c.requested_check_out) },
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
  missing_checkout: "No check-out",
};

const DAY_TYPE_LABEL: Record<string, string> = {
  work: "Work day",
  holiday: "Holiday",
  day_off: "Day off",
  weekly_off: "Weekly off",
  none: "",
};

/** One day as a short cell: the shift and how it went, or why there was no work. */
function dayCell(day: CalendarDay): string {
  if (day.type === "holiday") return day.label ? `Holiday: ${day.label}` : "Holiday";
  if (day.type === "day_off") return "Day off";
  if (day.type === "weekly_off") return "Weekly off";
  const parts = [
    day.shift ? `${day.shift.start_time.slice(0, 5)}–${day.shift.end_time.slice(0, 5)}` : null,
    day.attendance ? ATTENDANCE_LABEL[day.attendance] : null,
  ].filter(Boolean);
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
        width: 16,
      })),
      { header: "Work days", value: (e: Person) => e.summary.work_days, type: "number" as const },
      { header: "Present", value: (e: Person) => e.summary.present, type: "number" as const },
      { header: "Late", value: (e: Person) => e.summary.late, type: "number" as const },
      { header: "Absent", value: (e: Person) => e.summary.absent, type: "number" as const },
      { header: "Holidays", value: (e: Person) => e.summary.holidays, type: "number" as const },
      { header: "Days off", value: (e: Person) => e.summary.days_off, type: "number" as const },
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
      { header: "Holiday / note", value: (d) => d.label },
      { header: "Shift", value: (d) => (d.shift ? d.shift.name : null) },
      { header: "Shift hours", value: (d) => (d.shift ? `${d.shift.start_time.slice(0, 5)}–${d.shift.end_time.slice(0, 5)}` : null) },
      { header: "Work location", value: (d) => d.work_location },
      { header: "Check in", value: (d) => d.check_in },
      { header: "Check out", value: (d) => d.check_out },
      { header: "Attendance", value: (d) => (d.attendance ? ATTENDANCE_LABEL[d.attendance] : null) },
      { header: "Late (min)", value: (d) => d.late_minutes, type: "number" },
    ],
  });
  return filename;
}
