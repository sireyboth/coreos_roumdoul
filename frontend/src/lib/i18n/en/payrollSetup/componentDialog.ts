// Add / edit a pay component (components/dashboard/payroll/component-dialog.tsx)

export const componentDialog = {
  // ── Attendance rule types ─────────────────────────────────────────
  template: {
    overtime: "Overtime",
    attendance_bonus: "Attendance bonus",
    absence: "Absence",
    unpaid_leave: "Unpaid leave",
    late: "Late arrival",
    early_leave: "Early leave",
    unpaid_permission: "Unpaid permission",
  },

  // ── Lateness / early-leave charging ───────────────────────────────
  mode: {
    per_minute: "Per minute",
    per_time: "Fixed amount each time",
    count_based: "Every few times = one day",
    tiers: "Tiers by minutes",
    none: "Not charged",
  },
  modeHint: {
    per_minute: "Each minute costs the minute rate (salary ÷ days ÷ hours ÷ 60).",
    per_time: "The same amount every time, with some free each pay period.",
    count_based: "e.g. every 3 times costs one day's pay.",
    tiers: "Each day is charged by how late it was.",
    none: "Recorded in attendance, never deducted.",
  },

  // ── Rule fields ───────────────────────────────────────────────────
  fields: {
    lawAtLeast: "At least {pct}% by law.",
    lawBelow: "Below the {pct}% Labour Law minimum.",
    lawMinimum: "Labour Law minimum: {pct}%.",
    workday: "Work day",
    dayOff: "Day off",
    holiday: "Public holiday",
    lawOff: "Labour Law minimums are switched off in Payroll Settings, so any rate is accepted. The company is responsible for its overtime policy.",
    amount: "Amount",
    inSalaryCurrency: "In each employee's salary currency.",
    maxAbsences: "Max absences",
    maxLate: "Max late arrivals",
    chargePerAbsentDay: "Charge per absent day",
    pctOfDay: "% of a day's pay",
    absenceHint: "100% = one day's pay. Some companies charge 200% for an absence without notice.",
    howCharged: "How it is charged",
    graceEachDay: "Grace each day",
    minutes: "minutes",
    graceHint: "Minutes not charged each day, on top of the work schedule's own grace.",
    amountEachTime: "Amount each time",
    freeEachPeriod: "Free each pay period",
    oneDayEvery: "One day's pay every",
    times: "times",
    upToMinutes: "Up to (minutes)",
    upToMinutesAria: "Up to minutes",
    shareOfDay: "Share of a day",
    longer: "Longer",
    removeTier: "Remove tier",
    addTier: "Add tier",
    tiersHint: "Leave “Up to” empty for the last tier (anything longer). Share of a day: 0.5 = half a day's pay.",
    unpaidLeaveText: "Each unpaid leave day costs one day's pay. Leave types and how much they pay are set in Leave Policy.",
    unpaidPermissionText: "Approved late-arrival or early-leave permission that isn't paid costs the minute rate for each minute.",
  },

  // ── Live preview ──────────────────────────────────────────────────
  preview: {
    title: "Try it on an employee",
    hint: "See their payslip with these settings, before saving. Nothing is changed.",
    chooseEmployee: "Choose an employee",
    month: "Month",
    working: "Working…",
    preview: "Preview",
    failed: "Couldn't preview.",
  },

  // ── Dialog ────────────────────────────────────────────────────────
  dialog: {
    addTitle: "Add pay component",
    newText: "A line that can appear on payslips: an allowance, a deduction, or a rule worked out from attendance.",
    systemText: "A built-in component. Tune its rule or switch it off; it can't be deleted.",
    ownText: "Your own component.",
    nameOnPayslip: "Name on payslip",
    namePlaceholder: "e.g. Transport allowance",
    type: "Type",
    amountFrom: "Amount comes from",
    employeeItem: "An amount set on each employee (allowance, loan…)",
    attendanceRule: "Attendance rule: {name}",
    rule: "Rule · {name}",
    taxable: "Subject to tax on salary",
    nssf: "Counts toward NSSF",
    active: "Active — used in pay runs",
    added: "Component added",
    saved: "Component saved",
    saveFailed: "Couldn't save.",
    saving: "Saving…",
  },
};
