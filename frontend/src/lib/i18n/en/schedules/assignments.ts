// One employee's schedules over time (components/dashboard/employee-schedule-assignments.tsx).

export const assignments = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Work schedule",
  follows: "Follows \"{name}\" — off {days}.",
  none: "No work schedule right now, so no hours are expected.",
  change: "Change schedule",
  assign: "Assign a schedule",
  empty: "Assign a work schedule so {name}'s scans can be checked against expected hours.",

  // ── Entries ───────────────────────────────────────────────────────
  deletedSchedule: "Deleted schedule",
  state: {
    current: "Current",
    upcoming: "Upcoming",
    ended: "Ended",
  },
  ongoing: "ongoing",
  off: "off {days}",
  endToday: "End today",
  removeEntry: "Remove this schedule entry",

  // ── Confirmations & messages ──────────────────────────────────────
  stopTitle: "Stop \"{schedule}\" for {name}?",
  stopText: "It ends today. From tomorrow they have no work schedule until you assign another — so no expected hours and no absences.",
  ended: "Schedule ended",
  removeTitle: "Remove this schedule entry?",
  removeText:
    "Use this to undo a mistake. Days already worked in this period are re-checked as having no schedule. To change someone's schedule from a date, assign the new one instead.",
  removed: "Schedule entry removed",
};
