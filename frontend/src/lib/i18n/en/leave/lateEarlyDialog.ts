// Late arrival / early leave dialog (components/dashboard/requests/late-early-request-dialog.tsx).
// The title is leave.shared.lateEarly.

export const lateEarlyDialog = {
  // ── Header ────────────────────────────────────────────────────────
  description: "Ask before (or on) the day. Once approved, you won't be marked late or early for it.",

  // ── Form ──────────────────────────────────────────────────────────
  lateOrEarly: "Late or early",
  arriveLate: "Arrive late",
  leaveEarly: "Leave early",
  arriveAt: "I'll arrive at",
  leaveAt: "I'll leave at",

  // ── What it comes to ──────────────────────────────────────────────
  checking: "Checking…",
  checkFailed: "Couldn't check this.",
  minutesLate: "{n} min late",
  minutesEarly: "{n} min early",
  usualStart: "(usual start {time})",
  usualEnd: "(usual end {time})",
  usedThisMonth: "{used} of {limit} used this month",

  // ── Reason, file, approval ────────────────────────────────────────
  reasonPlaceholder: "e.g. Taking my child to the hospital",
  approveNowHint: "For one you are recording for them, e.g. they called in this morning.",
  record: "Record it",

  // ── Sent ──────────────────────────────────────────────────────────
  recorded: "{label} recorded",
  sent: "{label} request sent",
};
