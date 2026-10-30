// On-screen payslip (components/dashboard/payroll/payslip-view.tsx)

export const payslip = {
  // ── Totals ────────────────────────────────────────────────────────
  gross: "Gross",
  statutory: "NSSF + tax",
  net: "Net pay",
  grossPay: "Gross pay",
  cost: "Cost to the company",

  // ── Worked out from ───────────────────────────────────────────────
  workedFrom: "Worked out from",
  daysWorked: "Days worked",
  absent: "Absent",
  missingScan: "Missing scan",
  lateArrivals: "Late arrivals",
  dailyRate: "Daily rate",
  hourlyRate: "Hourly rate",
  dayBasis: "Day basis",
  days: "{n} days",
  taxRate: "Tax rate (KHR)",
  missing: "Missing",
  paidFor: "Paid for {from} – {to}",
  perDay: "Paid per day",
  monthly: "Monthly salary",
  fallbackRate: "Using your fallback exchange rate",

  // ── Gross by month ────────────────────────────────────────────────
  byMonth: "Gross by month",
  monthDaysOne: "{month} · {n} day",
  monthDaysOther: "{month} · {n} days",
  crossMonth: "This period crosses months: its gross is shared out by day, for monthly reports.",

  // ── Dialog ────────────────────────────────────────────────────────
  title: "Payslip",
  for: "Payslip for {period}",

  // ── Set a line by hand ────────────────────────────────────────────
  override: {
    edit: "Set {line} by hand",
    badge: "Set by hand",
    because: "Reason: {reason}",
    wasRule: "The rule worked out {amount}",
    ruleSays: "The rule works out {amount}. The amount you set stays when the payslip is recalculated, until you remove it.",
    amount: "Amount",
    reason: "Reason",
    reasonHint: "Why this amount? It shows on the payslip and in the audit log.",
    useRule: "Use the rule's amount",
    saved: "Payslip updated.",
  },
};
