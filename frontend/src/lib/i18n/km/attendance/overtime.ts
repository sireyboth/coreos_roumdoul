import type { Dictionary } from "../../en";

// Overtime tab (components/dashboard/overtime-review.tsx) — same keys as en/attendance/overtime.ts.

export const overtime: Dictionary["attendance"]["overtime"] = {
  // ── Status tabs ──────────────────────────────────────────────────
  tabPending: "កំពុងរង់ចាំ",

  // ── Table ────────────────────────────────────────────────────────
  colOvertime: "ម៉ោងបន្ថែម",
  colWorked: "ម៉ោងធ្វើការ / ម៉ោងកំណត់",
  colSchedule: "កាលវិភាគការងារ",
  colReviewedBy: "ពិនិត្យដោយ",
  automatic: "ស្វ័យប្រវត្តិ",
  searchPlaceholder: "ស្វែងរកបុគ្គលិក…",

  // ── Empty list ───────────────────────────────────────────────────
  emptyPending: "មិនមានម៉ោងបន្ថែមរង់ចាំការអនុម័តទេ",
  emptyPendingHint: "ម៉ោងបន្ថែមលើកាលវិភាគការងារដែលតម្រូវឱ្យមានការអនុម័ត នឹងបង្ហាញនៅទីនេះ។",
  emptyApproved: "មិនមានម៉ោងបន្ថែមដែលបានអនុម័តទេ",
  emptyRejected: "មិនមានម៉ោងបន្ថែមដែលបានបដិសេធទេ",
  emptyReviewedHint: "ម៉ោងបន្ថែមនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានពិនិត្យរួច។",

  // ── After a decision ─────────────────────────────────────────────
  approved: "បានអនុម័តម៉ោងបន្ថែម",
  rejected: "បានបដិសេធម៉ោងបន្ថែម",
  decisionDetail: "{name} · {time} នៅថ្ងៃទី {date}",
};
