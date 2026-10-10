"use client";

import { Alert } from "@/components/ui/alert";
import { formatSalary } from "@/components/dashboard/employee-form";
import type { LatenessParams, PayComponent, PayKind, PayLineKind, PayRunStatus, PayWarning, SalaryReason } from "@/lib/api";

/** Money in its own currency: "$1,234.50" or "1,234,500 ៛". */
export function money(amount: number | string | null | undefined, currency: string | null | undefined): string {
  return formatSalary(amount, currency);
}

/** "2026-09" → "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** The month most companies are paying for right now: last month. */
export function previousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const RUN_STATUS: Record<PayRunStatus, { label: string; variant: "secondary" | "info" | "warning" | "success" }> = {
  draft: { label: "Draft", variant: "secondary" },
  calculated: { label: "In review", variant: "warning" },
  approved: { label: "Approved", variant: "info" },
  paid: { label: "Paid", variant: "success" },
};

export const KIND_LABELS: Record<PayKind, string> = {
  earning: "Earning",
  deduction: "Deduction",
  net_deduction: "After-tax deduction",
};

export const KIND_HINTS: Record<PayKind, string> = {
  earning: "Added to pay (allowance, bonus, commission).",
  deduction: "Taken off before tax (e.g. a penalty). Lowers gross pay.",
  net_deduction: "Taken off after tax (salary advance, loan repayment).",
};

/** Payslip sections, in the order a payslip reads. */
export const LINE_SECTIONS: { kind: PayLineKind; title: string; sign: "+" | "−" | "" }[] = [
  { kind: "earning", title: "Earnings", sign: "+" },
  { kind: "deduction", title: "Deductions", sign: "−" },
  { kind: "statutory", title: "NSSF and tax on salary", sign: "−" },
  { kind: "net_deduction", title: "After-tax deductions", sign: "−" },
  { kind: "employer", title: "Paid by the company (not from pay)", sign: "" },
];

export const SALARY_REASONS: { value: SalaryReason; label: string }[] = [
  { value: "hired", label: "Starting salary" },
  { value: "probation_passed", label: "Probation passed" },
  { value: "promotion", label: "Promotion" },
  { value: "annual_increase", label: "Annual increase" },
  { value: "change", label: "Other change" },
  { value: "correction", label: "Correction" },
];

const pct = (n: unknown) => `${Math.round(Number(n) * 100)}%`;

/** A component's rule in one line, for the settings list. */
export function ruleSummary(c: PayComponent): string {
  const p = (c.params ?? {}) as Record<string, number> & Partial<LatenessParams>;
  if (c.method === "base") return "The salary itself, prorated for joiners and leavers";
  if (c.method === "employee_item") return "Amount set on each employee's Pay tab";

  switch (c.template) {
    case "overtime":
      return `Work day ${pct(p.workday)} · Day off ${pct(p.day_off)} · Holiday ${pct(p.holiday)}`;
    case "attendance_bonus":
      return Number(p.amount) > 0
        ? `${p.amount} when at most ${p.max_absent_days} absences and ${p.max_late_count} late arrivals`
        : "Set an amount to use it";
    case "absence":
      return `Daily rate × days absent${Number(p.multiplier) !== 1 ? ` × ${pct(p.multiplier)}` : ""} (monthly salaries)`;
    case "unpaid_leave":
      return "Daily rate × unpaid leave days (monthly salaries)";
    case "unpaid_permission":
      return "Minute rate × unpaid late-arrival / early-leave permission";
    case "late":
    case "early_leave":
      return latenessSummary(p as LatenessParams);
    default:
      return "—";
  }
}

export function latenessSummary(p: LatenessParams): string {
  switch (p.mode) {
    case "per_minute":
      return p.grace_minutes > 0 ? `Per minute, after ${p.grace_minutes} min grace each day` : "Per minute";
    case "per_time":
      return `${p.amount} each time${p.free_count > 0 ? `, first ${p.free_count} free each month` : ""}`;
    case "count_based":
      return `Every ${p.every_n} times = one day's pay`;
    case "tiers":
      return `${p.tiers.length} ${p.tiers.length === 1 ? "tier" : "tiers"} by minutes late each day`;
    default:
      return "Not charged";
  }
}

/** Problems first (they stop approval), then things to know. */
export function WarningList({ warnings, className }: { warnings: PayWarning[] | null | undefined; className?: string }) {
  if (!warnings?.length) return null;
  const sorted = [...warnings].sort((a, b) => Number(b.blocking) - Number(a.blocking));

  return (
    <div className={className ?? "flex flex-col gap-2"}>
      {sorted.map((w, i) => (
        <Alert key={`${w.code}-${i}`} variant={w.blocking ? "warning" : "info"} title={w.blocking ? "Fix before approving" : undefined}>
          {w.message}
        </Alert>
      ))}
    </div>
  );
}
