// Calendar agenda view (components/dashboard/calendar-agenda.tsx)

export const agenda = {
  // ── Event types (totals double as filter chips) ───────────────────
  type: {
    holiday: "Holidays",
    leave: "Leave",
    day_off: "Days off",
    absent: "Absences",
  },

  // ── Range picker ──────────────────────────────────────────────────
  rangeLabel: "Range",
  range: {
    upcoming: "Next 3 months",
    month: "This month",
    year: "This year",
    last_year: "Last year",
  },
  everyone: "Everyone",
  loadFailed: "Couldn't load the agenda.",

  // ── List ──────────────────────────────────────────────────────────
  empty: "Nothing in this range — no holidays, leave, days off or absences.",
  pending: "Pending approval",
  companyHoliday: "Company holiday",
  morning: "Morning",
  afternoon: "Afternoon",
  dayOne: "{n} day",
  dayOther: "{n} days",
  more: " +{n} more",
};
