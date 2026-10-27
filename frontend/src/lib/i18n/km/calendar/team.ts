import type { Dictionary } from "../../en";

// Team calendar (components/dashboard/team-calendar.tsx) — same keys as en/calendar/team.ts.

export const team: Dictionary["calendar"]["team"] = {
  // ── Toolbar ───────────────────────────────────────────────────────
  loadFailed: "មិនអាចផ្ទុកប្រតិទិនក្រុមបានទេ។",
  searchPlaceholder: "ស្វែងរកបុគ្គលិក…",
  searchLabel: "ស្វែងរកបុគ្គលិក",
  allBranches: "សាខាទាំងអស់",
  truncated: "កំពុងបង្ហាញបុគ្គលិក {shown} នាក់ដំបូង ក្នុងចំណោម {total} នាក់។ សូមជ្រើសរើសសាខា ដើម្បីបង្រួមលទ្ធផល។",

  // ── Today at a glance ─────────────────────────────────────────────
  stat: {
    scheduled: "មានកាលវិភាគថ្ងៃនេះ",
    present: "មានវត្តមាន",
    late: "មកយឺត",
    absent: "អវត្តមាន",
    off: "សម្រាក / ថ្ងៃឈប់សម្រាក",
  },

  // ── Grid ──────────────────────────────────────────────────────────
  noEmployees: "មិនមានបុគ្គលិកសម្រាប់បង្ហាញក្នុងខែនេះទេ។",
  noMatches: "មិនមានបុគ្គលិកត្រូវនឹងការស្វែងរកទេ។",
  colEmployee: "បុគ្គលិក",
  colPresent: "មានវត្តមាន",
  colLate: "មកយឺត",
  colAbsent: "អវត្តមាន",
  tipScans: "ការស្កេន {scans}",

  // ── Legend ────────────────────────────────────────────────────────
  khmerHoliday: "ថ្ងៃឈប់សម្រាកសាធារណៈនៅកម្ពុជា",
};
