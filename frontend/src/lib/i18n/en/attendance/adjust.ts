// Adjust scans (components/dashboard/attendance-adjust-scans.tsx)

export const adjust = {
  // ── Heading ──────────────────────────────────────────────────────
  title: "Adjust scans",
  hint: "Change a time, remove a wrong scan, or add a missing one. The schedule still decides whether each is an IN or an OUT. Removed and replaced scans stay on record with your reason.",

  // ── Scan rows ────────────────────────────────────────────────────
  roleIn: "IN",
  roleOut: "OUT",
  roleExtra: "Extra",
  roleNew: "New",
  scanN: "Scan {n}",
  changed: "Changed",
  removeNew: "Remove this new scan",
  removeScan: "Remove this scan",
  addScan: "Add a scan",

  // ── Reason & save ────────────────────────────────────────────────
  reasonPlaceholder: "e.g. Scanner was down; confirmed with the branch manager",
  save: "Save adjustment",
  saved: "Attendance adjusted",
  savedHint: "The day was recalculated.",
};
