import type { Dictionary } from "../../en";

// On-screen payslip (components/dashboard/payroll/payslip-view.tsx) — same keys as en/payroll/payslip.ts.

export const payslip: Dictionary["payroll"]["payslip"] = {
  // ── Totals ────────────────────────────────────────────────────────
  gross: "ប្រាក់បៀវត្សរ៍សរុប",
  statutory: "ប.ស.ស. + ពន្ធ",
  net: "ប្រាក់ត្រូវទទួលសុទ្ធ",
  grossPay: "ប្រាក់បៀវត្សរ៍សរុប",
  cost: "ចំណាយរបស់ក្រុមហ៊ុន",

  // ── Worked out from ───────────────────────────────────────────────
  workedFrom: "គណនាពី",
  daysWorked: "ថ្ងៃធ្វើការ",
  absent: "អវត្តមាន",
  missingScan: "ខកខានស្កេន",
  lateArrivals: "មកយឺត",
  dailyRate: "អត្រាប្រចាំថ្ងៃ",
  hourlyRate: "អត្រាប្រចាំម៉ោង",
  dayBasis: "មូលដ្ឋានថ្ងៃ",
  days: "{n} ថ្ងៃ",
  taxRate: "អត្រាប្តូរប្រាក់សម្រាប់ពន្ធ (KHR)",
  missing: "មិនទាន់មាន",
  paidFor: "បើកប្រាក់សម្រាប់ {from} – {to}",
  perDay: "បើកប្រាក់តាមថ្ងៃ",
  monthly: "ប្រាក់បៀវត្សរ៍ប្រចាំខែ",
  fallbackRate: "ប្រើអត្រាប្តូរប្រាក់បម្រុងរបស់ក្រុមហ៊ុន",

  // ── Gross by month ────────────────────────────────────────────────
  byMonth: "ប្រាក់បៀវត្សរ៍សរុបតាមខែ",
  monthDaysOne: "{month} · {n} ថ្ងៃ",
  monthDaysOther: "{month} · {n} ថ្ងៃ",
  crossMonth: "រយៈពេលនេះឆ្លងកាត់ខែ៖ ប្រាក់បៀវត្សរ៍សរុបត្រូវបានបែងចែកតាមថ្ងៃ សម្រាប់របាយការណ៍ប្រចាំខែ។",

  // ── Dialog ────────────────────────────────────────────────────────
  title: "ប័ណ្ណបើកប្រាក់បៀវត្សរ៍",
  for: "ប័ណ្ណបើកប្រាក់បៀវត្សរ៍សម្រាប់ {period}",

  // ── Set a line by hand ────────────────────────────────────────────
  override: {
    edit: "កំណត់ {line} ដោយដៃ",
    badge: "កំណត់ដោយដៃ",
    because: "ហេតុផល៖ {reason}",
    wasRule: "ច្បាប់គណនាបាន {amount}",
    ruleSays: "ច្បាប់គណនាបាន {amount}។ ចំនួនដែលអ្នកកំណត់នឹងនៅដដែល ពេលគណនាប័ណ្ណបើកប្រាក់បៀវត្សរ៍ឡើងវិញ រហូតដល់អ្នកលុបវាចេញ។",
    amount: "ចំនួនទឹកប្រាក់",
    reason: "ហេតុផល",
    reasonHint: "ហេតុអ្វីបានជាចំនួននេះ? វានឹងបង្ហាញលើប័ណ្ណបើកប្រាក់បៀវត្សរ៍ និងក្នុងកំណត់ហេតុសកម្មភាព។",
    useRule: "ប្រើចំនួនតាមច្បាប់គណនា",
    saved: "បានធ្វើបច្ចុប្បន្នភាពប័ណ្ណបើកប្រាក់បៀវត្សរ៍។",
  },
  otDays: {
    show: "បង្ហាញថ្ងៃធ្វើម៉ោងបន្ថែម {n} ថ្ងៃ",
    hide: "លាក់ថ្ងៃធ្វើម៉ោងបន្ថែម",
    approvedOf: "អនុម័ត {approved} ម៉ោង ក្នុងចំណោម {recorded} ម៉ោង",
    hours: "{worked} ម៉ោង",
    capped: "ធ្វើ {worked} ម៉ោង បើកប្រាក់ {paid} ម៉ោង",
    fixed: "{worked} ម៉ោង ចំនួនទឹកប្រាក់ថេរ",
    type: { workday: "ថ្ងៃធ្វើការ", day_off: "ថ្ងៃឈប់សម្រាក", holiday: "ថ្ងៃបុណ្យ" },
  },
};
