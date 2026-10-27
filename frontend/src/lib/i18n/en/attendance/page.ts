// Attendance page (app/dashboard/attendance/page.tsx)

export const page = {
  // ── Header & buttons ──────────────────────────────────────────────
  title: "Attendance",
  missedScans: "Missed scans",
  addAttendance: "Add attendance",

  // ── "Missing a scan" warning (your own days) ──────────────────────
  missingOne: "One of your days is missing a scan",
  missingOther: "{n} of your days are missing a scan",
  requestCorrection: "Request a correction",
  missingHint: "{dates} — those hours aren't fully counted until a correction adds the missing scan.",

  // ── Shortcut card ─────────────────────────────────────────────────
  shortcutTitle: "Set up a one-tap shortcut",
  shortcutHint:
    "Open instant-scan mode on your phone, then use your browser's \"Add to Home Screen\" option. The icon opens straight to the camera, ready to scan — no need to open the app each time.",
  noEmployee: "Your account isn't linked to an employee record, so you can't scan yourself.",

  // ── Tabs ──────────────────────────────────────────────────────────
  tabs: {
    records: "Records",
    overtime: "Overtime",
    corrections: "Corrections",
    report: "Report",
  },

  // ── Records table ─────────────────────────────────────────────────
  truncated: "This month has {total} records; showing the newest {shown}. Use the filters, or open a single employee, to see the rest.",
  checkIn: "Check in",
  checkOut: "Check out",
  worked: "Worked",
  earliestFirst: "Earliest first",
  latestFirst: "Latest first",
  moreScansOne: "+{n} more scan",
  moreScansOther: "+{n} more scans",
  lateBy: "{n}m late",
  earlyBy: "{n}m early",
  expected: "expected {time}",
  missing: "Missing",
  notYet: "Not yet",
  overtime: "+{time} OT",
  toReview: " (to review)",
  problem: "Problem",
  searchPlaceholder: "Search by employee or schedule…",
  emptyTitle: "No attendance this month",
  emptyHint: "Scans and work days show up here once people have a work schedule.",
  fillMissed: "Fill missed scans",
  deleteCount: "Delete {n}",
  details: "Details",

  // ── Deleting days ─────────────────────────────────────────────────
  deleteTitleOne: "Delete this day's attendance?",
  deleteTitleOther: "Delete {n} days of attendance?",
  deletedOne: "{n} day deleted",
  deletedOther: "{n} days deleted",
};
