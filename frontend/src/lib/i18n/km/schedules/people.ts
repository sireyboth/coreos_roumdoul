import type { Dictionary } from "../../en";

// Who follows a schedule (components/dashboard/schedules/schedule-people-dialog.tsx) — same keys as en/schedules/people.ts.

export const people: Dictionary["schedules"]["people"] = {
  // ── Header ────────────────────────────────────────────────────────
  title: "បុគ្គលិកក្នុងកាលវិភាគ {name}",
  followsOne: "បុគ្គលិក {n} នាក់ អនុវត្តកាលវិភាគនេះថ្ងៃនេះ។",
  followsMany: "បុគ្គលិក {n} នាក់ អនុវត្តកាលវិភាគនេះថ្ងៃនេះ។",
  followsOneMore: "បុគ្គលិក {n} នាក់ អនុវត្តកាលវិភាគនេះថ្ងៃនេះ និង {more} នាក់ទៀតចាប់ពីថ្ងៃក្រោយ។",
  followsManyMore: "បុគ្គលិក {n} នាក់ អនុវត្តកាលវិភាគនេះថ្ងៃនេះ និង {more} នាក់ទៀតចាប់ពីថ្ងៃក្រោយ។",

  // ── Tabs & search ─────────────────────────────────────────────────
  today: "ថ្ងៃនេះ ({n})",
  upcoming: "នាពេលខាងមុខ ({n})",
  search: "ស្វែងរកតាមឈ្មោះ ឬអត្តលេខ…",

  // ── List ──────────────────────────────────────────────────────────
  noMatch: "រកមិនឃើញបុគ្គលិកត្រូវនឹងការស្វែងរកទេ។",
  noneToday: "គ្មានបុគ្គលិកអនុវត្តកាលវិភាគនេះថ្ងៃនេះទេ។",
  noneLater: "គ្មានបុគ្គលិកចាប់ផ្តើមកាលវិភាគនេះនៅពេលក្រោយទេ។",
  since: "តាំងពី {from}",
  sinceUntil: "តាំងពី {from} ដល់ {to}",
  from: "ចាប់ពី {from}",
  fromUntil: "ចាប់ពី {from} ដល់ {to}",
  off: "សម្រាក {days}",
};
