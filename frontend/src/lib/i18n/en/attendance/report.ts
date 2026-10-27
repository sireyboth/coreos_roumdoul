// Report tab (components/dashboard/attendance-report.tsx, lib/attendance-insights.ts)

export const report = {
  // ── Period & view switches ────────────────────────────────────────
  mode: {
    month: "Month",
    range: "Date range",
  },
  view: {
    label: "View",
    calendar: "Calendar",
    detail: "Late detail",
  },
  exportExcel: "Export Excel",

  // ── Filters ───────────────────────────────────────────────────────
  filter: {
    search: "Search employee…",
    allEmployees: "All employees",
    allBranches: "All branches",
    allDepartments: "All departments",
    onlyIssues: "Only absences / missed scans",
  },

  // ── Date range problems (also used by the export dialog) ──────────
  range: {
    bothDates: "Choose both dates.",
    endBeforeStart: "The end date comes before the start date.",
    tooLong: "Pick a range of one year or less.",
  },
  loadFailed: "The report couldn't be loaded.",

  // ── Summary tiles ─────────────────────────────────────────────────
  tiles: {
    lateRate: "Late rate",
    absenceRate: "Absence rate",
    lateDays: "Late days",
    timeLost: "Time lost to lateness",
    missedScans: "Missed scans",
    leaveDays: "Leave days",
    points: "{n} pts",
    compared: "Compared with the same number of days just before",
    noChange: "No change",
    vsBefore: "vs before",
  },

  // ── Calendar grid ─────────────────────────────────────────────────
  calendar: {
    noAttendance: "No attendance to show for this period.",
    noMatch: "No one matches these filters.",
    latePct: "Late %",
    latePctHint: "Late days ÷ days attended",
    hint: "Click a day to open it; hover for its scans. A blank day is still to come, or has no schedule.",
  },

  // Weekday column heads
  weekday: {
    sun: "Su",
    mon: "Mo",
    tue: "Tu",
    wed: "We",
    thu: "Th",
    fri: "Fr",
    sat: "Sa",
  },

  // Calendar codes: the column / row total, and the legend
  code: {
    present: { total: "Present", legend: "Present, on time" },
    late: { total: "Late", legend: "Late" },
    early: { total: "Left early", legend: "Left early" },
    lateEarly: { total: "Late + early", legend: "Late and left early" },
    missed: { total: "Missed scan", legend: "Missed a scan" },
    absent: { total: "Absent", legend: "Absent" },
    halfDay: { total: "Half-day leave", legend: "Half-day leave, worked the other half" },
    leave: { total: "Leave", legend: "On leave (full day)" },
    workedOff: { total: "Worked off", legend: "Worked on a day off / holiday / leave" },
    holiday: { total: "Holiday", legend: "Holiday" },
    off: { total: "Off", legend: "Day off / weekly off" },
  },

  // ── Issue kinds (lib/attendance-insights.ts ISSUES) ───────────────
  issue: {
    late: "Late",
    early: "Early leave",
    missed: "Missed scan",
    absent: "Absent",
  },
};
