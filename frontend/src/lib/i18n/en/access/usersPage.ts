// Users page (app/dashboard/users/page.tsx)

export const usersPage = {
  // ── Header ───────────────────────────────────────────────────────
  title: "Users",
  manageRoles: "Manage roles & permissions →",
  invite: "Invite user",

  // ── Invite dialog ────────────────────────────────────────────────
  inviteTitle: "Invite a teammate",
  inviteDescription: "Creates their login and assigns a role.",
  tempPassword: "Temporary password",
  role: "Role",
  inviting: "Inviting…",
  inviteButton: "Invite",
  invited: "Teammate invited",
  invitedHint: "{email} can now sign in.",

  // ── Table ────────────────────────────────────────────────────────
  you: "(you)",
  colLogin: "Email / ID",
  signsInById: "Signs in with their employee ID",
  idPrefix: "ID: {id}",
  noRole: "no role",
  deactivated: "Deactivated",
  sortDeactivatedFirst: "Deactivated first",
  sortActiveFirst: "Active first",
  colBranches: "Branch access",
  allBranches: "All branches",
  search: "Search by name, email or ID…",
  empty: "No users yet",
  emptyHint: "Invite your first teammate to give them access.",
  branchAccess: "Branch access",
  deactivate: "Deactivate",
  activate: "Activate",

  // ── Messages ─────────────────────────────────────────────────────
  roleChanged: "{name} is now {role}",
  deactivatedToast: "{name} deactivated",
  reactivatedToast: "{name} reactivated",
  removeTitle: "Remove {name}?",
  removeDescription: "They will lose access immediately. This can't be undone.",
  removed: "{name} removed",

  // ── Branch access dialog ─────────────────────────────────────────
  branchTitle: "Branch access for {name}",
  branchDescription: "Leave everything unchecked to give them access to every branch. Check specific branches to restrict them to only those.",
  branchSaved: "Branch access updated",
  branchSavedSome: "{name} can now see only the selected branches.",
  branchSavedAll: "{name} can now see every branch.",
};
