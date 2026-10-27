// Departments page (app/dashboard/departments/page.tsx)

export const departmentsPage = {
  // ── Page ─────────────────────────────────────────────────────────
  title: "Departments",
  description: "How your company is organized. Employees are assigned to a department from the Employees page.",
  add: "Add department",

  // ── Table ────────────────────────────────────────────────────────
  colPartOf: "Part of",
  topLevel: "Top level",
  colTeams: "Teams",
  search: "Search departments…",
  emptyTitle: "No departments yet",
  emptyDescription: "Create a department, then assign employees to it.",

  // ── Form ─────────────────────────────────────────────────────────
  addTitle: "Add a department",
  formDescription: "Departments group your employees, and can sit inside one another.",
  partOf: "Part of (optional)",
  branch: "Branch (optional)",
  branchHint: "Leave as company-wide if it spans every branch.",
  inactiveHint: "Inactive departments can't be chosen for new assignments, but keep their history.",
  orderExample: "the main department",
  created: "Department created",
  updated: "Department updated",

  // ── Delete ───────────────────────────────────────────────────────
  deleteDescription:
    "A department that still has employees, teams or sub-departments can't be deleted — move them first, or set it to inactive instead.",

  // ── Members dialog ───────────────────────────────────────────────
  membersHint: "People already in another department are moved here (their history is kept).",
};
