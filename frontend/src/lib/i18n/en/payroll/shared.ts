// Payroll labels shared by every payroll screen (components/dashboard/payroll/shared.tsx).
// Also used by the pay-setup components (component-dialog, employee-pay-panel, pay-groups).

export const shared = {
  // ── Pay schedules ─────────────────────────────────────────────────
  schedule: {
    monthly: "Once a month",
    semi_monthly: "Twice a month",
    weekly: "Every week",
    biweekly: "Every 2 weeks",
    custom: "Dates picked each time",
  },

  // ── Schedule summary ("1st → end of month") ───────────────────────
  summary: {
    // English adds "st/nd/rd/th" in code; Khmer reads "ថ្ងៃទី {n}".
    dayOfMonth: "{n}",
    endOfMonth: "end of month",
    monthlyFull: "1st → end of month",
    monthlyRange: "{from} → {to}",
    semiMonthly: "Periods end on the {first} and {second}",
    weeklyFrom: "Weeks starting {day}",
    biweeklyFrom: "2 weeks starting {day}",
    custom: "HR picks each run's dates",
  },

  // ── Pay run status (draft / approved / paid use common.status) ────
  inReview: "In review",

  // ── Kinds of pay component ────────────────────────────────────────
  kind: {
    earning: "Earning",
    deduction: "Deduction",
    net_deduction: "After-tax deduction",
  },
  kindHint: {
    earning: "Added to pay (allowance, bonus, commission).",
    deduction: "Taken off before tax (e.g. a penalty). Lowers gross pay.",
    net_deduction: "Taken off after tax (salary advance, loan repayment).",
  },

  // ── Payslip sections ──────────────────────────────────────────────
  section: {
    earning: "Earnings",
    deduction: "Deductions",
    statutory: "NSSF and tax on salary",
    net_deduction: "After-tax deductions",
    employer: "Paid by the company (not from pay)",
  },

  // ── Reasons for a salary change ───────────────────────────────────
  salaryReason: {
    hired: "Starting salary",
    probation_passed: "Probation passed",
    promotion: "Promotion",
    annual_increase: "Annual increase",
    change: "Other change",
    correction: "Correction",
  },

  // ── A component's rule in one line ────────────────────────────────
  rule: {
    base: "The salary itself, prorated for joiners and leavers",
    employeeItem: "Amount set on each employee's Pay tab",
    overtime: "Work day {workday} · Day off {dayOff} · Holiday {holiday}",
    attendanceBonus: "{amount} when at most {absences} absences and {lates} late arrivals",
    attendanceBonusUnset: "Set an amount to use it",
    absence: "Daily rate × days absent{multiplier} (monthly salaries)",
    unpaidLeave: "Daily rate × unpaid leave days (monthly salaries)",
    unpaidPermission: "Minute rate × unpaid late-arrival / early-leave permission",
    perMinute: "Per minute",
    perMinuteGrace: "Per minute, after {n} min grace each day",
    perTime: "{amount} each time",
    perTimeFree: "{amount} each time, first {n} free each month",
    countBased: "Every {n} times = one day's pay",
    tiersOne: "{n} tier by minutes late each day",
    tiersOther: "{n} tiers by minutes late each day",
    notCharged: "Not charged",
  },

  // ── Warnings ──────────────────────────────────────────────────────
  fixBeforeApproving: "Fix before approving",
};
