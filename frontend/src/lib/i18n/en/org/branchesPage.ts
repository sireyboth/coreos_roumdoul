// Branches page (app/dashboard/branches/page.tsx)

export const branchesPage = {
  // ── Page ─────────────────────────────────────────────────────────
  title: "Branches",
  description: "Physical or virtual locations your employees belong to.",
  add: "Add branch",

  // ── Table ────────────────────────────────────────────────────────
  gpsSet: "GPS set",
  colQrCheckIn: "QR check-in",
  locationRequired: "Location required",
  qrOnly: "QR only",
  qrOnlyFirst: "QR only first",
  locationRequiredFirst: "Location required first",
  search: "Search branches…",
  emptyTitle: "No branches yet",
  emptyDescription: "Add your first branch to start organizing your team.",

  // ── Form ─────────────────────────────────────────────────────────
  addTitle: "Add a branch",
  addDescription: "Adding a location makes it a real check-in point for Attendance.",
  editDescription: "Updating coordinates keeps its check-in point in sync.",
  locationHint: "Required — this is what lets Attendance check whether a check-in is actually near this branch.",
  requireLocationHint:
    "Employees must be at the branch (within its radius) for a scan to count, so a photo of the poster can't be used from home. Leave it off for indoor branches where phones can't get a GPS signal.",
  orderExample: "head office",
  added: "Branch added",
  updated: "Branch updated",

  // ── Delete ───────────────────────────────────────────────────────
  deleteDescription:
    "Its check-in location and QR code are removed too. Past attendance keeps its history. If employees are still assigned here, move them first — or just deactivate the branch instead.",
};
