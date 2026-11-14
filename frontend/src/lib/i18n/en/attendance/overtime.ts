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

  // ── Approve in part ──────────────────────────────────────────────
  approvePart: "Approve part",
  approvedPart: "Approved in part",
  ofWorked: "of {worked}",
  partTitle: "Approve part of the overtime",
  partText: "{name} worked {worked} of overtime on {date}. Only the time you approve is paid.",
  partHours: "Hours",
  partMinutes: "Minutes",
  partHint: "{approved} approved, {worked} worked. The rest is recorded but not paid.",
  partInvalid: "Enter whole hours, and minutes from 0 to 59.",
  partTooMuch: "Can't approve more than the {worked} worked.",
  partApprove: "Approve {time}",
};
