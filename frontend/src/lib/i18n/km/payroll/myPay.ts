import type { Dictionary } from "../../en";

// Your own pay on the profile page (components/dashboard/payroll/my-pay.tsx) — same keys as en/payroll/myPay.ts.

export const myPay: Dictionary["payroll"]["myPay"] = {
  title: "ប្រាក់បៀវត្សរ៍របស់ខ្ញុំ",
  hint: "ប្រាក់បៀវត្សរ៍បច្ចុប្បន្ន និងប័ណ្ណបើកប្រាក់បៀវត្សរ៍ដែលលោកអ្នកបានទទួល",

  // ── Current salary ────────────────────────────────────────────────
  currentSalary: "ប្រាក់បៀវត្សរ៍បច្ចុប្បន្ន",
  perMonth: "ក្នុងមួយខែ",
  perDay: "ក្នុងមួយថ្ងៃ",
  since: "ចាប់ពី {date}",
  noSalary: "មិនទាន់មានការកំណត់ប្រាក់បៀវត្សរ៍សម្រាប់លោកអ្នកនៅឡើយទេ។",
  show: "បង្ហាញចំនួនទឹកប្រាក់",
  hide: "លាក់ចំនួនទឹកប្រាក់",

  // ── Payslips ──────────────────────────────────────────────────────
  payslips: "ប័ណ្ណបើកប្រាក់បៀវត្សរ៍",
  netPay: "ប្រាក់ត្រូវទទួលសុទ្ធ",
  noPayslips: "មិនទាន់មានប័ណ្ណបើកប្រាក់បៀវត្សរ៍នៅឡើយទេ។ វានឹងបង្ហាញនៅទីនេះ នៅពេលការបើកប្រាក់បៀវត្សរ៍ត្រូវបានអនុម័ត។",
  paidOn: "បានបើកនៅ {date}",
};
