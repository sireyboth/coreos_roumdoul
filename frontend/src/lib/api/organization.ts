// Company structure and people: branches, departments, teams, employees, work locations, holidays, dashboard.

import { currentLang } from "@/lib/i18n";
import { API_URL, ApiError, getToken, request, requestAll } from "./client";
import type { Paginated } from "./client";
import type { AttendanceDayStatus, AttendanceException } from "./attendance";

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
  manager_employee_id?: number | null;
  employment_status?: string;
  employment_type?: string | null;
  hire_date?: string | null;
  // Probation only; null = the company's default length from the hire date.
  probation_end_date?: string | null;
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
  // New employees only: the pay group they are paid with from their first day (left out = the default group).
  pay_group_id?: number;
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
  // The last day of probation (it starts on hire_date). Sent with the
  // identity details below; kept after they pass, as a record.
  probation_end_date?: string | null;
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
  // Line manager: approves this person's requests first.
  manager_employee_id?: number | null;
  manager?: { id: number; name: string } | null;
  // A short-lived signed link — use photoSrc() to turn it into an image URL.
  photo_url?: string | null;
  // How this person signs in — only sent (to managers) when they have a login.
  login?: { method: "email" | "employee_id"; identifier: string | null; company_code: string };
  // Whether this employee has a login linked to them — without one they
  // can never sign in or check in.
  has_login: boolean;
};

// One small answer for the whole dashboard, counted by the server. Sections the
// caller can't see are null.
// Day and month only — the API never sends the year, so never anyone's age.
export type Birthday = {
  employee: {
    id: number;
    name: string;
    employee_code: string | null;
    job_title: string | null;
    photo_url: string | null;
    branch: { id: number; name: string } | null;
    department: { id: number; name: string } | null;
  };
  month: number;
  day: number;
  // Next time it comes round, in the company's timezone (today counts).
  next_date: string;
  days_until: number;
};

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

export type Holiday = {
  id: number;
  name: string;
  date: string;
  is_recurring_yearly: boolean;
};

export type ProbationSettings = {
  probation_length: number;
  probation_unit: "days" | "months";
  probation_reminder_days: number | null;
};

export const organizationApi = {
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
    // Probation decisions: passed (Active from today) or more time (a later end date).
    passProbation: (id: number) => request<Employee>(`/api/employees/${id}/probation/pass`, { method: "POST" }),
    extendProbation: (id: number, probationEndDate: string) =>
      request<Employee>(`/api/employees/${id}/probation/extend`, { method: "POST", body: JSON.stringify({ probation_end_date: probationEndDate }) }),
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
        headers: { Accept: "application/pdf", "Accept-Language": currentLang(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.message ?? `Couldn't generate the card (${res.status})`, body.errors, body.code);
      }

      return res.blob();
    },
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
  dashboard: {
    summary: () => request<DashboardSummary>("/api/dashboard/summary"),
  },
  // Soonest first; `today` is the company's date, not the browser's.
  birthdays: () => request<{ today: string; data: Birthday[] }>("/api/birthdays"),
  // Company-wide rules (company.manage). Read back through me.company.
  probation: {
    updateSettings: (data: ProbationSettings) =>
      request<{ id: number } & ProbationSettings>("/api/probation/settings", { method: "PUT", body: JSON.stringify(data) }),
  },
};
