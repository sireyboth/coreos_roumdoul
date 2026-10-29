// Add many days to the roster (components/dashboard/schedules/bulk-schedule-dialog.tsx).

export const bulk = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Add to roster",
  descOne:
    "Pick a work schedule and a date range. On each chosen weekday in the range, {name} follows that schedule instead of their usual one. A single day works too — set both dates the same.",
  descMany:
    "Pick people, a work schedule and a date range. On each chosen weekday in the range, they follow that schedule instead of their usual one. A single day works too — just set both dates the same.",

  // ── Employees ─────────────────────────────────────────────────────
  employees: "Employees",
  searchEmployees: "Search employees",
  selectShown: "Select everyone shown",
  selectAll: "Select everyone",
  noMatch: "No one matches.",

  // ── Schedule & location ───────────────────────────────────────────
  schedule: "Work schedule",
  location: "Work location (optional)",
  ownBranch: "Their own branch",
  locationHint: "Only set this to send people to a different site.",

  // ── Dates ─────────────────────────────────────────────────────────
  dates: "Dates",
  thisWeek: "This week",
  nextWeek: "Next week",
  thisMonth: "This month",
  nextMonth: "Next month",
  weekdays: "Days of the week",
  companyOff: "Your company's weekly days off ({days}) start un-ticked.",
  overtimeOnlyTitle: "Overtime-only schedule",
  overtimeOnlyText: "Every hour worked on these days counts as overtime — holiday overtime on a public holiday. Holidays are included.",
  skipHolidays: "Skip public holidays",

  // ── Range problems ────────────────────────────────────────────────
  pickDates: "Pick a start and an end date.",
  endBefore: "The end date is before the start date.",
  maxDays: "Pick at most {n} days at a time.",
  tickDay: "Tick at least one day of the week.",

  // ── Preview ───────────────────────────────────────────────────────
  previewPick: "Pick at least one employee and a work schedule to see what will be created.",
  checking: "Checking…",
  checkFailed: "Couldn't check that.",
  willAddOne: "{n} roster day will be added",
  willAddMany: "{n} roster days will be added",
  skipping: " · skipping {list}",

  // ── Skipped days ──────────────────────────────────────────────────
  skipped: {
    holiday: "{n} on holidays",
    dayOff: "{n} on days off",
    already: "{n} already scheduled",
    left: "{n} for people who have left",
    noHours: "{n} on weekdays the schedule has no hours",
  },

  // ── Footer & messages ─────────────────────────────────────────────
  addOne: "Add {n} roster day",
  addMany: "Add {n} roster days",
  addedOne: "{n} roster day added",
  addedMany: "{n} roster days added",
  skippedHint: "Skipped: {list}.",
};
