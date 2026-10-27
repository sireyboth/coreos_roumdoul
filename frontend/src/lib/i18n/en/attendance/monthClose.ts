// Close the month (components/dashboard/attendance-month-close.tsx)

export const monthClose = {
  // ── Checklist before closing ──────────────────────────────────────
  check: {
    missedOne: "{n} day is missing a scan",
    missedMany: "{n} days are missing a scan",
    missedHint: "Hours aren't fully counted until the scan is filled in.",
    missedAction: "Fill missed scans",
    correctionsOne: "{n} correction request is waiting",
    correctionsMany: "{n} correction requests are waiting",
    correctionsHint: "Approving one can change the day.",
    overtimeOne: "{n} overtime entry is waiting",
    overtimeMany: "{n} overtime entries are waiting",
    overtimeHint: "Overtime nobody reviewed stays unapproved once the month is closed.",
    absencesOne: "{n} absence without leave",
    absencesMany: "{n} absences without leave",
    absencesHint: "Check each is a real absence, not leave someone forgot to request.",
    review: "Review",
    check: "Check",
  },

  // ── Open month ────────────────────────────────────────────────────
  open: {
    before: "Before you close {month}",
    ready: "{month} is ready to close",
    allClear: "No missed scans, waiting requests, unreviewed overtime or unexplained absences.",
    close: "Close month",
  },

  // ── Closed month ──────────────────────────────────────────────────
  closed: {
    badge: "Month closed",
    text: "{month} was closed {date}. Nothing in it can change.",
    textBy: "{month} was closed {date} by {name}. Nothing in it can change.",
    reopen: "Reopen",
  },

  // ── Confirmations & messages ──────────────────────────────────────
  confirm: {
    closeTitle: "Close {month}?",
    closeText: "Its attendance is worked out one last time, then frozen: no scans, corrections, roster or schedule changes can alter it until someone reopens it.",
    closed: "{month} closed",
    pendingTitle: "Overtime still waiting for approval",
    closeAnyway: "Close anyway",
    reopenTitle: "Reopen {month}?",
    reopenText: "Its attendance can change again — corrections, roster changes and recalculation. Close it again when you're done.",
    reopened: "{month} reopened",
  },
};
