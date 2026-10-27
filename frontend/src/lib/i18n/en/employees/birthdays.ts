// Birthdays page (app/dashboard/birthdays/page.tsx)

export const birthdays = {
  // ── Header ───────────────────────────────────────────────────────
  title: "Birthdays",
  description: "Upcoming birthdays across the branches you can see. Only the day and month are shown.",

  // ── States ───────────────────────────────────────────────────────
  loadFailed: "Couldn't load birthdays. Refresh the page to try again.",
  emptyTitle: "No birthdays yet",
  emptyHint: "Add a date of birth on an employee's profile and it will appear here.",

  // ── Totals ───────────────────────────────────────────────────────
  next7Days: "Next 7 days",
  onFile: "With a birthday on file",

  // ── List ─────────────────────────────────────────────────────────
  search: "Search by name, ID, branch or department…",
  noMatch: "No one matches “{query}”.",
  inDays: "In {n} days",
};
