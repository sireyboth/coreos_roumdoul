// Day details dialog (components/dashboard/attendance-day-dialog.tsx)

export const day = {
  // ── Header ───────────────────────────────────────────────────────
  title: "Attendance",

  // ── Summary ──────────────────────────────────────────────────────
  worked: "Worked",
  lateEarly: "Late / early",
  lateMinutes: "{n}m late",
  earlyMinutes: "{n}m early",
  overtime: "Overtime",

  // ── Expected and actual ──────────────────────────────────────────
  expectedActual: "Expected and actual",
  colScan: "Scan",
  colExpected: "Expected",
  colActual: "Actual",
  colResult: "Result",
  scanIn: "IN",
  scanOut: "OUT",
  slot: {
    ok: "On time",
    late: "Late",
    early: "Early",
    missing: "Missing",
    pending: "Not yet",
  },

  // ── Adjustments ──────────────────────────────────────────────────
  adjustedByAdmin: "Adjusted by an admin",
  deletedUser: "Deleted user",
  adjustReason: "Reason: {reason}",

  // ── Scans list ───────────────────────────────────────────────────
  automatic: "Recorded automatically from the schedule — this person doesn't need to scan.",
  scans: "Scans ({n})",
  scanTitle: "{n}. {role} at {time}",
  noScans: "No scans on this day.",
  noLocation: "No location",
  noLocationHint: "The scan came without the phone's location, so it couldn't be checked against the branch.",
  method: {
    qr: "QR scan",
    gps: "GPS",
    correction: "Approved correction",
    adjustment: "Adjusted by admin",
    auto: "Automatic",
    none: "Not verified",
  },
  location: "Location",
  distance: "Distance",
  distanceValue: "{m} m from the location",
  noGpsToCompare: "No GPS to compare",
  recordedBy: "Recorded by",
  phoneWas: "Where the employee's phone was",
  noPhoneGps: "{location} (the phone sent no GPS)",
  openInMaps: "Open in Google Maps",

  // ── Deleting a day ───────────────────────────────────────────────
  deleteTitle: "Delete attendance for this day?",
  deleteTitleNamed: "Delete {name}'s attendance for this day?",
  deleteWarning:
    "All scans, corrections and adjustments for the day are removed for good. A past work day will then show as absent. Use this to clear test data; to fix a real record, use Adjust scans.",
  deleted: "Attendance deleted",
};
