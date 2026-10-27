// Ask for leave dialog (components/dashboard/requests/leave-request-dialog.tsx).

export const leaveDialog = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Ask for leave",
  description: "Only working days count — holidays and days off inside the dates are free.",

  // ── Form ──────────────────────────────────────────────────────────
  type: "Type of leave",
  partOfDay: "Part of the day",

  // ── What it comes to ──────────────────────────────────────────────
  checking: "Checking the dates…",
  checkFailed: "Couldn't check these dates.",
  takes: "Takes {days}",
  takesNone: "Takes no working days",
  left: "left",
  after: "after",

  // ── Reason, file, approval ────────────────────────────────────────
  reasonPlaceholder: "e.g. Family wedding in Siem Reap",
  documentRequired: "Document (required)",
  documentHint: "— e.g. a medical certificate; PDF or photo, up to 10 MB",
  approveNowHint: "For leave you are recording for them, e.g. a sick call this morning.",
  record: "Record leave",

  // ── Sent ──────────────────────────────────────────────────────────
  recorded: "Leave recorded",
  sent: "Leave request sent",
};
