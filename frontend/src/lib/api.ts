const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "business_os_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
  user: { id: number; name: string; email: string; company_id: number | null; is_platform_admin: boolean };
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
  qr_token: string | null;
};

// What the employee form sends — every optional field is null when cleared.
export type EmployeeInput = {
  name?: string;
  employee_code?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  branch_id?: number;
  employment_status?: string;
  employment_type?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  notes?: string | null;
};

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
  branch_id: number | null;
  branch: Branch | null;
  // Whether this employee has a login linked to them — without one they
  // can never sign in or check in.
  has_login: boolean;
};

type Paginated<T> = { data: T[] };

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

export type Notification = {
  id: number;
  data: { title: string; body?: string; [key: string]: unknown };
  read_at: string | null;
  created_at: string;
};

export type CompanyUser = {
  id: number;
  name: string;
  email: string;
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
  login: (email: string, password: string) =>
    request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
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
    list: () => request<Paginated<Employee>>("/api/employees"),
    create: (data: EmployeeInput & { name: string; branch_id: number; password?: string }) =>
      request<Employee>("/api/employees", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: EmployeeInput) =>
      request<Employee>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/employees/${id}`, { method: "DELETE" }),
    createLogin: (id: number, data: { email: string; password: string }) =>
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
    list: () => request<Paginated<Schedule>>("/api/schedules"),
    create: (data: { employee_id: number; shift_id: number; work_location_id?: number | null; date: string; notes?: string }) =>
      request<Schedule>("/api/schedules", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { employee_id?: number; shift_id?: number; work_location_id?: number | null; date?: string; notes?: string | null }) =>
      request<Schedule>(`/api/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/schedules/${id}`, { method: "DELETE" }),
  },

  attendance: {
    list: (params?: { employee_id?: number; from?: string; to?: string }) => {
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
    update: (data: { name: string; email: string }) =>
      request<{ id: number; name: string; email: string }>("/api/profile", {
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
