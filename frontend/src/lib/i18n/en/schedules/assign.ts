// Assign a schedule to people (components/dashboard/assign-schedule-dialog.tsx).

export const assign = {
  // ── Header ────────────────────────────────────────────────────────
  titleEmployee: "Assign a schedule to {name}",
  titleSchedule: "Assign \"{name}\"",
  description:
    "From the start date this replaces their current schedule. Days already worked are re-checked against the new plan; locked months are never changed.",

  // ── Schedule ──────────────────────────────────────────────────────
  schedule: "Work schedule",
  noActive: "No active schedules yet — create one first",
  select: "Select…",

  // ── Employees ─────────────────────────────────────────────────────
  employees: "Employees",
  search: "Search name, ID, branch or department…",
  noMatch: "No one matches.",
  selectAllShown: "Select all shown",

  // ── Dates ─────────────────────────────────────────────────────────
  startsOn: "Starts on",
  endsOn: "Ends on",
  ongoing: "Ongoing",
  temporary: "Temporary — afterwards they go back to their usual schedule",

  // ── Days off ──────────────────────────────────────────────────────
  daysOff: "Weekly days off",
  daysOffHint: "Off: {days}. Holidays and one-off days off still apply on top.",

  // ── Result ────────────────────────────────────────────────────────
  notAssigned: "Not assigned",
  assigning: "Assigning…",
  assignSchedule: "Assign schedule",
  assignToOne: "Assign to {n} person",
  assignToMany: "Assign to {n} people",
  followsOne: "{name} now follows \"{schedule}\"",
  bulkOne: "{n} person now follows \"{schedule}\"",
  bulkMany: "{n} people now follow \"{schedule}\"",
  partial: "{n} assigned",
  partialHint: "{n} skipped — see why below.",
};
