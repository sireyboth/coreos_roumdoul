// Payroll settings (app/dashboard/payroll/settings/page.tsx)

export const settings = {
  // ── Page ──────────────────────────────────────────────────────────
  title: "Payroll settings",
  description: "Your company's pay rules. Every rule can be tried on a real employee before you save it.",
  addComponent: "Add component",
  lawTitle: "Tax on salary and NSSF are set by law",
  lawText: "Their rates are kept up to date by the platform and can't be changed here. Each employee's dependents and NSSF enrolment are on their Pay tab.",

  // ── Presets ───────────────────────────────────────────────────────
  presetTitle: "Start from a preset",
  presetText: "Sets sensible rules in one click. You can fine-tune everything afterwards.",
  apply: "Apply",
  applyTitle: "Apply “{name}”?",
  applyText: "Sets the daily rate, lateness, early leave, absence and overtime rules to this preset. Your allowances and amounts stay as they are.",
  applyConfirm: "Apply preset",
  applied: "Preset applied",

  // ── How pay is worked out (policy card) ───────────────────────────
  policy: {
    title: "How pay is worked out",
    description: "Day and hour rates, missing scans and rounding, for every pay group that doesn't set its own. Changes apply the next time a pay run is calculated.",
    dailyRate: "Daily rate",
    basisFixed: "Monthly salary ÷ a fixed number of days",
    basisCalendar: "Monthly salary ÷ days in the month",
    basisScheduled: "Monthly salary ÷ the person's scheduled work days",
    days: "Days in a month",
    daysHint: "26 is the most common in Cambodia.",
    hours: "Hours in a work day",
    hoursHint: "Hourly rate = daily rate ÷ these hours (used for overtime and lateness).",
    missing: "A day with a missing scan",
    missingReview: "Must be fixed before approving (recommended)",
    missingPresent: "Counts as worked",
    missingAbsent: "Counts as absent",
    rate: "Fallback exchange rate (KHR per USD)",
    ratePlaceholder: "e.g. 4100",
    rateHint: "Tax and NSSF on dollar salaries use the official monthly rate; this is used only when it isn't published yet.",
    rounding: "Round riel net pay to",
    roundExact: "The exact riel",
    round100: "Nearest 100 ៛",
    round500: "Nearest 500 ៛",
    round1000: "Nearest 1,000 ៛",
    holidays: "Pay daily-paid staff for public holidays",
    overtimeMinimums: "Hold overtime to the Labor Law minimums (150% on work days, 200% on days off and holidays)",
    overtimeWarning: "Overtime rates can now be set to any value. Paying below the Labor Law minimums may expose the company to back-pay claims and fines; the company is responsible for its overtime policy.",
    saving: "Saving…",
    save: "Save settings",
    saved: "Payroll settings saved",
  },

  // ── Pay components ────────────────────────────────────────────────
  componentsTitle: "Pay components",
  componentsText: "Every line a payslip can have. Click one to change its rule.",
  colComponent: "Component",
  colRule: "Rule",
  builtIn: "built-in",
  off: "Off",
  search: "Search components…",
  emptyTitle: "No components",
  emptyText: "Add allowances and deductions your company uses.",
  deleteTitle: "Delete “{name}”?",
  deleteText: "It disappears from future pay runs. Approved payslips keep it.",
};
