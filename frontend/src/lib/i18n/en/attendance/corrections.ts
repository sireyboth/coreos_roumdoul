// Corrections tab (components/dashboard/attendance/attendance-corrections.tsx)

export const corrections = {
  // ── Toolbar ──────────────────────────────────────────────────────
  request: "Request correction",

  // ── New request form ─────────────────────────────────────────────
  formTitle: "Request a correction",
  formDescription: "Your manager will need to approve this.",
  missedScans: "Scans you missed",
  missedScansHint: "Only the ones you forgot — e.g. just 12:00 if you didn't scan out for lunch. Your schedule decides whether each is an IN or an OUT.",
  scanN: "Scan {n}",
  removeTime: "Remove this time",
  addTime: "Add another time",
  submitting: "Submitting…",
  submit: "Submit request",
  requested: "Correction requested",
  requestedHint: "Your manager will review it.",

  // ── Table ────────────────────────────────────────────────────────
  colScans: "Scans to add",
  sortEarliest: "Earliest first",
  sortLatest: "Latest first",
  reviewedBy: "by {name}",
  searchManager: "Search by employee or reason…",
  searchOwn: "Search by reason…",
  empty: "No correction requests",
  emptyHint: "Nothing to review right now.",
  review: "Review",
  open: "Open",

  // ── Review dialog ────────────────────────────────────────────────
  title: "Correction",
  add: "Add:",
  decidedBy: "{status} by {name}",
  remark: "Remark to the employee",
  reasonOptional: "Reason (optional)",
  remarkPlaceholder: "Optional when approving, needed when rejecting",
  remarkMissing: "Add a remark — the employee will see it.",
  cancelRequest: "Cancel request",
  approved: "Correction approved",
  approvedHint: "The scans were added and the day recalculated.",
  rejected: "Correction rejected",
  cancelled: "Correction cancelled",
};
