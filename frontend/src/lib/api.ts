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
const ACCOUNT_BLOCKED_CODES = ["trial_expired", "company_suspended", "company_cancelled"];
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
    if (!(err instanceof TypeError)) throw err;
    await sleep(800);
    return sendOnce<T>(path, options);
  }
}

async function sendOnce<T>(path: string, options: RequestInit): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      // A FormData body sets its own multipart boundary — forcing JSON would break uploads.
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

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
  gender?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  notes?: string | null;
};

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

type Paginated<T> = { data: T[]; total: number };

export type CalendarDayType = "work" | "holiday" | "day_off" | "weekly_off" | "none";
export type CalendarAttendance = "present" | "late" | "absent" | "missing_checkout";

export type CalendarDay = {
  date: string;
  type: CalendarDayType;
  label: string | null;
  day_off_id: number | null;
  shift: { name: string; start_time: string; end_time: string } | null;
  schedule_id: number | null;
  work_location: string | null;
  // What actually happened; null for future days and days with nothing planned.
  attendance: CalendarAttendance | null;
  late_minutes: number | null;
  check_in: string | null;
  check_out: string | null;
};

export type CalendarMonth = {
  employee: { id: number; name: string };
  month: string;
  today: string;
  timezone: string;
  // 0 = Sunday .. 6 = Saturday
  weekly_off_days: number[];
  summary: { work_days: number; holidays: number; days_off: number; present: number; late: number; absent: number };
  days: CalendarDay[];
};

export type TeamCalendarEmployee = {
  id: number;
  name: string;
  employee_code: string | null;
  branch: string | null;
  summary: CalendarMonth["summary"];
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
    // The last 7 days, oldest first — days with none are included as 0.
    week: { date: string; count: number }[];
    recent: {
      id: number;
      date: string;
      status: "open" | "completed" | "missing_checkout";
      late_minutes: number;
      check_in: string | null;
      check_out: string | null;
      employee: { id: number; name: string; photo_url: string | null };
    }[];
  } | null;
};

export type Notification = {
  id: number;
  data: { title: string; body?: string; [key: string]: unknown };
  read_at: string | null;
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

export type Shift = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_break_paid: boolean;
  grace_minutes: number;
  is_active: boolean;
};

export type Holiday = {
  id: number;
  name: string;
  date: string;
  is_recurring_yearly: boolean;
};

export type ScheduleBulkInput = {
  employee_ids: number[];
  shift_id: number;
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
  skipped: { holiday: number; day_off: number; already_scheduled: number; employee_left: number };
};

export type Schedule = {
  id: number;
  date: string;
  notes: string | null;
  employee: Employee;
  shift: Shift;
  work_location: WorkLocation | null;
};

export type AttendanceEvent = {
  id: number;
  event_type: "check_in" | "check_out";
  event_time: string;
  // qr / gps / correction / none — how presence was verified.
  method: "qr" | "gps" | "correction" | "none" | null;
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

export type AttendanceSession = {
  id: number;
  date: string;
  status: "open" | "completed" | "missing_checkout";
  worked_minutes: number | null;
  late_minutes: number;
  employee: Employee;
  schedule: { shift: { name: string; start_time: string; end_time: string } | null } | null;
  check_in_event: AttendanceEvent | null;
  check_out_event: AttendanceEvent | null;
};

export type AttendanceCorrection = {
  id: number;
  date: string;
  reason: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
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
    createLogin: (id: number, data: LoginSetup) =>
      request<Employee>(`/api/employees/${id}/login`, { method: "POST", body: JSON.stringify(data) }),
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
    create: (data: { name: string; permissions: string[] }) =>
      request<Role>("/api/roles", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; permissions?: string[] }) =>
      request<Role>(`/api/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/roles/${id}`, { method: "DELETE" }),
  },

  workLocations: {
    list: () => request<Paginated<WorkLocation>>("/api/work_locations"),
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

  shifts: {
    list: () => request<Paginated<Shift>>("/api/shifts"),
    create: (data: Partial<Shift>) =>
      request<Shift>("/api/shifts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Shift>) =>
      request<Shift>(`/api/shifts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/shifts/${id}`, { method: "DELETE" }),
  },

  holidays: {
    list: () => request<Paginated<Holiday>>("/api/holidays"),
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
    weeklyOffDays: () => request<{ weekly_off_days: number[] }>("/api/calendar/weekly-off-days"),
    setWeeklyOffDays: (days: number[]) =>
      request<{ weekly_off_days: number[] }>("/api/calendar/weekly-off-days", {
        method: "PUT",
        body: JSON.stringify({ days }),
      }),
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
    // Rosters many people over a date range in one go. dry_run only reports what it would do.
    bulk: (data: ScheduleBulkInput) =>
      request<ScheduleBulkResult>("/api/schedules/bulk", { method: "POST", body: JSON.stringify(data) }),
    create: (data: { employee_id: number; shift_id: number; work_location_id?: number | null; date: string; notes?: string }) =>
      request<Schedule>("/api/schedules", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { employee_id?: number; shift_id?: number; work_location_id?: number | null; date?: string; notes?: string | null }) =>
      request<Schedule>(`/api/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/schedules/${id}`, { method: "DELETE" }),
  },

  dashboard: {
    summary: () => request<DashboardSummary>("/api/dashboard/summary"),
  },

  attendance: {
    // The API sends 50 rows unless asked for more (max 1000) — say so, or a busy
    // company's list silently stops after the newest 50.
    list: (params?: { employee_id?: number; from?: string; to?: string; per_page?: number }) => {
      const query = new URLSearchParams(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][],
      ).toString();
      return request<Paginated<AttendanceSession>>(`/api/attendance${query ? `?${query}` : ""}`);
    },
    checkIn: (data?: { qr_token?: string; latitude?: number; longitude?: number }) =>
      request<AttendanceEvent>("/api/attendance/check-in", { method: "POST", body: JSON.stringify(data ?? {}) }),
    checkOut: (data?: { qr_token?: string; latitude?: number; longitude?: number }) =>
      request<AttendanceEvent>("/api/attendance/check-out", { method: "POST", body: JSON.stringify(data ?? {}) }),
  },

  attendanceCorrections: {
    list: () => request<Paginated<AttendanceCorrection>>("/api/attendance/corrections"),
    create: (data: {
      employee_id?: number;
      date: string;
      reason: string;
      requested_check_in?: string;
      requested_check_out?: string;
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
    markAsRead: (id: number) =>
      request<void>(`/api/notifications/${id}/read`, { method: "POST" }),
    markAllAsRead: () => request<void>("/api/notifications/read-all", { method: "POST" }),
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
