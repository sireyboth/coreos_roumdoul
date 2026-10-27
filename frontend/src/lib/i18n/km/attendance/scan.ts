import type { Dictionary } from "../../en";

// Instant scan page (app/dashboard/scan/page.tsx) — same keys as en/attendance/scan.ts.
// Also uses attendance.today (IN/OUT, "Next: …", recorded messages).

export const scan: Dictionary["attendance"]["scan"] = {
  // ── No employee record ────────────────────────────────────────────
  goToAttendance: "ទៅកាន់ទំព័រវត្តមាន",

  // ── Camera ────────────────────────────────────────────────────────
  exit: "ចាកចេញពីរបៀបស្កេន",
  pointCamera: "សូមតម្រង់កាមេរ៉ាទៅកាន់កូដ QR",

  // ── After a scan ──────────────────────────────────────────────────
  nextThen: "បន្ទាប់៖ ស្កេន{slot} ម៉ោង {time}។ សូមស្កេនកូដ QR ដដែលនៅពេលនោះ។",
  allDone: "លោកអ្នកបានស្កេនគ្រប់ចំនួនសម្រាប់ថ្ងៃនេះហើយ។",
  scanAgain: "ស្កេនម្តងទៀត",
};
