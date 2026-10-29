// Payroll: settings, pay groups, pay runs, payslips, adjustments and employee pay.

import { currentLang } from "@/lib/i18n";
import { API_URL, ApiError, getToken, request } from "./client";

export type PayCurrency = "USD" | "KHR";

// earning · deduction (before tax, reduces gross) · net_deduction (after tax: advance, loan).
export type PayKind = "earning" | "deduction" | "net_deduction";

export type PayLineKind = PayKind | "statutory" | "employer";

export type PayTemplate = "overtime" | "attendance_bonus" | "absence" | "unpaid_leave" | "late" | "early_leave" | "unpaid_permission";

export type LatenessMode = "per_minute" | "per_time" | "count_based" | "tiers" | "none";

export type LatenessTier = { up_to_minutes: number | null; amount: number; day_fraction: number };

export type LatenessParams = { mode: LatenessMode; grace_minutes: number; amount: number; free_count: number; every_n: number; tiers: LatenessTier[] };

export type PayComponent = {
  id: number;
  code: string;
  name: string;
  kind: PayKind;
  // base = the salary · employee_item = an amount set per person · template = worked out from attendance.
  method: "base" | "employee_item" | "template";
  template: PayTemplate | null;
  params: Record<string, unknown> | null;
  taxable: boolean;
  nssf_insurable: boolean;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  employee_items_count?: number;
};

export type PayrollPolicy = {
  rate_basis: "fixed" | "calendar" | "scheduled";
  rate_basis_days: number;
  hours_per_day: number;
  missing_scan_policy: "review" | "present" | "absent";
  daily_paid_holidays: boolean;
  enforce_overtime_minimums: boolean;
  khr_rounding: number;
  fallback_exchange_rate: number | null;
  // The company's own details a bank's payroll file asks for, remembered between exports.
  bank_exports: { chipmong?: { company_code?: string | null; debit_account?: string | null } } | null;
};

export type PayrollSettings = {
  policy: PayrollPolicy;
  components: PayComponent[];
  presets: { key: string; name: string; description: string }[];
  templates: PayTemplate[];
};

// monthly / semi_monthly: periods end on cutoff_days (31 = last day). weekly / biweekly: every 7 / 14 days from anchor_date. custom: HR picks dates.
export type PaySchedule = "monthly" | "semi_monthly" | "weekly" | "biweekly" | "custom";

// A group's own version of a company component: switched on/off, or other rule params.
export type PayComponentRule = { is_active?: boolean; params?: Record<string, unknown> };

export type PayGroup = {
  id: number;
  name: string;
  schedule: PaySchedule;
  cutoff_days: number[] | null;
  anchor_date: string | null;
  // Null = the company's payroll policy.
  rate_basis: PayrollPolicy["rate_basis"] | null;
  rate_basis_days: number | null;
  hours_per_day: number | null;
  missing_scan_policy: PayrollPolicy["missing_scan_policy"] | null;
  daily_paid_holidays: boolean | null;
  component_rules: Record<string, PayComponentRule> | null;
  auto_calculate: boolean;
  is_default: boolean;
  sort_order: number;
  pay_runs_count: number;
  employees_count?: number;
  current_period: { start: string; end: string; label: string } | null;
};

export type PayGroupOption = { id: number; name: string; schedule: PaySchedule; is_default: boolean };

export type PayPeriodOption = { start: string; end: string; label: string; run: { id: number; status: PayRunStatus } | null };

export type PayWarning = { code: string; message: string; blocking: boolean; employee_ids?: number[] };

export type PayRunStatus = "draft" | "calculated" | "approved" | "paid";

// Per currency: USD and KHR salaries are never added together.
export type PayTotals = Record<string, { employees: number; gross: number; nssf_employee: number; tax: number; net: number; employer_cost: number }>;

export type PayRun = {
  id: number;
  // The month the period ends in.
  month: string;
  period_start: string;
  period_end: string;
  period_label: string;
  pay_group: { id: number; name: string; schedule: PaySchedule } | null;
  status: PayRunStatus;
  totals: PayTotals | null;
  warnings: PayWarning[] | null;
  calculated_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  approved_by: { id: number; name: string } | null;
  paid_by: { id: number; name: string } | null;
};

type PayEmployee = { id: number; name: string; employee_code: string | null; branch?: string | null } | null;

// Money arrives as strings ("520.00") from saved payslips and as numbers from a preview: always Number() it.
type Amount = number | string;

export type PayslipRow = {
  id: number;
  currency: PayCurrency;
  pay_type: "monthly" | "daily";
  base_salary: Amount;
  gross: Amount;
  nssf_employee: Amount;
  tax: Amount;
  net: Amount;
  employer_cost: Amount;
  warnings: PayWarning[] | null;
  // This person's pay inputs changed since the last calculation.
  is_stale: boolean;
  employee: PayEmployee;
};

// is_stale: something that feeds pay changed since the last calculation — recalculate to include it.
// stale_everyone: a shared input (rules, group, who is in it); else only stale_employee_ids need recalculating.
export type PayRunDetail = PayRun & { payslips: PayslipRow[]; is_stale: boolean; stale_everyone: boolean; stale_employee_ids: number[]; filename: string };

// The printed payroll report: each payslip with its lines and how the person is paid.
export type PayRunReportRow = Omit<PayslipRow, "is_stale" | "employee"> & {
  employee:
    | (NonNullable<PayEmployee> & {
        department: string | null;
        job_title: string | null;
        payment_method: "bank" | "cash";
        bank_name: string | null;
        bank_account_number: string | null;
        bank_account_name: string | null;
      })
    | null;
  // is_base: the salary line itself (told apart from other earnings by its component).
  lines: { code: string; name: string; kind: PayLineKind; amount: Amount; is_base: boolean }[];
};

export type PayRunReport = PayRun & { payslips: PayRunReportRow[] };

export type PayslipLine = { id?: number; code: string; name: string; kind: PayLineKind; amount: Amount; explanation: string | null };

export type PayslipInputs = {
  attendance: Record<string, unknown> & { present_days?: number; absent_days?: number; incomplete_days?: number; late_days?: number; late_minutes?: number };
  variables: Record<string, number | string>;
  rate_basis: { method: string; days: number; hours_per_day: number };
  period?: { start: string; end: string; days: number; salary_share: number };
  employed: { from: string; to: string };
  // Gross shared out over the calendar months of the paid days.
  months?: { month: string; days: number; gross: number }[];
  salaries: { amount: number; currency: PayCurrency; pay_type: string; from: string; to: string }[];
  profile: EmployeePayProfile;
  exchange_rate_source: "official" | "company_fallback" | null;
  taxable: number;
  insurable: number;
};

export type PayslipBody = {
  currency: PayCurrency;
  pay_type: "monthly" | "daily";
  base_salary: Amount;
  daily_rate: Amount;
  hourly_rate: Amount;
  exchange_rate: number | null;
  gross: Amount;
  nssf_employee: Amount;
  tax: Amount;
  net: Amount;
  employer_cost: Amount;
  inputs: PayslipInputs;
  warnings: PayWarning[] | null;
  employee: PayEmployee;
  lines: PayslipLine[];
  pay_group?: { id: number; name: string } | null;
  period_start?: string;
  period_end?: string;
  period_label?: string;
};

export type Payslip = PayslipBody & { id: number; pay_run_id: number; month: string; status: PayRunStatus };

export type PayrollAdjustment = {
  id: number;
  // Lands in the pay run whose period holds this date.
  date: string;
  kind: PayKind;
  name: string;
  amount: Amount;
  taxable: boolean;
  reason: string | null;
  source: "manual" | "import" | "correction";
  created_at: string;
  employee: PayEmployee;
  created_by: { id: number; name: string } | null;
};

export type PayrollAdjustmentInput = { employee_id: number; date: string; kind: PayKind; name: string; amount: number; taxable: boolean; reason: string | null };

export type SalaryReason = "hired" | "probation_passed" | "promotion" | "annual_increase" | "change" | "correction";

export type EmployeeSalary = {
  id: number;
  employee_id: number;
  amount: Amount;
  currency: PayCurrency;
  pay_type: "monthly" | "daily";
  effective_from: string;
  effective_to: string | null;
  reason: SalaryReason;
  note: string | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
};

export type EmployeePayProfile = {
  tax_resident: boolean;
  spouse_dependent: boolean;
  child_dependents: number;
  nssf_enrolled: boolean;
  payment_method: "bank" | "cash";
  bank_account_name: string | null;
};

export type EmployeePayItem = {
  id: number;
  pay_component_id: number;
  amount: Amount;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  component: { id: number; code: string; name: string; kind: PayKind } | null;
};

export type EmployeePayGroupRow = {
  id: number;
  pay_group_id: number;
  effective_from: string;
  effective_to: string | null;
  pay_group: { id: number; name: string } | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
};

export type EmployeePay = {
  // The group they are paid with today, and the history (newest first; before the first row: the default group).
  pay_group: { id: number; name: string; schedule: PaySchedule } | null;
  pay_groups: EmployeePayGroupRow[];
  // Last day an approved pay run paid them for: nothing on or before it can change.
  paid_through: string | null;
  salaries: EmployeeSalary[];
  profile: EmployeePayProfile;
  items: EmployeePayItem[];
  item_components: PayItemComponent[];
};

// An allowance or deduction set per person on the Pay tab.
export type PayItemComponent = { id: number; code: string; name: string; kind: PayKind; is_active: boolean };

// One row per employee: what is in force today.
export type EveryonesPay = {
  item_components: PayItemComponent[];
  employees: {
    employee_id: number;
    pay_group: { id: number; name: string };
    paid_through: string | null;
    salary: { amount: Amount; currency: PayCurrency; pay_type: "monthly" | "daily"; effective_from: string } | null;
    profile: EmployeePayProfile;
    items: Omit<EmployeePayItem, "component">[];
  }[];
};

export const payrollApi = {
  payroll: {
    settings: () => request<PayrollSettings>("/api/payroll/settings"),
    updatePolicy: (data: Partial<PayrollPolicy>) =>
      request<PayrollPolicy>("/api/payroll/policy", { method: "PUT", body: JSON.stringify(data) }),
    applyPreset: (preset: string) =>
      request<PayrollSettings>("/api/payroll/presets", { method: "POST", body: JSON.stringify({ preset }) }),
    createComponent: (data: Partial<PayComponent>) =>
      request<PayComponent>("/api/payroll/components", { method: "POST", body: JSON.stringify(data) }),
    updateComponent: (id: number, data: Partial<PayComponent>) =>
      request<PayComponent>(`/api/payroll/components/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    removeComponent: (id: number) => request<void>(`/api/payroll/components/${id}`, { method: "DELETE" }),
    // One employee's pay period ending that month with the current rules — or with one component's unsaved
    // params tried out (pay_group_id: with that group's rules).
    preview: (data: { employee_id: number; month: string; pay_group_id?: number; component_id?: number; params?: Record<string, unknown>; is_active?: boolean }) =>
      request<PayslipBody>("/api/payroll/preview", { method: "POST", body: JSON.stringify(data) }),

    groups: () => request<PayGroup[]>("/api/payroll/groups"),
    // Names only — for choosing a group on an employee (salary.view is enough).
    groupOptions: () => request<PayGroupOption[]>("/api/payroll/group-options"),
    createGroup: (data: Partial<PayGroup>) => request<PayGroup>("/api/payroll/groups", { method: "POST", body: JSON.stringify(data) }),
    updateGroup: (id: number, data: Partial<PayGroup>) => request<PayGroup>(`/api/payroll/groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    removeGroup: (id: number) => request<void>(`/api/payroll/groups/${id}`, { method: "DELETE" }),
    // A fixed-schedule group's recent periods, newest first, each with its run if it has one.
    groupPeriods: (id: number) => request<PayPeriodOption[]>(`/api/payroll/groups/${id}/periods`),

    runs: () => request<PayRun[]>("/api/payroll/runs"),
    run: (id: number) => request<PayRunDetail>(`/api/payroll/runs/${id}`),
    // A custom group also needs period_end; fixed schedules work it out.
    createRun: (data: { pay_group_id: number; period_start: string; period_end?: string | null }) =>
      request<PayRunDetail>("/api/payroll/runs", { method: "POST", body: JSON.stringify(data) }),
    calculate: (id: number) => request<PayRunDetail>(`/api/payroll/runs/${id}/calculate`, { method: "POST", body: "{}" }),
    // One person only, leaving everyone else's payslip as it is.
    calculateEmployee: (id: number, employeeId: number) =>
      request<PayRunDetail>(`/api/payroll/runs/${id}/employees/${employeeId}/calculate`, { method: "POST", body: "{}" }),
    approve: (id: number) => request<PayRunDetail>(`/api/payroll/runs/${id}/approve`, { method: "POST", body: "{}" }),
    markPaid: (id: number) => request<PayRunDetail>(`/api/payroll/runs/${id}/paid`, { method: "POST", body: "{}" }),
    // Back to calculated, unlocking its attendance; the reason goes to the audit log.
    reopen: (id: number, reason: string) =>
      request<PayRunDetail>(`/api/payroll/runs/${id}/reopen`, { method: "POST", body: JSON.stringify({ reason }) }),
    removeRun: (id: number) => request<void>(`/api/payroll/runs/${id}`, { method: "DELETE" }),
    payslip: (id: number) => request<Payslip>(`/api/payroll/payslips/${id}`),
    runReport: (id: number) => request<PayRunReport>(`/api/payroll/runs/${id}/report`),
    // A file, not JSON — fetched with the login header like the attendance export.
    exportRun: async (id: number, filename: string): Promise<{ blob: Blob; filename: string }> => {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/payroll/runs/${id}/export`, {
        headers: { Accept: "text/csv, application/json", "Accept-Language": currentLang(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.message ?? `Export failed (${res.status})`, body.errors, body.code);
      }
      return { blob: await res.blob(), filename };
    },

    // The adjustments dated in a month.
    adjustments: (month: string) => request<PayrollAdjustment[]>(`/api/payroll/adjustments?month=${month}`),
    createAdjustment: (data: PayrollAdjustmentInput) =>
      request<PayrollAdjustment>("/api/payroll/adjustments", { method: "POST", body: JSON.stringify(data) }),
    // The same amount for many people (everyone, or one branch): one adjustment each.
    createAdjustments: (data: Omit<PayrollAdjustmentInput, "employee_id"> & { employee_ids: number[] }) =>
      request<{ created: number }>("/api/payroll/adjustments/bulk", { method: "POST", body: JSON.stringify(data) }),
    removeAdjustment: (id: number) => request<void>(`/api/payroll/adjustments/${id}`, { method: "DELETE" }),
    // date: for every row without its own date.
    importAdjustments: (date: string, rows: { employee_code: string; date?: string | null; kind: PayKind; name: string; amount: number; taxable?: boolean; reason?: string | null }[]) =>
      request<{ created: number; errors: { row: number; message: string }[] }>("/api/payroll/adjustments/import", {
        method: "POST",
        body: JSON.stringify({ date, rows }),
      }),
  },
  employeePay: {
    get: (employeeId: number) => request<EmployeePay>(`/api/employees/${employeeId}/pay`),
    setPayGroup: (employeeId: number, data: { pay_group_id: number; effective_from: string }) =>
      request<EmployeePayGroupRow>(`/api/employees/${employeeId}/pay-groups`, { method: "POST", body: JSON.stringify(data) }),
    removePayGroup: (employeeId: number, rowId: number) =>
      request<void>(`/api/employees/${employeeId}/pay-groups/${rowId}`, { method: "DELETE" }),
    addSalary: (employeeId: number, data: { amount: number; currency: PayCurrency; pay_type: "monthly" | "daily"; effective_from: string; reason: SalaryReason; note: string | null }) =>
      request<EmployeeSalary>(`/api/employees/${employeeId}/salaries`, { method: "POST", body: JSON.stringify(data) }),
    removeSalary: (employeeId: number, salaryId: number) =>
      request<void>(`/api/employees/${employeeId}/salaries/${salaryId}`, { method: "DELETE" }),
    updateProfile: (employeeId: number, data: Partial<EmployeePayProfile>) =>
      request<EmployeePayProfile>(`/api/employees/${employeeId}/pay-profile`, { method: "PUT", body: JSON.stringify(data) }),
    addItem: (employeeId: number, data: { pay_component_id: number; amount: number; effective_from: string; effective_to: string | null; note: string | null }) =>
      request<EmployeePayItem>(`/api/employees/${employeeId}/pay-items`, { method: "POST", body: JSON.stringify(data) }),
    updateItem: (employeeId: number, itemId: number, data: { amount?: number; effective_from?: string; effective_to?: string | null; note?: string | null }) =>
      request<EmployeePayItem>(`/api/employees/${employeeId}/pay-items/${itemId}`, { method: "PUT", body: JSON.stringify(data) }),
    removeItem: (employeeId: number, itemId: number) =>
      request<void>(`/api/employees/${employeeId}/pay-items/${itemId}`, { method: "DELETE" }),
    // Everyone's pay setup today, for the employee Excel export.
    everyone: () => request<EveryonesPay>("/api/payroll/employee-pay"),
    itemOptions: () => request<PayItemComponent[]>("/api/payroll/item-options"),
  },
};
