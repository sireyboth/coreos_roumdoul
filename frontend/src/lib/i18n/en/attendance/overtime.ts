// Overtime tab (components/dashboard/attendance/overtime-review.tsx)

export const overtime = {
  // ── Status tabs ──────────────────────────────────────────────────
  tabPending: "Waiting",

  // ── Table ────────────────────────────────────────────────────────
  colOvertime: "Overtime",
  colWorked: "Worked / scheduled",
  colSchedule: "Schedule",
  colReviewedBy: "Reviewed by",
  automatic: "Automatic",
  searchPlaceholder: "Search employee…",

  // ── Empty list ───────────────────────────────────────────────────
  emptyPending: "Nothing waiting for approval",
  emptyPendingHint: "Overtime on schedules that need approval shows up here.",
  emptyApproved: "No approved overtime",
  emptyRejected: "No rejected overtime",
  emptyReviewedHint: "Overtime appears here once it has been reviewed.",

  // ── After a decision ─────────────────────────────────────────────
  approved: "Overtime approved",
  rejected: "Overtime rejected",
  decisionDetail: "{name} · {time} on {date}",
};
