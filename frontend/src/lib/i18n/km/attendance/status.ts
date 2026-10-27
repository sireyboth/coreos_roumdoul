import type { Dictionary } from "../../en";

// ស្ថានភាពវត្តមាន — Labels for attendance codes. Same keys as en/attendance/status.ts.

export const status: Dictionary["attendance"]["status"] = {
  // ── A day's status ────────────────────────────────────────────────
  day: {
    upcoming: "មិនទាន់ដល់ពេល",
    in_progress: "កំពុងធ្វើការ",
    complete: "ពេញលេញ",
    incomplete: "មិនពេញលេញ",
    absent: "អវត្តមាន",
    off: "ថ្ងៃសម្រាក",
    worked_off: "ធ្វើការថ្ងៃសម្រាក",
    unscheduled: "មិនមានកាលវិភាគ",
  },

  // ── Problems on a day ─────────────────────────────────────────────
  exception: {
    late: "មកយឺត",
    early_leave: "ចេញមុនម៉ោង",
    missing_in: "ខកខានស្កេនចូល",
    missing_out: "ខកខានស្កេនចេញ",
    absent: "អវត្តមាន",
    extra_scan: "ស្កេនលើស",
    worked_day_off: "ធ្វើការថ្ងៃសម្រាក",
    worked_holiday: "ធ្វើការថ្ងៃឈប់សម្រាកសាធារណៈ",
    unscheduled_work: "មិនមានកាលវិភាគ",
    overtime_pending: "ម៉ោងបន្ថែមរង់ចាំពិនិត្យ",
  },

  // ── What kind of day the overtime was on ──────────────────────────
  overtimeType: {
    workday: "ថ្ងៃធ្វើការ",
    day_off: "ថ្ងៃសម្រាក",
    holiday: "ថ្ងៃឈប់សម្រាកសាធារណៈ",
  },
};
