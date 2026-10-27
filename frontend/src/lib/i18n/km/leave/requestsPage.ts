import type { Dictionary } from "../../en";

// Leave & requests page (app/dashboard/requests/page.tsx) — same keys as en/leave/requestsPage.ts.

export const requestsPage: Dictionary["leave"]["requestsPage"] = {
  // ── Header ────────────────────────────────────────────────────────
  title: "ច្បាប់ឈប់សម្រាក និងសំណើ",
  description: "ស្នើសុំច្បាប់ឈប់សម្រាក ឬស្នើសុំមកយឺត ឬចេញមុនម៉ោង ហើយតាមដានលទ្ធផលនៃសំណើ។",
  newRequest: "សំណើថ្មី",
  leave: "ច្បាប់ឈប់សម្រាក",

  // ── Balance cards ─────────────────────────────────────────────────
  left: "ថ្ងៃនៅសល់",
  used: "បានប្រើ {n}",
  waiting: "កំពុងរង់ចាំ {n}",
  earnedOf: "បានទទួល {earned} ក្នុងចំណោម {total}",
  perYear: "{n} ក្នុងមួយឆ្នាំ",

  // ── Tabs ──────────────────────────────────────────────────────────
  tabMine: "សំណើរបស់ខ្ញុំ",
  tabApprovals: "រង់ចាំខ្ញុំអនុម័ត",
  tabAll: "សំណើទាំងអស់",

  // ── Table ─────────────────────────────────────────────────────────
  colRequest: "សំណើ",
  colDates: "កាលបរិច្ឆេទ",
  sortEarliest: "ពីថ្ងៃដំបូងទៅចុងក្រោយ",
  sortLatest: "ពីថ្ងៃចុងក្រោយទៅដំបូង",
  withName: "រង់ចាំ {name}",
  withApprover: "រង់ចាំអ្នកអនុម័ត",
  byName: "ដោយ {name}",
  searchOwn: "ស្វែងរកសំណើ…",
  searchAll: "ស្វែងរកតាមបុគ្គលិក ឬសំណើ…",
  review: "ពិនិត្យ",
  deleteN: "លុប {n}",

  // ── Empty states ──────────────────────────────────────────────────
  emptyApprovals: "មិនមានសំណើរង់ចាំលោកអ្នកទេ",
  emptyApprovalsHint: "សំណើច្បាប់ឈប់សម្រាក និងសំណើមកយឺត ឬចេញមុនម៉ោងពីក្រុមរបស់លោកអ្នក នឹងបង្ហាញនៅទីនេះសម្រាប់អនុម័ត។",
  emptyMine: "មិនទាន់មានសំណើនៅឡើយទេ",
  emptyMineHint: "សូមចុច “សំណើថ្មី” ដើម្បីស្នើសុំច្បាប់ឈប់សម្រាក ឬស្នើសុំមកយឺត ឬចេញមុនម៉ោង។",
  emptyAll: "មិនមានសំណើទេ",
  emptyAllHint: "សំណើពីសាខាដែលលោកអ្នកទទួលបន្ទុក នឹងបង្ហាញនៅទីនេះ។",

  // ── Deleting ──────────────────────────────────────────────────────
  deleteMany: "លុបសំណើចំនួន {n} ឬ?",
  deletedOne: "បានលុបសំណើចំនួន {n}",
  deletedOther: "បានលុបសំណើចំនួន {n}",
};
