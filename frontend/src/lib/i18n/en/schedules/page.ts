// Work schedules list (app/dashboard/work-schedules/page.tsx).

export const page = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Work schedules",
  description:
    "When people should scan in and out — two scans a day or more. Assign a schedule to people from a date; their days off are set per person.",
  assignments: "assignments",
  newSchedule: "New schedule",

  // ── Overtime rule (Rules column) ──────────────────────────────────
  overtime: {
    off: "No overtime",
    after_last_out: "After last OUT",
    above_scheduled: "Above scheduled hours",
  },

  // ── Table ─────────────────────────────────────────────────────────
  column: {
    schedule: "Schedule",
    week: "Week",
    hours: "Hours / week",
    rules: "Rules",
    people: "People",
  },
  dayOff: "off",
  lateAfter: "Late after {n} min",
  needsApproval: " · needs approval",
  offDays: "off {days}",
  sortStrictest: "Strictest first",
  sortLenient: "Most lenient first",
  sortInactive: "Inactive first",
  sortActive: "Active first",
  search: "Search schedules…",
  emptyTitle: "No work schedules yet",
  emptyText: "Create one — for example 08:00–17:00, or a split shift 08:00–12:00 and 13:00–17:00 — then assign it to people.",

  // ── Row actions ───────────────────────────────────────────────────
  people: "People ({n})",
  assign: "Assign",

  // ── Delete ────────────────────────────────────────────────────────
  deleteTitle: "Delete \"{name}\"?",
  deleteText:
    "Days already worked keep their own record of these hours. If anyone still follows it, move them to another schedule first — or just set it to inactive.",
  deleted: "\"{name}\" deleted",
};
