// Probation: the form field, the profile card and the company's rules
// (components/dashboard/employees/probation-card.tsx, probation-settings-dialog.tsx, employee-form.tsx)

export const probation = {
  // ── Employee form ────────────────────────────────────────────────
  endDate: "Probation ends",
  endHint: "Starts on the hire date. Company default: {length}. Change it for this person if needed.",
  endHintNoDefault: "Starts on the hire date. Set the last day of probation.",

  // ── Profile card ─────────────────────────────────────────────────
  title: "Probation",
  started: "Started",
  ends: "Last day",
  ended: "Probation ended",
  noEndDate: "No end date set",
  daysLeft: "{n} days left",
  oneDayLeft: "1 day left",
  lastDayToday: "Last day is today",
  overdue: "Ended {n} days ago. Pass them or extend probation.",
  pass: "Pass probation",
  extend: "Extend",
  passTitle: "Pass {name}'s probation?",
  passBody: "{name} becomes Active from today. If their pay goes up now, add the new salary on the Pay tab with the reason “Probation passed”.",
  passedToast: "{name} passed probation",
  extendTitle: "Extend probation",
  extendBody: "Choose the new last day. HR is reminded again before it.",
  newEnd: "New last day",
  extendedToast: "Probation extended to {date}",

  // ── Employees list ───────────────────────────────────────────────
  listEnds: "Ends {date}",

  // ── Company rules ────────────────────────────────────────────────
  settings: "Probation rules",
  settingsDescription: "How long new people are on probation, and when HR is reminded. You can still change each person's end date on their profile.",
  length: "Default length",
  unitMonths: "Months",
  unitDays: "Days",
  lengthHint: "0 = no default. You set each end date yourself.",
  reminder: "Remind HR (days before it ends)",
  reminderHint: "Empty = only on the day it ends.",
  lawNote: "Cambodian Labour Law (Art. 68) allows at most 3 months for regular staff, 2 months for specialised workers and 1 month for unskilled workers.",
  saved: "Probation rules saved",
  months: "{n} months",
  days: "{n} days",
};
