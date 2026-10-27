// Leave & requests page (app/dashboard/requests/page.tsx).

export const requestsPage = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Leave & requests",
  description: "Ask for time off, or to arrive late or leave early — and follow what happens to it.",
  newRequest: "New request",
  leave: "Leave",

  // ── Balance cards ─────────────────────────────────────────────────
  left: "left",
  used: "{n} used",
  waiting: "{n} waiting",
  earnedOf: "{earned} of {total} earned",
  perYear: "{n} a year",

  // ── Tabs ──────────────────────────────────────────────────────────
  tabMine: "My requests",
  tabApprovals: "Waiting for me",
  tabAll: "All requests",

  // ── Table ─────────────────────────────────────────────────────────
  colRequest: "Request",
  colDates: "Dates",
  sortEarliest: "Earliest first",
  sortLatest: "Latest first",
  withName: "With {name}",
  withApprover: "With an approver",
  byName: "by {name}",
  searchOwn: "Search requests…",
  searchAll: "Search employee or request…",
  review: "Review",
  deleteN: "Delete {n}",

  // ── Empty states ──────────────────────────────────────────────────
  emptyApprovals: "Nothing waiting for you",
  emptyApprovalsHint: "Leave and late / early requests from your team show up here for you to approve.",
  emptyMine: "No requests yet",
  emptyMineHint: "Tap “New request” to ask for leave, or to arrive late or leave early.",
  emptyAll: "No requests",
  emptyAllHint: "Requests from the branches you cover show up here.",

  // ── Deleting ──────────────────────────────────────────────────────
  deleteMany: "Delete {n} requests?",
  deletedOne: "{n} request deleted",
  deletedOther: "{n} requests deleted",
};
