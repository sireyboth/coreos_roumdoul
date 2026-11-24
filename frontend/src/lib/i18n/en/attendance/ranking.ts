// Top employees (app/dashboard/ranking/page.tsx + components/dashboard/attendance/ranking-board.tsx)

export const ranking = {
  title: "Top Employees",
  rankedCount: "{n} people ranked",
  allBranches: "All branches",

  // ── Your place ───────────────────────────────────────────────────
  yourRank: "Your place",
  rankOf: "#{rank} of {n}",
  outOf: "of 100",
  notRankedYet: "You're not ranked this month yet — it needs at least {n} finished work days.",
  daysCame: "Came {present} of {scheduled} days",
  daysOnTime: "On time {onTime} of {present}",
  lateTotal: "{n} min late",

  // ── Tabs ─────────────────────────────────────────────────────────
  topTitle: "Top 10",
  allTitle: "Everyone",
  tabHow: "How it works",
  emptyTitle: "No ranking yet",
  emptyHint: "The ranking starts once people have at least {n} finished work days this month.",
  allHint: "Only you and other managers see this list and its numbers.",

  // ── How it works ─────────────────────────────────────────────────
  howAttendance: "{weight} points for coming to work: days they came ÷ days they were scheduled.",
  howOnTime: "{weight} points for being on time: days they arrived on time ÷ days they came.",
  howFair: "Approved leave, holidays and days off never count against anyone. Today only counts once it's over. Automatic attendance days (no scan) aren't counted.",
  howMin: "Needs at least {n} work days in the month. Equal scores: more days at work comes first.",
};
