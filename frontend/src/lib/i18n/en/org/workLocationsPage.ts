// Work locations page (app/dashboard/work-locations/page.tsx)

export const workLocationsPage = {
  // ── Page ─────────────────────────────────────────────────────────
  title: "Work locations",
  description: "Physical check-in points. Each branch has one automatically; add extra ones for client sites or company-wide offices.",
  add: "Add location",

  // ── Table ────────────────────────────────────────────────────────
  colRadius: "Radius",
  radiusValue: "{n}m",
  search: "Search locations…",
  emptyTitle: "No work locations yet",
  emptyDescription: "Add a location so employees have somewhere to check in from.",

  // ── Form ─────────────────────────────────────────────────────────
  addTitle: "Add a work location",
  branchDescription: "This is a branch's check-in point. Change its name, address or coordinates from the Branches page.",
  formDescription: "A check-in point that isn't tied to a branch — e.g. a client site or a company-wide office.",
  radius: "Radius (meters)",
  radiusHint: "How close someone must be for a check-in to count. QR scans are checked against it too whenever the phone shares its location.",
  radiusHintRequire:
    "How close someone must be for a check-in to count. QR scans are checked against it too whenever the phone shares its location — and always, if location is required below.",
  requireLocationNeedsCoords: "Set the latitude and longitude above first.",
  requireLocationHint: "A scan only counts if the phone is inside the radius, so a photo of the poster can't be used from elsewhere.",
  branchSetsLocation: "Whether a scan must include the employee's location is set on the branch itself.",
  orderExample: "the main site",
  added: "Work location added",
  updated: "Work location updated",

  // ── Delete ───────────────────────────────────────────────────────
  deleteDescription:
    "Past attendance keeps its record of this location. If upcoming schedules use it, you'll need to change those first — or just deactivate it instead.",
};
