// One request in full (components/dashboard/requests/request-detail-dialog.tsx).

export const detail = {
  // ── Header ────────────────────────────────────────────────────────
  changeType: "Change type",

  // ── Change the leave type ─────────────────────────────────────────
  changeTo: "Change {label} to",
  chooseType: "Choose a leave type",
  typeRemarkPlaceholder: "Remark to the employee (optional), e.g. Was ill, not on holiday",
  typeRecheck: "The same dates are checked again for the new type.",
  typeFollows: "Balance and attendance follow the change.",
  typeStillWaits: "It still waits for approval.",
  saveType: "Save type",
  confirmTypeTitle: "Change to {name}?",
  thisType: "this type",
  confirmTypeBody: "This leave is already approved: its days move to the new type's balance and attendance is worked out again.",
  confirmTypePay: " The paid days you chose go back to what the new type pays.",
  typeChanged: "Leave type changed",

  // ── Paid days ─────────────────────────────────────────────────────
  paidDays: "Paid days",
  paidDaysHint: "Attendance keeps this as {label}; payroll pays the days ticked. The leave balance doesn't change.",
  paidDaysApproved: " Already approved: fix the ticks and save — not possible once the month is locked.",
  payRemarkPlaceholder: "Remark to the employee (optional), e.g. Only Monday was agreed",
  savePaidDays: "Save paid days",
  paidDaysSaved: "Paid days saved",
  paidAsTypeSays: "paid as {label} says",

  // ── File ──────────────────────────────────────────────────────────
  openFull: "Open full size",

  // ── History ───────────────────────────────────────────────────────
  sent: "Sent {when}",
  sentBy: " by {name}",
  payChanged: "Paid days changed from {from} to {to} by {name} {when}",
  changedFrom: "Changed from {from} to {to} by {name} {when}",
  waitingFor: "Waiting for {name}",
  waitingForAny: "Waiting for an approver for their branch",
  approvedBy: "Approved by {name} {when}",
  rejectedBy: "Rejected by {name} {when}",
  cancelledBy: "Cancelled by {name} {when}",

  // ── Decision ──────────────────────────────────────────────────────
  remarkPlaceholder: "Optional when approving, needed when rejecting",
  cancelReasonPlaceholder: "Needed — say why it is cancelled",
  remarkMissing: "Add a remark — the employee will see it.",
  cancelRequest: "Cancel request",

  // ── Cancelling ────────────────────────────────────────────────────
  cancelTitle: "Cancel this {label}?",
  cancelPending: "It will no longer wait for approval.",
  cancelLeave: "The days go back to the balance and attendance is worked out again.",
  cancelLateEarly: "Attendance is worked out again without it.",
  cancelIt: "Cancel it",
  keepIt: "Keep it",

  // ── Toasts ────────────────────────────────────────────────────────
  approved: "{label} approved",
  rejected: "{label} rejected",
  cancelled: "{label} cancelled",
  deleted: "{label} deleted",
};
