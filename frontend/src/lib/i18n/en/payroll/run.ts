// One pay run (app/dashboard/payroll/runs/[id]/page.tsx)

export const run = {
  // ── Header ────────────────────────────────────────────────────────
  back: "Pay runs",
  payroll: "Payroll",
  next: {
    draft: "Calculating…",
    calculated: "Check each payslip. Fix attendance or rules and recalculate as often as needed, then approve.",
    approved: "Approved and frozen. Pay your staff, then mark the run as paid.",
    paid: "Paid. Any later fix goes into a future period as an adjustment.",
  },
  nextPrepare: "Check each payslip and recalculate as needed. When it's ready, a person who can approve payroll approves it.",
  nextApprove: "Check each payslip, then approve. If something needs fixing or recalculating, ask the person who prepared the run.",
  dashboard: "Dashboard",

  // ── Export menu ───────────────────────────────────────────────────
  preparing: "Preparing…",
  pdfReport: "Payroll report (PDF)",
  pdfReportHint: "Summary, register, components, cost by branch",
  pdfPayments: "Report with payment list (PDF)",
  pdfPaymentsHint: "Adds bank accounts and a cash signature sheet",
  csv: "Spreadsheet (CSV)",
  csvHint: "One row per payslip, for the bank or accountant",

  // ── Actions ───────────────────────────────────────────────────────
  recalculate: "Recalculate",
  recalculated: "Recalculated",
  recalculatedOne: "{name} recalculated",
  approving: "Approving…",
  reopen: "Reopen",
  markPaid: "Mark as paid",
  deleteRun: "Delete pay run",
  approveTitle: "Approve {group} for {period}?",
  approveText: "Pay is recalculated one last time, then frozen, and the attendance it used is locked for these people and days. It can't be changed afterwards — later fixes go into a future period as adjustments.",
  approved: "Payroll approved",
  paidTitle: "Mark as paid?",
  paidText: "Records that staff have been paid for this period.",
  marked: "Marked as paid",
  reopened: "Pay run reopened — its attendance can be changed again",
  deleteTitle: "Delete this pay run?",
  deleteText: "Its payslips are removed. You can start the period again at any time.",

  // ── Out-of-date warning ───────────────────────────────────────────
  staleEveryone: "Something changed since this was calculated",
  staleOne: "{n} person's pay changed since this was calculated",
  staleOther: "{n} people's pay changed since this was calculated",
  recalculateNow: "Recalculate now",
  recalculateThem: "Recalculate them",
  recalculateThese: "Recalculate these {n}",
  staleEveryoneText: "A rule, the pay group or who is in it changed. The numbers below don't include it yet.",
  stalePeopleText: "{names}: their attendance, salary or adjustments changed. Everyone else is up to date.",
  someone: "Someone",
  somePeople: "Some people",
  problemsOne: "{n} payslip needs fixing",
  problemsOther: "{n} payslips need fixing",
  problemsText: "Open the payslips marked “Needs fixing” to see why, fix the cause (usually attendance), then recalculate.",

  // ── Totals ────────────────────────────────────────────────────────
  netOne: "Net pay ({currency}) · {n} person",
  netOther: "Net pay ({currency}) · {n} people",
  gross: "Gross ({currency})",
  withheld: "NSSF + tax withheld ({currency})",
  cost: "Total cost to company ({currency})",

  // ── Payslip table ─────────────────────────────────────────────────
  colSalary: "Salary",
  perDay: " /day",
  colGross: "Gross",
  colStatutory: "NSSF + tax",
  colNet: "Net pay",
  colCheck: "Check",
  removedEmployee: "Removed employee",
  changed: "Changed",
  needsFixing: "Needs fixing",
  note: "Note",
  ok: "OK",
  search: "Search employees…",
  emptyTitle: "No payslips",
  emptyText: "Nobody in this pay group has a salary for this period yet. Add salaries on each employee's Pay tab, then recalculate.",

  // ── Reopen dialog ─────────────────────────────────────────────────
  reopenLabel: "{group} for {period}",
  reopenTitle: "Reopen {label}?",
  reopenText: "It goes back to calculated and the attendance it locked can be changed again. Fix what's wrong, recalculate, then approve it again.",
  reopenPaid: "It was marked as paid — if staff were already paid, a fix in a later period as an adjustment is usually better.",
  reopenPlaceholder: "What needs fixing",
};
