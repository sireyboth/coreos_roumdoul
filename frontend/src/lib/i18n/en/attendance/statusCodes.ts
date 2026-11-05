// Attendance → Status codes (app/dashboard/attendance/status-codes/page.tsx) and the links to it.

export const statusCodes = {
  customize: "Customize codes",
  title: "Status codes",
  description: "How each status looks everywhere it is shown: the report, calendar, attendance list, Excel and PDF. Change it here once.",
  meaningNote: "Only the look changes. A day is still late or absent because of its scans and schedule, and totals and payroll don't change.",

  // ── Sections ──────────────────────────────────────────────────────
  daySection: "Day statuses",
  leaveSection: "Leave types",
  leaveHint: "Each leave type's own code. Unpaid leave shows in red while its text colour is Auto.",
  preview: "Preview",

  // ── One row ───────────────────────────────────────────────────────
  meaning: "Meaning",
  code: "Code",
  background: "Background",
  text: "Text",
  bold: "Bold",
  codeHint: "Up to 3 letters or numbers (Khmer too).",
  unpaid: "unpaid",
  inactive: "turned off",

  // ── Day statuses ──────────────────────────────────────────────────
  status: {
    P: "Present, on time",
    L: "Late",
    E: "Left early",
    LE: "Late and left early",
    M: "Missed a scan",
    A: "Absent",
    W: "Worked on a day off",
    H: "Holiday",
    OFF: "Day off",
  },

  // ── Colours ───────────────────────────────────────────────────────
  colors: {
    green: "Green",
    amber: "Amber",
    yellow: "Yellow",
    gold: "Gold",
    orange: "Orange",
    red: "Red",
    blue: "Blue",
    gray: "Grey",
    light: "Light",
    violet: "Violet",
    fuchsia: "Fuchsia",
    pink: "Pink",
    indigo: "Indigo",
    cyan: "Cyan",
    teal: "Teal",
    lime: "Lime",
    slate: "Slate",
  },
  textColors: {
    auto: "Auto (matches the background)",
    dark: "Dark",
    white: "White",
    red: "Red",
    green: "Green",
    blue: "Blue",
    orange: "Orange",
    violet: "Violet",
    gray: "Grey",
  },

  // ── Checks and actions ────────────────────────────────────────────
  empty: "Give every status a code.",
  duplicate: "{code} is used more than once. One code, one meaning.",
  reset: "Reset to default",
  resetTitle: "Reset every code and colour?",
  resetText: "Day statuses go back to P, L, E… and the built-in leave types to AL, SL… in their usual colours. Your own leave types keep their codes.",
  saved: "Status codes saved",
  wasReset: "Status codes reset to default",
  readOnly: "Only people who manage attendance can change these.",
};
