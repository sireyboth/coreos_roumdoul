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
    reasonHint: "Why this amount? Only HR sees it. It is kept in the audit log.",
    internalReason: "Internal reason",
    modeCorrect: "Correct the amount",
    modeCorrectHelp: "Fix a mistake. The employee only sees that the line was adjusted.",
    modeWaive: "Waive for the employee",
    modeWaiveHelp: "Forgive part or all of this deduction. The employee sees the original amount and your message.",
    stillDeduct: "Still deduct",
    stillDeductHint: "Enter 0 to waive the whole {amount}.",
    waiveTooMuch: "Must be less than {amount}, the amount the rule deducts.",
    message: "Message to the employee (optional)",
    messageHint: "Shown on their payslip.",
    messagePlaceholder: "e.g. Thank you for your hard work this month.",
    waivedBadge: "Waived",
    waivedOf: "{waived} of {original} waived",
    employeeSees: "Employee sees: “{message}”",
    useRule: "Use the rule's amount",
    saved: "Payslip updated.",
  },
  // ── On the employee's own payslip ─────────────────────────────────
  waiver: {
    badge: "Waived",
    all: "The company waived this deduction.",
    part: "The company waived {amount} of this deduction.",
    original: "Was {amount}",
  },
  adjusted: "Adjusted by HR",
  otDays: {
    show: "Show {n} overtime days",
    hide: "Hide overtime days",
    approvedOf: "{approved} h approved of {recorded} h",
    hours: "{worked} h",
    capped: "{worked} h worked, {paid} h paid",
    fixed: "{worked} h, fixed amount",
    type: { workday: "Work day", day_off: "Day off", holiday: "Holiday" },
  },
};
