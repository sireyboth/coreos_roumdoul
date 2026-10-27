// Employees page (app/dashboard/employees/page.tsx)

export const listPage = {
  // ── Header & tabs ────────────────────────────────────────────────
  title: "Employees",
  descriptionPeople: "Your team's records, photos and details.",
  descriptionRoster: "Who works which shift, and when.",
  descriptionOwnShifts: "Your shifts.",
  tabPeople: "People",
  tabRoster: "Roster",

  // ── Notices ──────────────────────────────────────────────────────
  tooMany: "You have {total} employees; showing the first {shown}. Filter by branch or department to narrow the list.",

  // ── Table ────────────────────────────────────────────────────────
  colLogin: "Login",
  sortNoLoginFirst: "No login first",
  sortHasLoginFirst: "Has login first",
  noLoginYet: "No login yet",
  search: "Search by name, code, email, phone, branch or job title…",
  deleteN: "Delete {n}",
  emptyHint: "Add your first employee to start building your team directory.",

  // ── Delete ───────────────────────────────────────────────────────
  deleteManyTitle: "Delete {n} employees?",
  deletedOne: "1 employee deleted",
  deletedOther: "{n} employees deleted",
};
