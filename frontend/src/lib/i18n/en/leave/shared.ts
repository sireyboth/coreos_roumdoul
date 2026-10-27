// Shared by the Leave & requests screens and lib/requests.ts — statuses, parts of the day,
// amounts, and form pieces the leave and late / early dialogs both use.

export const shared = {
  // ── Request status (REQUEST_STATUS in lib/requests.ts) ────────────
  status: {
    pending: "Waiting",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  },

  // ── Part of the day ───────────────────────────────────────────────
  dayPart: {
    full: "Full day",
    am: "Morning",
    pm: "Afternoon",
  },

  // ── Late / early request kinds ────────────────────────────────────
  kind: {
    late: "Late arrival",
    early: "Early leave",
  },
  lateEarly: "Late arrival / Early leave",

  // ── Dates & amounts ───────────────────────────────────────────────
  halfDay: "{date} ({part})",
  dayOne: "{n} day",
  dayOther: "{n} days",
  andMore: "{list} and {n} more",
  inAt: "in at {time} · {minutes} min",
  outAt: "out at {time} · {minutes} min",

  // ── Pay ───────────────────────────────────────────────────────────
  paid: "Paid",
  unpaid: "Unpaid",
  payPercent: "{percent}% pay",
  unpaidTag: " (unpaid)",
  payTag: " ({percent}% pay)",

  // ── Request forms ─────────────────────────────────────────────────
  for: "For",
  myself: "Myself",
  choosePerson: "Choose a person",
  chooseFile: "Choose a file or take a photo",
  documentOptional: "Document (optional)",
  cantSendYet: "Can't send this yet",
  approveNow: "Approve it now",
  sending: "Sending…",
  sendRequest: "Send request",
  willReview: "{name} will review it.",
  approverWillReview: "An approver will review it.",
  remarkToEmployee: "Remark to the employee",

  // ── Deleting requests ─────────────────────────────────────────────
  deleteOne: "Delete this {label}?",
  deleteWarning:
    "Removes the request, its file and its notifications for good. Approved leave goes back to the balance and attendance is worked out again. Use this to clear test data; to undo a real request, cancel it so the history stays.",
};
