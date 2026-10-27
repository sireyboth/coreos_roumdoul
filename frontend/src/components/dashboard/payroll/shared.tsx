"use client";

import { Alert } from "@/components/ui/alert";
import { formatSalary } from "@/components/dashboard/employee-form";
import { WEEKDAY_KEYS } from "@/components/dashboard/calendar-shared";
import type { LatenessParams, PayComponent, PayGroup, PayKind, PayLineKind, PayRunStatus, PaySchedule, PayWarning, SalaryReason } from "@/lib/api";
import { dateLocale, translate, useT, type Lang, type TKey } from "@/lib/i18n";

/*
 * Labels: the English constants below (SCHEDULE_LABELS, KIND_LABELS…) stay for
 * code that isn't translated yet. On screen use the keys instead —
 * t(`payroll.shared.schedule.${s}`), t(`payroll.shared.kind.${k}`), RUN_STATUS[s].labelKey —
 * and pass `lang` to the summary helpers.
 */

/** Money in its own currency: "$1,234.50" or "1,234,500 ៛". */
export function money(amount: number | string | null | undefined, currency: string | null | undefined): string {
  return formatSalary(amount, currency);
}

/** Short money for chart axes and tight spots: "$1.2K", "4.5M ៛". */
export function compactMoney(amount: number, currency: string | null | undefined): string {
  // Under a thousand there's nothing to shorten.
  if (Math.abs(amount) < 1000) return money(amount, currency);
  const short = amount.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
  if (currency === "KHR") return `${short} ៛`;
  if (currency === "USD") return `${amount < 0 ? "-" : ""}$${short.replace("-", "")}`;
  return short;
}

/** The locale for dates on payroll screens: Khmer, else US English as before. */
function locale(lang: Lang): string {
  return dateLocale(lang) ?? "en-US";
}

/** "2026-09" → "September 2026". */
export function monthLabel(month: string, lang: Lang = "en"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
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

export function dateLabel(value: string | null | undefined, lang: Lang = "en"): string {
  if (!value) return "—";
  return new Date(value.slice(0, 10) + "T00:00:00").toLocaleDateString(locale(lang), { year: "numeric", month: "short", day: "numeric" });
}

/** Today as YYYY-MM-DD, on this device's clock. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A date to file something under in a month: today for this month, else the month's last day. */
export function dateInMonth(month: string): string {
  if (month === currentMonth()) return today();
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export const SCHEDULE_LABELS: Record<PaySchedule, string> = {
  monthly: "Once a month",
  semi_monthly: "Twice a month",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  custom: "Dates picked each time",
};

/** "1st → end of month", "26th → 25th", "Weeks from Monday"… */
export function scheduleSummary(g: Pick<PayGroup, "schedule" | "cutoff_days" | "anchor_date">, lang: Lang = "en"): string {
  const tr = (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const nth = (n: number) => (lang === "en" ? ordinal(n) : tr("payroll.shared.summary.dayOfMonth", { n }));
  const day = (n: number) => (n >= 31 ? tr("payroll.shared.summary.endOfMonth") : nth(n));
  const cut = g.cutoff_days ?? [31];
  switch (g.schedule) {
    case "monthly":
      return cut[0] >= 31 ? tr("payroll.shared.summary.monthlyFull") : tr("payroll.shared.summary.monthlyRange", { from: nth(cut[0] + 1), to: day(cut[0]) });
    case "semi_monthly":
      return tr("payroll.shared.summary.semiMonthly", { first: day(cut[0]), second: day(cut[1] ?? 31) });
    case "weekly":
    case "biweekly":
      return g.anchor_date
        ? tr(g.schedule === "weekly" ? "payroll.shared.summary.weeklyFrom" : "payroll.shared.summary.biweeklyFrom", {
            day: tr(`calendar.shared.weekday.full.${WEEKDAY_KEYS[new Date(g.anchor_date + "T00:00:00").getDay()]}`),
          })
        : tr(`payroll.shared.schedule.${g.schedule}`);
    default:
      return tr("payroll.shared.summary.custom");
  }
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

export const RUN_STATUS: Record<PayRunStatus, { label: string; labelKey: TKey; variant: "secondary" | "info" | "warning" | "success" }> = {
  draft: { label: "Draft", labelKey: "common.status.draft", variant: "secondary" },
  calculated: { label: "In review", labelKey: "payroll.shared.inReview", variant: "warning" },
  approved: { label: "Approved", labelKey: "common.status.approved", variant: "info" },
  paid: { label: "Paid", labelKey: "common.status.paid", variant: "success" },
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
export const LINE_SECTIONS: { kind: PayLineKind; title: string; titleKey: TKey; sign: "+" | "−" | "" }[] = [
  { kind: "earning", title: "Earnings", titleKey: "payroll.shared.section.earning", sign: "+" },
  { kind: "deduction", title: "Deductions", titleKey: "payroll.shared.section.deduction", sign: "−" },
  { kind: "statutory", title: "NSSF and tax on salary", titleKey: "payroll.shared.section.statutory", sign: "−" },
  { kind: "net_deduction", title: "After-tax deductions", titleKey: "payroll.shared.section.net_deduction", sign: "−" },
  { kind: "employer", title: "Paid by the company (not from pay)", titleKey: "payroll.shared.section.employer", sign: "" },
];

export const SALARY_REASONS: { value: SalaryReason; label: string; labelKey: TKey }[] = [
  { value: "hired", label: "Starting salary", labelKey: "payroll.shared.salaryReason.hired" },
  { value: "probation_passed", label: "Probation passed", labelKey: "payroll.shared.salaryReason.probation_passed" },
  { value: "promotion", label: "Promotion", labelKey: "payroll.shared.salaryReason.promotion" },
  { value: "annual_increase", label: "Annual increase", labelKey: "payroll.shared.salaryReason.annual_increase" },
  { value: "change", label: "Other change", labelKey: "payroll.shared.salaryReason.change" },
  { value: "correction", label: "Correction", labelKey: "payroll.shared.salaryReason.correction" },
];

const pct = (n: unknown) => `${Math.round(Number(n) * 100)}%`;

/** A component's rule in one line, for the settings list. */
export function ruleSummary(c: PayComponent, lang: Lang = "en"): string {
  const tr = (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const p = (c.params ?? {}) as Record<string, number> & Partial<LatenessParams>;
  if (c.method === "base") return tr("payroll.shared.rule.base");
  if (c.method === "employee_item") return tr("payroll.shared.rule.employeeItem");

  switch (c.template) {
    case "overtime":
      return tr("payroll.shared.rule.overtime", { workday: pct(p.workday), dayOff: pct(p.day_off), holiday: pct(p.holiday) });
    case "attendance_bonus":
      return Number(p.amount) > 0
        ? tr("payroll.shared.rule.attendanceBonus", { amount: String(p.amount), absences: String(p.max_absent_days), lates: String(p.max_late_count) })
        : tr("payroll.shared.rule.attendanceBonusUnset");
    case "absence":
      return tr("payroll.shared.rule.absence", { multiplier: Number(p.multiplier) !== 1 ? ` × ${pct(p.multiplier)}` : "" });
    case "unpaid_leave":
      return tr("payroll.shared.rule.unpaidLeave");
    case "unpaid_permission":
      return tr("payroll.shared.rule.unpaidPermission");
    case "late":
    case "early_leave":
      return latenessSummary(p as LatenessParams, lang);
    default:
      return "—";
  }
}

export function latenessSummary(p: LatenessParams, lang: Lang = "en"): string {
  const tr = (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  switch (p.mode) {
    case "per_minute":
      return p.grace_minutes > 0 ? tr("payroll.shared.rule.perMinuteGrace", { n: p.grace_minutes }) : tr("payroll.shared.rule.perMinute");
    case "per_time":
      return p.free_count > 0 ? tr("payroll.shared.rule.perTimeFree", { amount: p.amount, n: p.free_count }) : tr("payroll.shared.rule.perTime", { amount: p.amount });
    case "count_based":
      return tr("payroll.shared.rule.countBased", { n: p.every_n });
    case "tiers":
      return tr(p.tiers.length === 1 ? "payroll.shared.rule.tiersOne" : "payroll.shared.rule.tiersOther", { n: p.tiers.length });
    default:
      return tr("payroll.shared.rule.notCharged");
  }
}

/** Problems first (they stop approval), then things to know. */
export function WarningList({ warnings, className }: { warnings: PayWarning[] | null | undefined; className?: string }) {
  const t = useT();
  if (!warnings?.length) return null;
  const sorted = [...warnings].sort((a, b) => Number(b.blocking) - Number(a.blocking));

  return (
    <div className={className ?? "flex flex-col gap-2"}>
      {sorted.map((w, i) => (
        <Alert key={`${w.code}-${i}`} variant={w.blocking ? "warning" : "info"} title={w.blocking ? t("payroll.shared.fixBeforeApproving") : undefined}>
          {w.message}
        </Alert>
      ))}
    </div>
  );
}
