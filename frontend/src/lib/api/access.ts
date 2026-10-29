// Users, roles and the audit log.

import { request } from "./client";
import type { Paginated } from "./client";

/** Areas of the app the activity log groups events into. */
export type AuditModule = "people" | "attendance" | "schedules" | "requests" | "salary" | "payroll" | "access" | "company";

/** One line of the activity log: who did what, when, and from where. */
export type AuditEntry = {
  id: number;
  created_at: string;
  // e.g. "employee.updated", "pay_run.approved".
  event: string;
  module: AuditModule | null;
  // "support" = the platform's support team, acting through support access.
  actor: { type: "user" | "support" | "system"; id: number | null; name: string };
  subject: { type: string; id: number | null; label: string | null } | null;
  // null = company-wide (a role, a pay rule…), not tied to one branch.
  branch: { id: number; name: string } | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  method: string | null;
  path: string | null;
};

export type AuditFilters = {
  from?: string;
  to?: string;
  user_id?: string;
  branch_id?: string;
  module?: string;
  action?: string;
  search?: string;
  page?: number;
  per_page?: number;
};

export type AuditOptions = { users: { id: number; name: string }[]; branches: { id: number; name: string }[]; modules: AuditModule[] };

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

export const accessApi = {
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
  // Read-only; the server already limits it to the viewer's branches and pay access.
  audit: {
    list: (filters: AuditFilters = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") query.set(key, String(value));
      }
      return request<Paginated<AuditEntry> & { current_page: number; per_page: number }>(`/api/audit-logs?${query}`);
    },
    options: () => request<AuditOptions>("/api/audit-logs/options"),
  },
};
