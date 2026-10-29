// Leave and other requests, leave types and balances.

import { request } from "./client";
import type { Paginated } from "./client";

export type LeaveType = {
  id: number;
  code: string;
  name: string;
  name_km: string | null;
  // 0 unpaid, 50 half pay (maternity), 100 full pay.
  pay_percent: number;
  // work_days: holidays and days off inside a range are free; calendar_days: every day counts.
  counts: "work_days" | "calendar_days";
  accrual: "none" | "monthly" | "yearly";
  yearly_days: number | null;
  seniority_every_years: number | null;
  seniority_extra_days: number | null;
  eligible_after_months: number | null;
  // false = can't be taken by someone still on probation.
  allowed_during_probation: boolean;
  requires_balance: boolean;
  allow_half_day: boolean;
  // A file is needed for requests of at least this many days (1 = always); null = never.
  attachment_from_days: number | null;
  min_notice_days: number | null;
  max_days_per_request: number | null;
  gender: "male" | "female" | null;
  is_active: boolean;
  sort_order: number | null;
};

export type LeaveTypeInput = Partial<Omit<LeaveType, "id">>;

// Worked out by the server, never stored: earned + adjustments − used − pending.
export type LeaveBalance = {
  leave_type: { id: number; code: string; name: string; name_km: string | null };
  year: number;
  // Earned so far this year; full_year is what the whole year gives.
  earned: number;
  full_year: number;
  adjustments: number;
  used: number;
  pending: number;
  available: number;
};

export type LeaveBalances = {
  employee: { id: number; name: string; hire_date: string | null };
  year: number;
  balances: LeaveBalance[];
  can_adjust: boolean;
};

export type LeaveAdjustment = {
  id: number;
  employee_id: number;
  year: number;
  days: number;
  reason: string;
  leave_type: { id: number; name: string } | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
};

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type DayPart = "full" | "am" | "pm";

// paid: what the day pays in the end — the approver's choice, else the leave type's.
export type RequestDate = { date: string; portion: number; part: DayPart; paid: boolean };

export type EmployeeRequest = {
  id: number;
  type: "leave" | "late_early";
  // In words: "Annual leave", "Late arrival", "Early leave".
  label: string;
  // late_early only: which end of the day, the approved time, and the minutes it excuses.
  details: { kind: "late" | "early"; time: string; minutes: number } | null;
  status: RequestStatus;
  employee: { id: number; name: string; branch: string | null };
  leave_type: { id: number; code: string; name: string; name_km: string | null; pay_percent: number } | null;
  start_date: string;
  end_date: string;
  day_part: DayPart;
  days: number;
  dates: RequestDate[];
  // "2 of 3 days paid (Mon 12 Oct, Tue 13 Oct)" when the approver changed which days are paid, else null.
  pay_note: string | null;
  // Set when someone corrected the paid days after approval (from / to in days).
  pay_changed: { from: number; to: number; by_name: string; at: string; notes: string | null } | null;
  // Set when someone corrected the leave type (e.g. asked as annual leave, really sick leave).
  changed_from: { leave_type: string; by_name: string; at: string; notes: string | null } | null;
  reason: string | null;
  // Signed, short-lived links — open with photoSrc().
  attachments: { id: number; name: string; mime: string; size: number; url: string }[];
  requested_by: { id: number; name: string } | null;
  created_at: string | null;
  // The line manager it waits on; null = any approver for the branch.
  waiting_on: { id: number; name: string } | null;
  decided_by: { id: number; name: string } | null;
  decided_at: string | null;
  decision_notes: string | null;
  cancelled_by: { id: number; name: string } | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  // set_pay: may choose which days are paid — while approving, or fix them on approved leave.
  // change_type: may correct the leave type (waiting or approved, open months only).
  can: { decide: boolean; set_pay: boolean; change_type: boolean; cancel: boolean; delete: boolean };
};

export type LeaveRequestInput = {
  employee_id?: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  day_part?: DayPart;
  reason?: string;
  // Recording leave for someone else: approve it straight away.
  approve?: boolean;
};

// Permission to arrive late or leave early on one work day.
export type LateEarlyInput = {
  employee_id?: number;
  date: string;
  kind: "late" | "early";
  // HH:MM — when they will arrive, or leave.
  time: string;
  reason?: string;
  approve?: boolean;
};

export type LateEarlyPreview = {
  // The usual start (late) or end (early) that day, HH:MM.
  expected: string | null;
  minutes: number;
  used_this_month: number;
  // null = no limit.
  monthly_limit: number | null;
  problems: Record<string, string>;
};

export type LateEarlySettings = { type: "late_early"; is_active: boolean; pay_percent: 0 | 100; monthly_limit: number | null };

export type LeavePreview = {
  days: RequestDate[];
  total: number;
  // One per calendar year the request touches; empty when the type keeps no balance.
  balances: (LeaveBalance & { after: number })[];
  attachment_required: boolean;
  // Field → message: anything that would stop it being sent.
  problems: Record<string, string>;
};

export const requestsApi = {
  leave: {
    // all = include turned-off types (for the policy page).
    types: (all = false) => request<LeaveType[]>(`/api/leave-types${all ? "?all=1" : ""}`),
    createType: (data: LeaveTypeInput & { code: string }) =>
      request<LeaveType>("/api/leave-types", { method: "POST", body: JSON.stringify(data) }),
    updateType: (id: number, data: LeaveTypeInput) =>
      request<LeaveType>(`/api/leave-types/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    balances: (params: { employeeId?: number; year?: number } = {}) => {
      const query = new URLSearchParams();
      if (params.employeeId) query.set("employee_id", String(params.employeeId));
      if (params.year) query.set("year", String(params.year));
      return request<LeaveBalances>(`/api/leave-balances?${query}`);
    },
    lateEarlySettings: () => request<LateEarlySettings>("/api/request-settings/late_early"),
    updateLateEarlySettings: (data: Partial<Omit<LateEarlySettings, "type">>) =>
      request<LateEarlySettings>("/api/request-settings/late_early", { method: "PUT", body: JSON.stringify(data) }),
    adjustments: (employeeId: number) => request<LeaveAdjustment[]>(`/api/leave-adjustments?employee_id=${employeeId}`),
    adjust: (data: { employee_id: number; leave_type_id: number; year: number; days: number; reason: string }) =>
      request<LeaveAdjustment>("/api/leave-adjustments", { method: "POST", body: JSON.stringify(data) }),
  },
  requests: {
    // mine = about me; approvals = waiting on me; all = my branches (requests.manage).
    list: (params: { scope?: "mine" | "approvals" | "all"; status?: RequestStatus; from?: string; to?: string } = {}) => {
      const query = new URLSearchParams({ per_page: "500", scope: params.scope ?? "mine" });
      if (params.status) query.set("status", params.status);
      if (params.from) query.set("from", params.from);
      if (params.to) query.set("to", params.to);
      return request<Paginated<EmployeeRequest>>(`/api/requests?${query}`).then((page) => page.data);
    },
    waitingCount: () => request<{ count: number }>("/api/requests/waiting-count"),
    get: (id: number) => request<EmployeeRequest>(`/api/requests/${id}`),
    preview: (data: LeaveRequestInput) => request<LeavePreview>("/api/requests/preview", { method: "POST", body: JSON.stringify(data) }),
    // Multipart, so a certificate can go with it.
    create: (data: LeaveRequestInput, attachment?: File | null) => {
      const body = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        body.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
      });
      if (attachment) body.append("attachment", attachment);
      return request<EmployeeRequest>("/api/requests", { method: "POST", body });
    },
    previewLateEarly: ({ date, ...rest }: LateEarlyInput) =>
      request<LateEarlyPreview>("/api/requests/preview", {
        method: "POST",
        body: JSON.stringify({ ...rest, type: "late_early", start_date: date, end_date: date }),
      }),
    createLateEarly: ({ date, ...rest }: LateEarlyInput, attachment?: File | null) => {
      const body = new FormData();
      const fields: Record<string, unknown> = { ...rest, type: "late_early", start_date: date, end_date: date };
      Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        body.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
      });
      if (attachment) body.append("attachment", attachment);
      return request<EmployeeRequest>("/api/requests", { method: "POST", body });
    },
    // Approved leave: fix which days are paid (every other day unpaid). Open months only.
    editPay: (id: number, paidDates: string[], notes?: string) =>
      request<EmployeeRequest>(`/api/requests/${id}/paid-days`, {
        method: "POST",
        body: JSON.stringify({ paid_dates: paidDates, notes: notes || null }),
      }),
    changeType: (id: number, leaveTypeId: number, notes?: string) =>
      request<EmployeeRequest>(`/api/requests/${id}/change-type`, {
        method: "POST",
        body: JSON.stringify({ leave_type_id: leaveTypeId, notes: notes || null }),
      }),
    // paidDates: the days to pay, every other day unpaid (needs can.set_pay); left out = as the leave type says.
    approve: (id: number, notes?: string, paidDates?: string[]) =>
      request<EmployeeRequest>(`/api/requests/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: notes || null, ...(paidDates ? { paid_dates: paidDates } : {}) }),
      }),
    // A rejection always needs a reason.
    reject: (id: number, notes: string) =>
      request<EmployeeRequest>(`/api/requests/${id}/reject`, { method: "POST", body: JSON.stringify({ notes }) }),
    cancel: (id: number, reason?: string) =>
      request<EmployeeRequest>(`/api/requests/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason || null }) }),
    deleteMany: (ids: number[]) =>
      request<{ deleted: number }>("/api/requests/delete", { method: "POST", body: JSON.stringify({ ids }) }),
  },
};
