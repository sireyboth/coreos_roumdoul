// Attendance: scans, days, corrections, overtime and month close.

import { currentLang } from "@/lib/i18n";
import { API_URL, ApiError, getToken, request, requestAll } from "./client";
import type { Paginated } from "./client";
import type { Employee } from "./organization";

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
  kind: "work" | "holiday" | "day_off" | "weekly_off" | "leave" | "unscheduled";
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
    // Their display order (lowest first).
    sort_order?: number | null;
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
  employee: { id: number; name: string; employee_code: string | null; sort_order?: number | null };
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
  employee: { id: number; name: string; employee_code: string | null; sort_order?: number | null; branch: string | null };
  scheduled_days: number;
  weekly_days_off: number;
  days_off: number;
  holidays: number;
  // Approved leave in days (a half day is 0.5), split by pay.
  leave_days?: number;
  paid_leave_days?: number;
  unpaid_leave_days?: number;
  leave_by_type?: { type: string; days: number }[];
  // Approved late arrival / early leave, in minutes; the unpaid part when the company doesn't pay it.
  excused_minutes?: number;
  unpaid_excused_minutes?: number;
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

// ───────────── Leave and other requests ─────────────

export type AttendanceCorrection = {
  id: number;
  date: string;
  reason: string;
  // Older requests only; newer ones list every time in requested_times.
  requested_check_in: string | null;
  requested_check_out: string | null;
  // Every scan the request asks to add, oldest first (ISO).
  requested_times: string[];
  status: "pending" | "approved" | "rejected" | "cancelled";
  // The remark from whoever approved, rejected or cancelled it — the employee reads it.
  review_notes: string | null;
  employee: Employee;
  requested_by: { id: number; name: string };
  reviewed_by: { id: number; name: string } | null;
};


// ───────────────────────────── Payroll ─────────────────────────────

export const attendanceApi = {
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
      // Only days with a scan the schedule expected and never got.
      missed?: boolean;
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
    deleteDays: (ids: number[]) =>
      request<{ deleted: number }>("/api/attendance/days/delete", { method: "POST", body: JSON.stringify({ ids }) }),
    fillMissed: (ids: number[], reason: string, times?: Record<number, string>) =>
      request<{ filled: number; skipped: number }>("/api/attendance/days/fill-missed", { method: "POST", body: JSON.stringify({ ids, reason, times }) }),
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
    // with_ids adds an "Employee key" column (the internal id), for the in-app report to open a day.
    export: async (params: { from: string; to: string; employee_id?: number; with_ids?: boolean }): Promise<{ blob: Blob; filename: string }> => {
      const query = new URLSearchParams({ from: params.from, to: params.to });
      if (params.employee_id) query.set("employee_id", String(params.employee_id));
      if (params.with_ids) query.set("with_ids", "1");

      const token = getToken();
      const res = await fetch(`${API_URL}/api/attendance/export?${query}`, {
        headers: { Accept: "text/csv, application/json", "Accept-Language": currentLang(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
    all: (params: { from?: string; to?: string } = {}) => {
      const query = new URLSearchParams({ per_page: "500" });
      if (params.from) query.set("from", params.from);
      if (params.to) query.set("to", params.to);
      return requestAll<AttendanceCorrection>(`/api/attendance/corrections?${query}`);
    },
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
    approve: (id: number, remark?: string) =>
      request<AttendanceCorrection>(`/api/attendance/corrections/${id}/approve`, { method: "POST", body: JSON.stringify({ review_notes: remark || null }) }),
    // A rejection always needs a remark.
    reject: (id: number, remark: string) =>
      request<AttendanceCorrection>(`/api/attendance/corrections/${id}/reject`, { method: "POST", body: JSON.stringify({ review_notes: remark }) }),
    // Only while waiting. Your own: remark optional; a manager cancelling: remark required.
    cancel: (id: number, remark?: string) =>
      request<AttendanceCorrection>(`/api/attendance/corrections/${id}/cancel`, { method: "POST", body: JSON.stringify({ review_notes: remark || null }) }),
  },
};
