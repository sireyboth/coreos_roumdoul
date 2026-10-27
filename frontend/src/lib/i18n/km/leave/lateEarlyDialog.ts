import type { Dictionary } from "../../en";

// Late arrival / early leave dialog (components/dashboard/requests/late-early-request-dialog.tsx) — same keys as
// en/leave/lateEarlyDialog.ts. The title is leave.shared.lateEarly.

export const lateEarlyDialog: Dictionary["leave"]["lateEarlyDialog"] = {
  // ── Header ────────────────────────────────────────────────────────
  description: "សូមស្នើសុំមុនថ្ងៃនោះ ឬនៅថ្ងៃនោះ។ នៅពេលបានអនុម័ត លោកអ្នកនឹងមិនត្រូវកត់ត្រាថាមកយឺត ឬចេញមុនម៉ោងទេ។",

  // ── Form ──────────────────────────────────────────────────────────
  lateOrEarly: "មកយឺត ឬចេញមុនម៉ោង",
  arriveLate: "មកយឺត",
  leaveEarly: "ចេញមុនម៉ោង",
  arriveAt: "ខ្ញុំនឹងមកដល់ម៉ោង",
  leaveAt: "ខ្ញុំនឹងចេញម៉ោង",

  // ── What it comes to ──────────────────────────────────────────────
  checking: "កំពុងពិនិត្យ…",
  checkFailed: "មិនអាចពិនិត្យបានទេ។",
  minutesLate: "យឺត {n} នាទី",
  minutesEarly: "មុនម៉ោង {n} នាទី",
  usualStart: "(ម៉ោងចូលធម្មតា {time})",
  usualEnd: "(ម៉ោងចេញធម្មតា {time})",
  usedThisMonth: "ខែនេះបានប្រើ {used} ក្នុងចំណោម {limit}",

  // ── Reason, file, approval ────────────────────────────────────────
  reasonPlaceholder: "ឧ. នាំកូនទៅមន្ទីរពេទ្យ",
  approveNowHint: "សម្រាប់សំណើដែលលោកអ្នកកត់ត្រាជំនួសបុគ្គលិក ឧ. បុគ្គលិកបានទូរស័ព្ទមកនៅព្រឹកនេះ។",
  record: "កត់ត្រា",

  // ── Sent ──────────────────────────────────────────────────────────
  recorded: "បានកត់ត្រាការ{label}",
  sent: "បានដាក់ស្នើសំណើ{label}",
};
