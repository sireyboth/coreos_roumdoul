// Roles page (app/dashboard/roles/page.tsx)

export const rolesPage = {
  // ── Header ───────────────────────────────────────────────────────
  title: "Roles & permissions",
  description: "Define what each position at your company can see and do.",
  create: "Create role",

  // ── Table ────────────────────────────────────────────────────────
  colRole: "Role",
  protected: "Protected",
  colPermissions: "Permissions",
  permissionCount: "{n} of {total}",
  search: "Search roles…",
  empty: "No roles yet",
  emptyHint: "Create a role to control what your team can access.",
  editOrder: "Edit order",

  // ── Delete ───────────────────────────────────────────────────────
  deleteTitle: "Delete the \"{name}\" role?",
  deleteDescription: "This can't be undone. A role that's still assigned to someone can't be deleted.",
  deleted: "\"{name}\" role deleted",

  // ── Self-approval ────────────────────────────────────────────────
  selfTitle: "Self-approval",
  selfDescription: "By default nobody approves or changes their own attendance, overtime, leave balance or pay, or approves a pay run they prepared — someone else with the permission has to. Turn this on only if one person runs everything.",
  selfLabel: "Allow people to approve their own items",
  selfOn: "People can now approve their own items",
  selfOff: "Self-approval is now blocked",
};
