// Work schedules, assignments, days off and the calendar.

import { request, requestAll } from "./client";
import type { Paginated } from "./client";
import type { Employee, WorkLocation } from "./organization";
import type { AttendanceException } from "./attendance";
import type { DayPart } from "./requests";

export type CalendarDayType = "work" | "holiday" | "day_off" | "weekly_off" | "leave" | "none";

// "worked" = scans on a day with nothing planned (a day off, or no schedule).
export type CalendarAttendance = "present" | "late" | "absent" | "incomplete" | "worked";

// A slot as the calendar and schedules show it: "08:00 IN", "06:00 OUT (next day)".
export type ScheduleSlot = { type: "in" | "out"; time: string; next_day: boolean };

export type CalendarDay = {
  date: string;
  type: CalendarDayType;
  label: string | null;
  // A holiday's name — also set on a holiday someone was rostered to work.
  holiday?: string | null;
  // Approved leave on the date: the whole day (type "leave"), or a morning / afternoon.
  leave?: { type: string; part: DayPart } | null;
  day_off_id: number | null;
  // What was planned: the schedule's slots for this weekday, and where it came from.
  schedule: { id: number; name: string; source: "assignment" | "override"; slots: ScheduleSlot[] } | null;
  // The roster entry behind an override (to edit or remove it).
  schedule_id: number | null;
  work_location: string | null;
  // What actually happened; null for future days and days with nothing planned.
  attendance: CalendarAttendance | null;
  late_minutes: number | null;
  early_leave_minutes?: number | null;
  worked_minutes?: number | null;
  overtime_minutes?: number | null;
  // Every scan of the day as HH:MM, in order.
  scans?: string[];
  exceptions?: AttendanceException[];
};

export type CalendarSummary = {
  work_days: number;
  holidays: number;
  days_off: number;
  // A half day counts 0.5.
  leave_days?: number;
  present: number;
  late: number;
  absent: number;
  incomplete: number;
  worked_minutes: number;
  overtime_minutes: number;
};

export type CalendarMonth = {
  employee: { id: number; name: string };
  month: string;
  today: string;
  timezone: string;
  summary: CalendarSummary;
  days: CalendarDay[];
};

export type TeamCalendarEmployee = {
  id: number;
  name: string;
  employee_code: string | null;
  branch: string | null;
  summary: CalendarSummary;
  days: CalendarDay[];
};

export type TeamCalendar = {
  month: string;
  today: string;
  timezone: string;
  total: number;
  // True when there are more employees than the roster returns — filter by branch.
  truncated: boolean;
  employees: TeamCalendarEmployee[];
};

export type CalendarEventType = "holiday" | "day_off" | "leave" | "absent";

// One thing that happens over one or more consecutive days. Holidays have no employee (they're everyone's).
export type CalendarEvent = {
  type: CalendarEventType;
  start: string;
  end: string;
  // A half day counts 0.5.
  days: number;
  label: string;
  employee: { id: number; name: string } | null;
  // Leave only.
  part?: DayPart;
  status?: "pending" | "approved";
  request_id?: number;
};

export type CalendarEvents = {
  from: string;
  to: string;
  today: string;
  events: CalendarEvent[];
};

export type OvertimeMode = "off" | "after_last_out" | "above_scheduled";

// What everyone on a schedule is expected to do: per weekday, any number of
// IN/OUT slots, plus the rules every slot is judged by.
export type WorkSchedule = {
  id: number;
  name: string;
  // Display order: lowest first in every list; null = after everything numbered.
  sort_order?: number | null;
  description: string | null;
  is_active: boolean;
  // No scanning (e.g. top management): each IN/OUT is filled in at its time once it passes.
  auto_attendance: boolean;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  // Deducted only on a day with one IN/OUT pair (people who don't scan out for lunch).
  break_minutes: number;
  is_break_paid: boolean;
  overtime_mode: OvertimeMode;
  // Overtime shorter than this is ignored.
  overtime_min_minutes: number;
  overtime_count_early: boolean;
  // Overtime is rounded down to this step (0 = not rounded).
  overtime_round_minutes: number;
  overtime_requires_approval: boolean;
  // Suggested weekly days off for new assignments (0 = Sunday .. 6 = Saturday).
  default_days_off: number[];
  // Weekdays with no entry have no slots.
  days: { weekday: number; slots: (ScheduleSlot & { sequence: number })[] }[];
  weekly_minutes: number;
  // People following it today (only in the list).
  assigned_count?: number;
};

export type WorkScheduleInput = Partial<Omit<WorkSchedule, "id" | "days" | "weekly_minutes" | "assigned_count">> & {
  days?: { weekday: number; slots: ScheduleSlot[] }[];
};

// "From this date (until that date) this person follows that schedule, with these days off."
export type ScheduleAssignment = {
  id: number;
  employee_id: number;
  // has_left: still on record, but no longer counts as following the schedule.
  employee: { id: number; name: string; employee_code: string | null; has_left?: boolean } | null;
  work_schedule: { id: number; name: string; is_active: boolean } | null;
  effective_from: string;
  effective_to: string | null;
  days_off: number[];
  notes: string | null;
  state?: "current" | "upcoming" | "ended";
};

export type ScheduleAssignmentInput = {
  work_schedule_id: number;
  effective_from: string;
  effective_to?: string | null;
  // Left out: the schedule's suggested days off are used.
  days_off?: number[] | null;
  notes?: string | null;
};

export type ScheduleBulkInput = {
  employee_ids: number[];
  work_schedule_id: number;
  work_location_id?: number | null;
  from: string;
  to: string;
  // 0 = Sunday .. 6 = Saturday.
  weekdays: number[];
  skip_holidays?: boolean;
  dry_run?: boolean;
};

export type ScheduleBulkResult = {
  dry_run: boolean;
  created: number;
  // no_hours: a weekday the schedule has no slots on.
  skipped: { holiday: number; day_off: number; already_scheduled: number; employee_left: number; no_hours: number };
};

// A roster entry: a one-day override of the person's assigned schedule.
export type Schedule = {
  id: number;
  date: string;
  notes: string | null;
  employee: Employee;
  work_schedule: WorkSchedule;
  work_location: WorkLocation | null;
};

export const schedulesApi = {
  workSchedules: {
    // Not paginated: a company has a handful of schedules.
    list: () => request<WorkSchedule[]>("/api/work_schedules"),
    get: (id: number) => request<WorkSchedule>(`/api/work_schedules/${id}`),
    create: (data: WorkScheduleInput) =>
      request<WorkSchedule>("/api/work_schedules", { method: "POST", body: JSON.stringify(data) }),
    // Sending `days` replaces every day's slots; leave it out to keep them.
    update: (id: number, data: WorkScheduleInput) =>
      request<WorkSchedule>(`/api/work_schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/work_schedules/${id}`, { method: "DELETE" }),
  },
  scheduleAssignments: {
    list: (params: { employeeId?: number; workScheduleId?: number; currentOnly?: boolean } = {}) => {
      const query = new URLSearchParams();
      if (params.employeeId) query.set("employee_id", String(params.employeeId));
      if (params.workScheduleId) query.set("work_schedule_id", String(params.workScheduleId));
      if (params.currentOnly) query.set("current_only", "1");
      return request<ScheduleAssignment[]>(`/api/schedule-assignments${query.size ? `?${query}` : ""}`);
    },
    create: (data: ScheduleAssignmentInput & { employee_id: number }) =>
      request<ScheduleAssignment>("/api/schedule-assignments", { method: "POST", body: JSON.stringify(data) }),
    // Each person is handled on their own; anyone who can't take it is listed in `skipped`.
    bulk: (data: ScheduleAssignmentInput & { employee_ids: number[] }) =>
      request<{ assigned: number; skipped: { employee_id: number; name: string; reason: string }[] }>(
        "/api/schedule-assignments/bulk",
        { method: "POST", body: JSON.stringify(data) },
      ),
    update: (id: number, data: Partial<ScheduleAssignmentInput>) =>
      request<ScheduleAssignment>(`/api/schedule-assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/schedule-assignments/${id}`, { method: "DELETE" }),
  },
  calendar: {
    team: (month: string, branchId?: number) =>
      request<TeamCalendar>(`/api/calendar/team?month=${month}${branchId ? `&branch_id=${branchId}` : ""}`),
    month: (month: string, employeeId?: number) =>
      request<CalendarMonth>(`/api/calendar?month=${month}${employeeId ? `&employee_id=${employeeId}` : ""}`),
    events: (from: string, to: string, employeeId?: number, types?: CalendarEventType[]) => {
      const params = new URLSearchParams({ from, to });
      if (employeeId) params.set("employee_id", String(employeeId));
      types?.forEach((type) => params.append("types[]", type));
      return request<CalendarEvents>(`/api/calendar/events?${params}`);
    },
  },
  daysOff: {
    create: (data: { employee_id: number; date: string; reason?: string | null }) =>
      request<{ id: number }>("/api/days-off", { method: "POST", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/days-off/${id}`, { method: "DELETE" }),
  },
  schedules: {
    // Ask for a date range: the API pages 50 at a time unless perPage is raised (max 2000).
    list: (params: { from?: string; to?: string; employeeId?: number; perPage?: number } = {}) => {
      const query = new URLSearchParams({ per_page: String(params.perPage ?? 2000) });
      if (params.employeeId) query.set("employee_id", String(params.employeeId));
      if (params.from) query.set("from", params.from);
      if (params.to) query.set("to", params.to);
      return request<Paginated<Schedule>>(`/api/schedules?${query}`);
    },
    all: (params: { from: string; to: string; employeeId?: number }) => {
      const query = new URLSearchParams({ per_page: "2000", from: params.from, to: params.to });
      if (params.employeeId) query.set("employee_id", String(params.employeeId));
      return requestAll<Schedule>(`/api/schedules?${query}`);
    },
    // Rosters many people over a date range in one go. dry_run only reports what it would do.
    bulk: (data: ScheduleBulkInput) =>
      request<ScheduleBulkResult>("/api/schedules/bulk", { method: "POST", body: JSON.stringify(data) }),
    create: (data: { employee_id: number; work_schedule_id: number; work_location_id?: number | null; date: string; notes?: string }) =>
      request<Schedule>("/api/schedules", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { employee_id?: number; work_schedule_id?: number; work_location_id?: number | null; date?: string; notes?: string | null }) =>
      request<Schedule>(`/api/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/schedules/${id}`, { method: "DELETE" }),
  },
};
