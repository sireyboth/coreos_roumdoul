import type { Dictionary } from "../../en";

// Overtime tab (components/dashboard/attendance/overtime-review.tsx) — same keys as en/attendance/overtime.ts.

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
  approvePart: "អនុម័តមួយផ្នែក",
  approvedPart: "បានអនុម័តមួយផ្នែក",
  ofWorked: "ក្នុងចំណោម {worked}",
  partTitle: "អនុម័តម៉ោងបន្ថែមមួយផ្នែក",
  partText: "{name} បានធ្វើម៉ោងបន្ថែម {worked} នៅថ្ងៃ {date}។ មានតែម៉ោងដែលអ្នកអនុម័តប៉ុណ្ណោះ ទើបត្រូវបើកប្រាក់។",
  partHours: "ម៉ោង",
  partMinutes: "នាទី",
  partHint: "អនុម័ត {approved} ក្នុងចំណោម {worked} ដែលបានធ្វើ។ ម៉ោងនៅសល់ត្រូវបានកត់ត្រា ប៉ុន្តែមិនបើកប្រាក់ទេ។",
  partInvalid: "សូមបញ្ចូលម៉ោងជាចំនួនគត់ និងនាទីពី 0 ដល់ 59។",
  partTooMuch: "មិនអាចអនុម័តលើស {worked} ដែលបានធ្វើបានទេ។",
  partApprove: "អនុម័ត {time}",
  decisionDetail: "{name} · {time} នៅថ្ងៃទី {date}",
};
