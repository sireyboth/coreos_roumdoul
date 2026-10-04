import { createHttpCache } from "@/lib/http-cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "business_os_token";
const ME_SNAPSHOT_KEY = "business_os_me";

// Reference-data lists that many pages ask for again and again. Live data
// (attendance, schedules, the calendar) is deliberately not cached.
const CACHEABLE_GET = /^\/api\/(branches|departments|teams|shifts|work_locations|holidays|employees|roles|permissions|users)(\?|$)/;
const httpCache = createHttpCache(30_000);

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  // A fresh sign-in starts clean, even if the previous session wasn't signed out properly.
  httpCache.clear();
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ME_SNAPSHOT_KEY);
  // Nothing from one person's session may be served to the next.
  httpCache.clear();
}

/**
 * The last /me answer, kept so the app can show itself straight away instead of
 * waiting a network round trip. It only ever decides what the UI shows — the
 * server still checks every request — and is refreshed right after. Tied to
 * the token so it can't outlive a sign-out or belong to another account.
 */
export function getMeSnapshot(token: string): MeResponse | null {
  try {
    const raw = window.localStorage.getItem(ME_SNAPSHOT_KEY);
    const saved = raw ? (JSON.parse(raw) as { token: string; me: MeResponse }) : null;
    return saved && saved.token === token ? saved.me : null;
  } catch {
    return null;
  }
}

export function saveMeSnapshot(token: string, me: MeResponse) {
  try {
    window.localStorage.setItem(ME_SNAPSHOT_KEY, JSON.stringify({ token, me }));
  } catch {
    // storage full or blocked — the snapshot is only an optimisation
  }
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  /** Machine-readable reason, e.g. plan_limit_reached, trial_expired. */
  code?: string;

  constructor(status: number, message: string, errors?: Record<string, string[]>, code?: string) {
    super(message); 
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

// The whole account is locked (not just this one request).
export const ACCOUNT_BLOCKED_CODES = ["trial_expired", "company_suspended", "company_cancelled", "company_deleted"];
export const ACCOUNT_BLOCKED_EVENT = "app:account-blocked";

/** Photo links from the API are relative and signed; this makes one loadable in an <img>. */
export function photoSrc(url?: string | null): string | null {
  return url ? `${API_URL}${url}` : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  if (method === "GET") {
    const send = () => sendWithRetry<T>(path, options);
    return CACHEABLE_GET.test(path) ? httpCache.get<T>(path, send) : send();
  }

  try {
    return await sendOnce<T>(path, options);
  } finally {
    // Any change (even a failed one) may have altered what the lists show.
    httpCache.clear();
  }
}

/** A dropped connection on a read is worth one more try; a write is never repeated automatically. */
async function sendWithRetry<T>(path: string, options: RequestInit): Promise<T> {
  try {
    return await sendOnce<T>(path, options);
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "network_error") throw err;
    await sleep(800);
    return sendOnce<T>(path, options);
  }
}

async function sendOnce<T>(path: string, options: RequestInit): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        // A FormData body sets its own multipart boundary — forcing JSON would break uploads.
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    // fetch() rejects with a plain TypeError for anything before a response comes back —
    // the server is down, the URL is wrong, or the network dropped. Left as-is, every
    // caller's catch block shows the generic "Something went wrong.", which is true but
    // useless here: this is the one case where we can name the actual problem.
    if (err instanceof TypeError) {
      throw new ApiError(
        0,
        `Can't reach the server at ${API_URL}. It may be offline, or check your internet connection.`,
        undefined,
        "network_error",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (typeof window !== "undefined" && ACCOUNT_BLOCKED_CODES.includes(body.code)) {
      window.dispatchEvent(new CustomEvent(ACCOUNT_BLOCKED_EVENT, { detail: { code: body.code, message: body.message } }));
    }

    throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`, body.errors, body.code);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

/**
 * Every row of a paginated list, page by page — for exports, which must never
 * stop at the first 25. Asks for the largest page each endpoint allows.
 */
async function requestAll<T>(path: string): Promise<T[]> {
  const join = path.includes("?") ? "&" : "?";
  const first = await request<Paginated<T>>(`${path}${join}page=1`);
  const rows = [...first.data];

  for (let page = 2; page <= (first.last_page ?? 1); page++) {
    rows.push(...(await request<Paginated<T>>(`${path}${join}page=${page}`)).data);
  }

  return rows;
}

export type MeResponse = {
  // email is null for someone who signs in with an employee ID; login_id is that ID.
  user: { id: number; name: string; email: string | null; login_id?: string | null; company_id: number | null; is_platform_admin: boolean };
  roles: string[];
  permissions: string[];
  employee: { id: number; name: string } | null;
  company: { id: number; name: string; slug: string; status: string; trial_ends_at: string | null } | null;
  // null limits mean unlimited.
  plan: { name: string; max_employees: number | null; max_branches: number | null } | null;
  usage: { employees: number; branches: number } | null;
  modules: Record<string, boolean>;
};

export type Branch = {
  id: number;
  name: string;
  // Display order: lowest first in every list; null = after everything numbered.
  sort_order?: number | null;
  code: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  // When on, a QR scan only counts if the phone also reports a position inside the radius.
  require_location?: boolean;
  // Only sent to people who manage branches — everyone else must never see it.
  qr_token?: string | null;
};

export type Department = {
  id: number;
  name: string;
  // Display order: lowest first in every list; null = after everything numbered.
  sort_order?: number | null;
  code: string | null;
  status: "active" | "inactive";
  branch_id: number | null;
  branch: Branch | null;
  parent_department_id: number | null;
  parent: { id: number; name: string } | null;
  // Current, non-terminated employees.
  members_count?: number;
  teams_count?: number;
};

export type Team = {
  id: number;
  name: string;
  // Display order: lowest first in every list; null = after everything numbered.
  sort_order?: number | null;
  code: string | null;
  status: "active" | "inactive";
  department_id: number | null;
  department: { id: number; name: string } | null;
  members_count?: number;
};

// What the employee form sends — every optional field is null when cleared.
export type EmployeeInput = {
  name?: string;
  employee_code?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  branch_id?: number;
  // null clears it; leave them out to keep what the employee has.
  department_id?: number | null;
  team_id?: number | null;
  employment_status?: string;
  employment_type?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  // Lowest first in every list; null = after everyone numbered.
  sort_order?: number | null;
  gender?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  notes?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name_km?: string | null;
  nationality?: string | null;
  national_id_number?: string | null;
  passport_number?: string | null;
  nssf_number?: string | null;
  tax_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  // Only accepted from people with salary.manage — leave both out otherwise.
  base_salary?: number | null;
  salary_currency?: SalaryCurrency | null;
};

export type SalaryCurrency = "USD" | "KHR";

// How a new employee login is set up: the admin picks ONE way to sign in.
export type LoginSetup =
  | { login_method: "email"; email: string; password: string }
  | { login_method: "employee_id"; employee_code: string; password: string };

export type Employee = {
  id: number;
  name: string;
  employee_code: string | null;
  email: string | null;
  job_title: string | null;
  phone: string | null;
  employment_status: string;
  // Display order: lowest first in every list (e.g. director 1, managers 2); null = after everyone numbered.
  sort_order: number | null;
  // full_time / part_time / contract / temporary
  employment_type: string | null;
  // Serialized as an ISO datetime — take the first 10 chars for a date input.
  hire_date: string | null;
  termination_date: string | null;
  // Personal details: the API only sends these to people who can manage employees.
  gender?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  notes?: string | null;
  nationality?: string | null;
  national_id_number?: string | null;
  passport_number?: string | null;
  nssf_number?: string | null;
  tax_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  // Pay: only sent to people with salary.view. A decimal string, e.g. "650.00".
  base_salary?: string | null;
  salary_currency?: SalaryCurrency | null;
  // Identity details: sent wherever the employee pages load one person or the
  // list, but not when an employee is nested in roster or attendance rows.
  first_name?: string | null;
  last_name?: string | null;
  name_km?: string | null;
  // Where they work now. There is no branch_id field — read branch?.id.
  branch: Branch | null;
  department?: { id: number; name: string } | null;
  team?: { id: number; name: string } | null;
  // A short-lived signed link — use photoSrc() to turn it into an image URL.
  photo_url?: string | null;
  // How this person signs in — only sent (to managers) when they have a login.
  login?: { method: "email" | "employee_id"; identifier: string | null; company_code: string };
  // Whether this employee has a login linked to them — without one they
  // can never sign in or check in.
  has_login: boolean;
};

type Paginated<T> = { data: T[]; total: number; last_page?: number };

export type CalendarDayType = "work" | "holiday" | "day_off" | "weekly_off" | "none";
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

// One small answer for the whole dashboard, counted by the server. Sections the
// caller can't see are null.
export type DashboardSummary = {
  today: string;
  employees: number | null;
  branches: number | null;
  attendance: {
    checked_in_today: number;
    late_today: number;
    pending_corrections: number;
    // Only for people who manage attendance.
    pending_overtime: number | null;
    // The last 7 days, oldest first — days with none are included as 0.
    week: { date: string; count: number }[];
    recent: {
      id: number;
      date: string;
      status: AttendanceDayStatus;
      late_minutes: number;
      // The day's first and (when there's more than one) last scan, HH:MM.
      check_in: string | null;
      check_out: string | null;
      exceptions: AttendanceException[];
      employee: { id: number; name: string; photo_url: string | null };
    }[];
  } | null;
};

export type Notification = {
  id: number;
  // e.g. "attendance.correction_requested", "attendance.correction_decided", "welcome".
  type: string;
  data: { title: string; body?: string; [key: string]: unknown };
  // Where clicking it goes (a dashboard path), if anywhere.
  link: string | null;
  // Who caused it (the requester, the reviewer).
  actor: string | null;
  read_at: string | null;
  // Someone already acted on what it's about: resolution is "approved" / "rejected", by resolved_by.
  resolved_at: string | null;
  resolution: string | null;
  resolved_by: string | null;
  created_at: string;
};

export type CompanyUser = {
  id: number;
  name: string;
  email: string | null;
  // Set instead of an email for accounts that sign in with an employee ID.
  login_id?: string | null;
  is_active: boolean;
  role: string | null;
  // null = unrestricted (every branch); otherwise the exact branches they can see.
  branch_ids: number[] | null;
};

export type Role = {
  id: number;
  name: string;
  // Display order: lowest first in every list; null = after everything numbered.
  sort_order?: number | null;
  protected: boolean;
  permissions: string[];
};

export type PermissionGroup = {
  resource: string;
  permissions: string[];
};

export type WorkLocation = {
  id: number;
  name: string;
  // Display order: lowest first in every list; null = after everything numbered.
  sort_order?: number | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  radius_meters: number;
  require_location?: boolean;
  is_active: boolean;
  qr_token?: string | null;
  // Set when this is a branch's own check-in point (managed through the branch).
  branch_id: number | null;
  branch?: { id: number; name: string } | null;
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

export type Holiday = {
  id: number;
  name: string;
  date: string;
  is_recurring_yearly: boolean;
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

export type AttendanceEvent = {
  id: number;
  // Only on scans recorded before work schedules; the schedule decides now.
  event_type: "check_in" | "check_out" | null;
  event_time: string;
  // qr / gps / correction / adjustment / none — how presence was verified.
  method: "qr" | "gps" | "correction" | "adjustment" | "auto" | "none" | null;
  latitude: number | null;
  longitude: number | null;
  // Meters from the work location, when both sides had coordinates.
  distance_meters: number | null;
  device_id: string | null;
  notes: string | null;
  work_location: {
    id: number;
    name: string;
    address: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
  } | null;
  recorded_by: { id: number; name: string } | null;
};

export type AttendanceDayStatus =
  | "upcoming" // nothing scanned yet, the day is still going
  | "in_progress"
  | "complete" // every slot answered
  | "incomplete" // closed with slots unanswered
  | "absent"
  | "off" // a day off nobody worked
  | "worked_off" // scans on a day off or holiday
  | "unscheduled";

export type AttendanceException =
  | "late"
  | "early_leave"
  | "missing_in"
  | "missing_out"
  | "absent"
  | "extra_scan"
  | "worked_day_off"
  | "worked_holiday"
  | "unscheduled_work"
  | "overtime_pending";

// One recorded scan, with where and how it was made.
export type ScanDetail = {
  id: number;
  at: string;
  method: AttendanceEvent["method"];
  work_location: { id: number; name: string; address: string | null; latitude: number | string | null; longitude: number | string | null } | null;
  distance_meters: number | null;
  // Where the phone said it was (null for a QR scan without GPS, or a correction).
  latitude: number | string | null;
  longitude: number | string | null;
  device_id: string | null;
  recorded_by: { id: number; name: string } | null;
  notes: string | null;
};

// An expected slot next to the scan that answered it (if any).
export type DaySlot = {
  sequence: number;
  type: "in" | "out";
  expected_at: string;
  scan_id: number | null;
  actual_at: string | null;
  method: string | null;
  late_minutes: number;
  early_minutes: number;
  status: "ok" | "late" | "early" | "missing" | "pending";
  scan: ScanDetail | null;
};

// One employee's day: expected (schedule) next to actual (scans), and what follows from the two.
export type AttendanceDay = {
  id: number;
  date: string;
  kind: "work" | "holiday" | "day_off" | "weekly_off" | "unscheduled";
  label: string | null;
  holiday: string | null;
  schedule: string | null;
  status: AttendanceDayStatus;
  is_closed: boolean;
  slots: DaySlot[];
  // Every scan in order, with the part it played.
  scans: { scan_id: number; at: string; method: string | null; role: "in" | "out" | "extra"; scan: ScanDetail | null }[];
  extra_scans: { scan_id: number; at: string; method: string | null; scan: ScanDetail | null }[];
  scan_count: number;
  scheduled_minutes: number;
  worked_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  night_minutes: number;
  overtime_minutes: number;
  overtime_type: "workday" | "day_off" | "holiday" | null;
  overtime_status: "pending" | "approved" | "rejected" | null;
  exceptions: AttendanceException[];
  // Admin adjustments to this day, oldest first. changes: "Removed 09:30; Added 08:00".
  adjustments: { id: number; at: string; by: string | null; reason: string; changes: string }[];
  employee: {
    id: number;
    name: string;
    employee_code: string | null;
    branch: { id: number; name: string } | null;
    job_title: string | null;
    photo_url: string | null;
  } | null;
};

// The signed-in person's day, for the scan screen.
export type AttendanceToday = {
  date: string;
  kind: AttendanceDay["kind"];
  label: string | null;
  schedule: string | null;
  // Automatic attendance: slots fill themselves in, nothing to scan.
  auto: boolean;
  slots: Omit<DaySlot, "scan" | "method">[];
  // The next slot still to scan, if any.
  next: Omit<DaySlot, "scan" | "method"> | null;
  day: AttendanceDay | null;
};

export type ScanResult = {
  event: AttendanceEvent;
  // The expected slot this scan answered (null if it matched none).
  slot: Omit<DaySlot, "scan"> | null;
  day: AttendanceDay | null;
  // e.g. "IN recorded at 08:07 (expected 08:00) — 2 min late."
  message: string;
};

export type OvertimeEntry = {
  id: number;
  date: string;
  employee: { id: number; name: string; employee_code: string | null };
  schedule: string | null;
  worked_minutes: number;
  scheduled_minutes: number;
  overtime_minutes: number;
  overtime_type: "workday" | "day_off" | "holiday";
  overtime_status: "pending" | "approved" | "rejected";
  reviewed_by: { id: number; name: string } | null;
  reviewed_at: string | null;
  last_scan_at: string | null;
};

// One employee's month — what payroll reads. Overtime counts once approved.
export type AttendanceSummaryRow = {
  employee: { id: number; name: string; employee_code: string | null; branch: string | null };
  scheduled_days: number;
  weekly_days_off: number;
  days_off: number;
  holidays: number;
  present_days: number;
  absent_days: number;
  incomplete_days: number;
  late_days: number;
  late_minutes: number;
  early_leave_minutes: number;
  scheduled_minutes: number;
  worked_minutes: number;
  night_minutes: number;
  worked_days_off: number;
  worked_holidays: number;
  overtime_workday_minutes: number;
  overtime_day_off_minutes: number;
  overtime_holiday_minutes: number;
  overtime_pending_minutes: number;
  is_partial: boolean;
};

export type AttendanceSummary = { month: string; locked: boolean; rows: AttendanceSummaryRow[] };

export type AttendancePeriod = { month: string; locked_at: string; locked_by: { id: number; name: string } | null };

export type AttendanceCorrection = {
  id: number;
  date: string;
  reason: string;
  // Older requests only; newer ones list every time in requested_times.
  requested_check_in: string | null;
  requested_check_out: string | null;
  // Every scan the request asks to add, oldest first (ISO).
  requested_times: string[];
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  employee: Employee;
  requested_by: { id: number; name: string };
  reviewed_by: { id: number; name: string } | null;
};

export const api = {
  // Either an email, or a company code + employee ID — never both.
  login: (credentials: { email: string; password: string } | { company: string; employee_id: string; password: string }) =>
    request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  register: (companyName: string, name: string, email: string, password: string) =>
    request<{ token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ company_name: companyName, name, email, password }),
    }),

  me: () => request<MeResponse>("/api/me"),

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  branches: {
    list: () => request<Paginated<Branch>>("/api/branches"),
    all: () => requestAll<Branch>("/api/branches"),
    create: (data: Partial<Branch>) =>
      request<Branch>("/api/branches", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Branch>) =>
      request<Branch>(`/api/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    regenerateQr: (id: number) => request<Branch>(`/api/branches/${id}/regenerate-qr`, { method: "POST" }),
    remove: (id: number) => request<void>(`/api/branches/${id}`, { method: "DELETE" }),
  },

  employees: {
    // Loads up to 500 by default — the API's own default is only 25, which
    // silently hid everyone after the 25th. `total` is the real headcount.
    list: (params: { perPage?: number; departmentId?: number; teamId?: number } = {}) => {
      const query = new URLSearchParams({ per_page: String(params.perPage ?? 500) });
      if (params.departmentId) query.set("department_id", String(params.departmentId));
      if (params.teamId) query.set("team_id", String(params.teamId));
      return request<Paginated<Employee>>(`/api/employees?${query}`);
    },
    all: () => requestAll<Employee>("/api/employees?per_page=500"),
    get: (id: number) => request<Employee>(`/api/employees/${id}`),
    // Sends the (already resized) image; the server re-encodes it again.
    uploadPhoto: (id: number, photo: Blob) => {
      const body = new FormData();
      body.append("photo", photo, "photo.jpg");
      return request<{ photo_url: string | null }>(`/api/employees/${id}/photo`, { method: "POST", body });
    },
    removePhoto: (id: number) => request<void>(`/api/employees/${id}/photo`, { method: "DELETE" }),
    create: (data: EmployeeInput & { name: string; branch_id: number; password?: string; login_method?: "email" | "employee_id" }) =>
      request<Employee>("/api/employees", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: EmployeeInput) =>
      request<Employee>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/employees/${id}`, { method: "DELETE" }),
    removeMany: (ids: number[]) =>
      request<{ deleted: number }>("/api/employees/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),
    createLogin: (id: number, data: LoginSetup) =>
      request<Employee>(`/api/employees/${id}/login`, { method: "POST", body: JSON.stringify(data) }),
    // A PDF, not JSON, so it can't go through request() — same reasoning as
    // attendance.export below.
    card: async (id: number): Promise<Blob> => {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/employees/${id}/card`, {
        headers: { Accept: "application/pdf", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.message ?? `Couldn't generate the card (${res.status})`, body.errors, body.code);
      }

      return res.blob();
    },
  },

  users: {
    list: () => request<CompanyUser[]>("/api/users"),
    invite: (data: { name: string; email: string; password: string; role: string }) =>
      request<CompanyUser>("/api/users", { method: "POST", body: JSON.stringify(data) }),
    updateRole: (id: number, role: string) =>
      request<CompanyUser>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) }),
    setActive: (id: number, is_active: boolean) =>
      request<CompanyUser>(`/api/users/${id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      }),
    setBranchAccess: (id: number, branch_ids: number[]) =>
      request<CompanyUser>(`/api/users/${id}/branch-access`, {
        method: "PUT",
        body: JSON.stringify({ branch_ids }),
      }),
    remove: (id: number) => request<void>(`/api/users/${id}`, { method: "DELETE" }),
  },

  roles: {
    list: () => request<Role[]>("/api/roles"),
    permissions: () => request<PermissionGroup[]>("/api/permissions"),
    create: (data: { name: string; permissions: string[]; sort_order?: number | null }) =>
      request<Role>("/api/roles", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; permissions?: string[]; sort_order?: number | null }) =>
      request<Role>(`/api/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/roles/${id}`, { method: "DELETE" }),
  },

  workLocations: {
    list: () => request<Paginated<WorkLocation>>("/api/work_locations"),
    all: () => requestAll<WorkLocation>("/api/work_locations"),
    create: (data: Partial<WorkLocation>) =>
      request<WorkLocation>("/api/work_locations", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<WorkLocation>) =>
      request<WorkLocation>(`/api/work_locations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    regenerateQr: (id: number) =>
      request<WorkLocation>(`/api/work_locations/${id}/regenerate-qr`, { method: "POST" }),
    remove: (id: number) => request<void>(`/api/work_locations/${id}`, { method: "DELETE" }),
  },

  // Pass a large perPage to fill a dropdown (the API caps it at 200).
  departments: {
    list: (perPage = 25) => request<Paginated<Department>>(`/api/departments?per_page=${perPage}`),
    all: () => requestAll<Department>("/api/departments?per_page=200"),
    create: (data: Partial<Omit<Department, "id">>) =>
      request<Department>("/api/departments", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Omit<Department, "id">>) =>
      request<Department>(`/api/departments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/departments/${id}`, { method: "DELETE" }),
    addMembers: (id: number, employeeIds: number[]) =>
      request<{ added: number }>(`/api/departments/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ employee_ids: employeeIds }),
      }),
    removeMember: (id: number, employeeId: number) =>
      request<void>(`/api/departments/${id}/members/${employeeId}`, { method: "DELETE" }),
  },

  teams: {
    list: (perPage = 25) => request<Paginated<Team>>(`/api/teams?per_page=${perPage}`),
    all: () => requestAll<Team>("/api/teams?per_page=200"),
    create: (data: Partial<Omit<Team, "id">>) =>
      request<Team>("/api/teams", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Omit<Team, "id">>) =>
      request<Team>(`/api/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/teams/${id}`, { method: "DELETE" }),
    addMembers: (id: number, employeeIds: number[]) =>
      request<{ added: number }>(`/api/teams/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ employee_ids: employeeIds }),
      }),
    removeMember: (id: number, employeeId: number) =>
      request<void>(`/api/teams/${id}/members/${employeeId}`, { method: "DELETE" }),
  },

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

  holidays: {
    list: () => request<Paginated<Holiday>>("/api/holidays"),
    all: () => requestAll<Holiday>("/api/holidays"),
    create: (data: Partial<Holiday>) =>
      request<Holiday>("/api/holidays", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Holiday>) =>
      request<Holiday>(`/api/holidays/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/holidays/${id}`, { method: "DELETE" }),
    import: (holidays: { name: string; date: string }[]) =>
      request<{ created: number; skipped: string[] }>("/api/holidays/import", {
        method: "POST",
        body: JSON.stringify({ holidays }),
      }),
  },

  calendar: {
    team: (month: string, branchId?: number) =>
      request<TeamCalendar>(`/api/calendar/team?month=${month}${branchId ? `&branch_id=${branchId}` : ""}`),
    month: (month: string, employeeId?: number) =>
      request<CalendarMonth>(`/api/calendar?month=${month}${employeeId ? `&employee_id=${employeeId}` : ""}`),
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

  dashboard: {
    summary: () => request<DashboardSummary>("/api/dashboard/summary"),
  },

  attendance: {
    // The API sends 50 rows unless asked for more (max 1000) — say so, or a busy
    // company's list silently stops after the newest 50.
    list: (params?: {
      employee_id?: number;
      from?: string;
      to?: string;
      per_page?: number;
      status?: AttendanceDayStatus;
      exception?: AttendanceException;
    }) => {
      const query = new URLSearchParams(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]),
      ).toString();
      return request<Paginated<AttendanceDay>>(`/api/attendance${query ? `?${query}` : ""}`);
    },
    // One scan: the person's schedule decides whether it's an IN or an OUT.
    scan: (data?: { qr_token?: string; latitude?: number; longitude?: number }) =>
      request<ScanResult>("/api/attendance/scan", { method: "POST", body: JSON.stringify(data ?? {}) }),
    today: () => request<AttendanceToday>("/api/attendance/today"),
    // An admin fixing a day directly: void wrong scans, add missing ones ("2026-10-05T17:00", company clock).
    // day is null when nothing is left to keep (e.g. every scan on a day off removed).
    adjust: (data: { employee_id: number; date: string; reason: string; add: string[]; void: number[] }) =>
      request<{ day: AttendanceDay | null }>("/api/attendance/adjustments", { method: "POST", body: JSON.stringify(data) }),
    overtime:(params: { status?: "pending" | "approved" | "rejected"; from?: string; to?: string } = {}) => {
      const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
      return request<OvertimeEntry[]>(`/api/attendance/overtime${query.size ? `?${query}` : ""}`);
    },
    approveOvertime: (dayId: number) =>
      request<{ id: number; overtime_status: string }>(`/api/attendance/days/${dayId}/overtime/approve`, { method: "POST", body: "{}" }),
    rejectOvertime: (dayId: number) =>
      request<{ id: number; overtime_status: string }>(`/api/attendance/days/${dayId}/overtime/reject`, { method: "POST", body: "{}" }),
    summary: (month: string, employeeId?: number) =>
      request<AttendanceSummary>(`/api/attendance/summary?month=${month}${employeeId ? `&employee_id=${employeeId}` : ""}`),
    periods: () => request<AttendancePeriod[]>("/api/attendance/periods"),
    // ignorePendingOvertime: lock even though some overtime was never reviewed (it won't be paid).
    lockMonth: (month: string, ignorePendingOvertime = false) =>
      request<{ month: string; locked_at: string }>("/api/attendance/periods", {
        method: "POST",
        body: JSON.stringify({ month, ignore_pending_overtime: ignorePendingOvertime }),
      }),
    unlockMonth: (month: string) => request<void>(`/api/attendance/periods/${month}`, { method: "DELETE" }),
    // The report is a file, not JSON, so it can't go through request(). It still
    // needs the login header, which is why a plain <a href> can't be used either.
    export: async (params: { from: string; to: string; employee_id?: number }): Promise<{ blob: Blob; filename: string }> => {
      const query = new URLSearchParams({ from: params.from, to: params.to });
      if (params.employee_id) query.set("employee_id", String(params.employee_id));

      const token = getToken();
      const res = await fetch(`${API_URL}/api/attendance/export?${query}`, {
        headers: { Accept: "text/csv, application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.message ?? `Export failed (${res.status})`, body.errors, body.code);
      }

      const named = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "");
      return { blob: await res.blob(), filename: named?.[1] ?? `attendance-${params.from}-to-${params.to}.csv` };
    },
  },

  attendanceCorrections: {
    list: () => request<Paginated<AttendanceCorrection>>("/api/attendance/corrections"),
    all: () => requestAll<AttendanceCorrection>("/api/attendance/corrections?per_page=500"),
    create: (data: {
      employee_id?: number;
      date: string;
      reason: string;
      // Scans to add, on the company's clock: "2026-10-05T12:00".
      scans: string[];
    }) =>
      request<AttendanceCorrection>("/api/attendance/corrections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    approve: (id: number) =>
      request<AttendanceCorrection>(`/api/attendance/corrections/${id}/approve`, { method: "POST", body: "{}" }),
    reject: (id: number) =>
      request<AttendanceCorrection>(`/api/attendance/corrections/${id}/reject`, { method: "POST", body: "{}" }),
  },

  notifications: {
    list: () => request<Notification[]>("/api/notifications"),
    // Cheap to poll: the unread count and the newest unread alert's id.
    unreadCount: () => request<{ count: number; latest_id: number | null }>("/api/notifications/unread-count"),
    markAsRead: (id: number) =>
      request<void>(`/api/notifications/${id}/read`, { method: "POST" }),
    markAllAsRead: () => request<void>("/api/notifications/read-all", { method: "POST" }),
  },

  // Push notifications to this device, even with the app closed.
  push: {
    // enabled is false when the server has no push keys set up.
    key: () => request<{ enabled: boolean; public_key: string | null }>("/api/push/key"),
    subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string }; content_encoding?: string }) =>
      request<void>("/api/push/subscriptions", { method: "POST", body: JSON.stringify(subscription) }),
    unsubscribe: (endpoint: string) => request<void>("/api/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  },

  profile: {
    update: (data: { name: string; email: string | null }) =>
      request<{ id: number; name: string; email: string | null }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updatePassword: (data: {
      current_password: string;
      password: string;
      password_confirmation: string;
    }) =>
      request<{ message: string }>("/api/profile/password", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
};
