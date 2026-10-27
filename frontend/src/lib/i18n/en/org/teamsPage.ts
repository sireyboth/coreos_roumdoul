// Teams page (app/dashboard/teams/page.tsx)

export const teamsPage = {
  // ── Page ─────────────────────────────────────────────────────────
  title: "Teams",
  description: "Smaller groups inside your departments. Employees are assigned to a team from the Employees page.",
  add: "Add team",

  // ── Table ────────────────────────────────────────────────────────
  search: "Search teams…",
  emptyTitle: "No teams yet",
  emptyDescription: "Create a team, then assign employees to it.",

  // ── Form ─────────────────────────────────────────────────────────
  addTitle: "Add a team",
  formDescription: "A team is a smaller group of people, usually inside a department.",
  department: "Department (optional)",
  noDepartment: "No department",
  orderExample: "the lead team",
  created: "Team created",
  updated: "Team updated",

  // ── Delete ───────────────────────────────────────────────────────
  deleteDescription: "A team that still has employees can't be deleted — move them to another team first, or set it to inactive instead.",

  // ── Members dialog ───────────────────────────────────────────────
  membersHint: "Adding people here also puts them in the {department} department.",
};
