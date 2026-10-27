import type { Dictionary } from "../../en";

// Calendar agenda view (components/dashboard/calendar-agenda.tsx) — same keys as en/calendar/agenda.ts.

export const agenda: Dictionary["calendar"]["agenda"] = {
  // ── Event types (totals double as filter chips) ───────────────────
  type: {
    holiday: "ថ្ងៃឈប់សម្រាកសាធារណៈ",
    leave: "ច្បាប់ឈប់សម្រាក",
    day_off: "ថ្ងៃសម្រាក",
    absent: "អវត្តមាន",
  },

  // ── Range picker ──────────────────────────────────────────────────
  rangeLabel: "រយៈពេល",
  range: {
    upcoming: "3 ខែខាងមុខ",
    month: "ខែនេះ",
    year: "ឆ្នាំនេះ",
    last_year: "ឆ្នាំមុន",
  },
  everyone: "បុគ្គលិកទាំងអស់",
  loadFailed: "មិនអាចផ្ទុកបញ្ជីព្រឹត្តិការណ៍បានទេ។",

  // ── List ──────────────────────────────────────────────────────────
  empty: "មិនមានអ្វីក្នុងរយៈពេលនេះទេ — គ្មានថ្ងៃឈប់សម្រាកសាធារណៈ ច្បាប់ឈប់សម្រាក ថ្ងៃសម្រាក ឬអវត្តមាន។",
  pending: "កំពុងរង់ចាំការអនុម័ត",
  companyHoliday: "ថ្ងៃឈប់សម្រាករបស់ក្រុមហ៊ុន",
  morning: "ពេលព្រឹក",
  afternoon: "ពេលរសៀល",
  dayOne: "{n} ថ្ងៃ",
  dayOther: "{n} ថ្ងៃ",
  more: " +{n} នាក់ទៀត",
};
