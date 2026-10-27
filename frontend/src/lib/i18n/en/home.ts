// Phone home screen (app/dashboard/home) and the language switch.

export const home = {
  // ── Header greeting ───────────────────────────────────────────────
  greeting: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
  },

  // ── Menu sections ─────────────────────────────────────────────────
  menu: {
    services: "Services",
    more: "More",
    language: "Language",
  },

  // ── "Today" card — the signed-in employee's own scans ─────────────
  today: {
    badge: "Today",
    checkedIn: "Checked in",
    checkedOut: "Checked out",
    notCheckedIn: "Not checked in yet",
    noWork: "No work scheduled",
    auto: "Recorded automatically",
    next: "Next {slot} at {time}",
    allDone: "All scans done for today",
    scansDone: "{done} of {total} scans",
    worked: "Worked {time}",
    in: "IN",
    out: "OUT",
    scanAttendance: "Scan attendance",
    request: "Request",
    correction: "Correction",
  },

  // ── "Team today" card — for managers ──────────────────────────────
  team: {
    badge: "Team today",
    checkedIn: "checked in",
    late: "Late",
    corrections: "Corrections",
    overtime: "Overtime",
  },

  // ── Scan banner ───────────────────────────────────────────────────
  scanBanner: {
    title: "Instant scan",
    body: "Open the camera and check in with one tap.",
    cta: "Open scanner",
  },
};
