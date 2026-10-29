// Add attendance dialog (components/dashboard/attendance/attendance-add-dialog.tsx)

export const add = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Add attendance",
  description:
    "Record a day with no scans — for example work on a day off, or a day the scanner was down. It is saved right away and marked as adjusted by you.",

  // ── Employee & date ───────────────────────────────────────────────
  chooseEmployee: "Choose an employee",

  // ── Day already has scans ─────────────────────────────────────────
  existsTitle: "This day already has scans",
  openDay: "Open day",
  existsHint: "Open it and use Adjust scans to change or add times.",

  // ── Scans ─────────────────────────────────────────────────────────
  scans: "Scans",
  scansHint:
    "Every scan of the day, in order. The schedule decides which is an IN and which an OUT; a time earlier than the one before it is read as the next morning.",
  scanN: "Scan {n}",
  removeScanN: "Remove scan {n}",
  addScan: "Add a scan",

  // ── Reason & save ─────────────────────────────────────────────────
  reasonPlaceholder: "e.g. Worked Sunday stock count; confirmed by branch manager",
  added: "Attendance added",
  recalculated: "The day was recalculated.",
};
