// Missed scans dialog (components/dashboard/attendance/missed-scans-dialog.tsx)
// IN/OUT slot names come from attendance.fillMissed (slotIn / slotOut).

export const missedScans = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Missed scans",
  description: "Days where someone worked but didn't scan. Check the times, then save to complete their record.",

  // ── Employee, month & reason ──────────────────────────────────────
  allEmployees: "All employees",
  reasonPlaceholder: "e.g. Scanner was down / Working at a client site",
  reasonMissing: "Add a reason — it's saved on each day and shown in the export.",
  reasonHint: "Saved on each day you save, and shown in the attendance export.",

  // ── Days list ─────────────────────────────────────────────────────
  noneTitle: "No missed scans",
  noneHint: "Everyone scanned in and out in {month}.",
  noScans: "No scans",
  missingScan: "Missing a scan",
  slotTime: "{slot} time",

  // ── Footer ────────────────────────────────────────────────────────
  footerHint: "Grey times were scanned and stay as they are. Times you leave unchanged follow the schedule.",
  saveAll: "Save all",
  saveAllCount: "Save all ({n})",
  savedOne: "Missed scans saved on {n} day",
  savedOther: "Missed scans saved on {n} days",
};
