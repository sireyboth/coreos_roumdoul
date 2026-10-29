import type { Dictionary } from "../../en";

// Report tab (components/dashboard/attendance/attendance-report.tsx, lib/attendance-insights.ts) — same keys as en/attendance/report.ts.

export const report: Dictionary["attendance"]["report"] = {
  // ── Period & view switches ────────────────────────────────────────
  mode: {
    month: "ខែ",
    range: "ចន្លោះកាលបរិច្ឆេទ",
  },
  view: {
    label: "ទិដ្ឋភាព",
    calendar: "ប្រតិទិន",
    detail: "ព័ត៌មានលម្អិតការមកយឺត",
  },
  exportExcel: "នាំចេញ Excel",

  // ── Filters ───────────────────────────────────────────────────────
  filter: {
    search: "ស្វែងរកបុគ្គលិក…",
    allEmployees: "បុគ្គលិកទាំងអស់",
    allBranches: "សាខាទាំងអស់",
    allDepartments: "នាយកដ្ឋានទាំងអស់",
    onlyIssues: "តែអវត្តមាន / ខកខានស្កេន",
  },

  // ── Date range problems (also used by the export dialog) ──────────
  range: {
    bothDates: "សូមជ្រើសរើសកាលបរិច្ឆេទទាំងពីរ។",
    endBeforeStart: "កាលបរិច្ឆេទបញ្ចប់ស្ថិតនៅមុនកាលបរិច្ឆេទចាប់ផ្តើម។",
    tooLong: "សូមជ្រើសរើសចន្លោះពេលមិនលើសពីមួយឆ្នាំ។",
  },
  loadFailed: "មិនអាចផ្ទុករបាយការណ៍បានទេ។",

  // ── Summary tiles ─────────────────────────────────────────────────
  tiles: {
    lateRate: "អត្រាមកយឺត",
    absenceRate: "អត្រាអវត្តមាន",
    lateDays: "ចំនួនថ្ងៃមកយឺត",
    timeLost: "ពេលវេលាបាត់បង់ដោយសារមកយឺត",
    missedScans: "ខកខានស្កេន",
    leaveDays: "ចំនួនថ្ងៃច្បាប់ឈប់សម្រាក",
    points: "{n} ពិន្ទុភាគរយ",
    compared: "ប្រៀបធៀបនឹងចំនួនថ្ងៃដូចគ្នា នៅមុនរយៈពេលនេះ",
    noChange: "គ្មានការប្រែប្រួល",
    vsBefore: "ធៀបនឹងមុន",
  },

  // ── Calendar grid ─────────────────────────────────────────────────
  calendar: {
    noAttendance: "មិនមានទិន្នន័យវត្តមានសម្រាប់រយៈពេលនេះទេ។",
    noMatch: "មិនមានបុគ្គលិកត្រូវនឹងតម្រងទាំងនេះទេ។",
    latePct: "% មកយឺត",
    latePctHint: "ចំនួនថ្ងៃមកយឺត ÷ ចំនួនថ្ងៃមានវត្តមាន",
    hint: "សូមចុចលើថ្ងៃណាមួយដើម្បីបើកមើល ឬដាក់ទស្សន៍ទ្រនិចលើវាដើម្បីមើលការស្កេន។ ថ្ងៃទទេ គឺជាថ្ងៃមិនទាន់ដល់ ឬគ្មានកាលវិភាគ។",
  },

  // Weekday column heads
  weekday: {
    sun: "អា",
    mon: "ច",
    tue: "អ",
    wed: "ពុ",
    thu: "ព្រ",
    fri: "សុ",
    sat: "ស",
  },

  // Calendar codes: the column / row total, and the legend
  code: {
    present: { total: "មានវត្តមាន", legend: "មានវត្តមាន ទាន់ម៉ោង" },
    late: { total: "មកយឺត", legend: "មកយឺត" },
    early: { total: "ចេញមុនម៉ោង", legend: "ចេញមុនម៉ោង" },
    lateEarly: { total: "មកយឺត + ចេញមុន", legend: "មកយឺត និងចេញមុនម៉ោង" },
    missed: { total: "ខកខានស្កេន", legend: "ខកខានស្កេនម្តង ឬច្រើនដង" },
    absent: { total: "អវត្តមាន", legend: "អវត្តមាន" },
    halfDay: { total: "ច្បាប់កន្លះថ្ងៃ", legend: "ច្បាប់ឈប់សម្រាកកន្លះថ្ងៃ និងធ្វើការកន្លះថ្ងៃទៀត" },
    leave: { total: "ច្បាប់ឈប់សម្រាក", legend: "ច្បាប់ឈប់សម្រាក (ពេញមួយថ្ងៃ)" },
    workedOff: { total: "ធ្វើការថ្ងៃសម្រាក", legend: "ធ្វើការនៅថ្ងៃសម្រាក ថ្ងៃឈប់សម្រាកសាធារណៈ ឬថ្ងៃច្បាប់ឈប់សម្រាក" },
    holiday: { total: "ថ្ងៃឈប់សម្រាកសាធារណៈ", legend: "ថ្ងៃឈប់សម្រាកសាធារណៈ" },
    off: { total: "ថ្ងៃសម្រាក", legend: "ថ្ងៃសម្រាក / ថ្ងៃសម្រាកប្រចាំសប្តាហ៍" },
  },

  // ── Issue kinds (lib/attendance-insights.ts ISSUES) ───────────────
  issue: {
    late: "មកយឺត",
    early: "ចេញមុនម៉ោង",
    missed: "ខកខានស្កេន",
    absent: "អវត្តមាន",
  },
};
