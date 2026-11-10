// Birthdays page (app/dashboard/birthdays/page.tsx)

export const birthdays = {
  // ── Header ───────────────────────────────────────────────────────
  title: "Birthdays",
  description: "Upcoming birthdays across the branches you can see. Only the day and month are shown.",

  // ── States ───────────────────────────────────────────────────────
  loadFailed: "Couldn't load birthdays. Refresh the page to try again.",
  emptyTitle: "No birthdays yet",
  emptyHint: "Add a date of birth on an employee's profile and it will appear here.",

  // ── Hero banner ──────────────────────────────────────────────────
  heroToday: "Happy birthday!",
  heroTodayHint: "Today is a special day for {names}. Don't forget to wish them well!",
  heroNone: "No birthdays today",
  heroNext: "Next up: {name}, {when} ({date})",
  heroNothingSoon: "Nobody has a birthday coming up.",

  // ── Totals ───────────────────────────────────────────────────────
  next7Days: "Next 7 days",
  onFile: "With a birthday on file",

  // ── Columns ──────────────────────────────────────────────────────
  thisMonth: "This month",
  next3Months: "Next 3 months",
  later: "Later",
  columnEmpty: "No birthdays here.",

  // ── List ─────────────────────────────────────────────────────────
  search: "Search by name, ID, branch or department…",
  noMatch: "No one matches “{query}”.",
  inDays: "In {n} days",
};
