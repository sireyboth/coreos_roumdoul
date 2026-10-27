import type { Dictionary } from "../../en";

// Payroll labels shared by every payroll screen (components/dashboard/payroll/shared.tsx) — same keys as en/payroll/shared.ts.
// Also used by the pay-setup components (component-dialog, employee-pay-panel, pay-groups).

export const shared: Dictionary["payroll"]["shared"] = {
  // ── Pay schedules ─────────────────────────────────────────────────
  schedule: {
    monthly: "ម្តងក្នុងមួយខែ",
    semi_monthly: "ពីរដងក្នុងមួយខែ",
    weekly: "រៀងរាល់សប្តាហ៍",
    biweekly: "រៀងរាល់ 2 សប្តាហ៍",
    custom: "ជ្រើសរើសកាលបរិច្ឆេទរៀងរាល់លើក",
  },

  // ── Schedule summary ("1st → end of month") ───────────────────────
  summary: {
    // English adds "st/nd/rd/th" in code; Khmer reads "ថ្ងៃទី {n}".
    dayOfMonth: "ថ្ងៃទី {n}",
    endOfMonth: "ចុងខែ",
    monthlyFull: "ថ្ងៃទី 1 → ចុងខែ",
    monthlyRange: "{from} → {to}",
    semiMonthly: "រយៈពេលបើកប្រាក់បៀវត្សរ៍បញ្ចប់នៅ{first} និង{second}",
    weeklyFrom: "ប្រចាំសប្តាហ៍ ចាប់ផ្តើមពីថ្ងៃ{day}",
    biweeklyFrom: "រៀងរាល់ 2 សប្តាហ៍ ចាប់ផ្តើមពីថ្ងៃ{day}",
    custom: "ផ្នែកធនធានមនុស្សជ្រើសរើសកាលបរិច្ឆេទសម្រាប់ការបើកប្រាក់បៀវត្សរ៍នីមួយៗ",
  },

  // ── Pay run status (draft / approved / paid use common.status) ────
  inReview: "កំពុងពិនិត្យ",

  // ── Kinds of pay component ────────────────────────────────────────
  kind: {
    earning: "ប្រាក់ចំណូល",
    deduction: "ការកាត់ប្រាក់",
    net_deduction: "ការកាត់ប្រាក់ក្រោយបង់ពន្ធ",
  },
  kindHint: {
    earning: "បូកបញ្ចូលក្នុងប្រាក់បៀវត្សរ៍ (ប្រាក់ឧបត្ថម្ភ ប្រាក់រង្វាន់ ប្រាក់កម្រៃជើងសារ)។",
    deduction: "កាត់មុនបង់ពន្ធ (ឧ. ការពិន័យ)។ ធ្វើឲ្យប្រាក់បៀវត្សរ៍សរុបថយចុះ។",
    net_deduction: "កាត់ក្រោយបង់ពន្ធ (ប្រាក់បៀវត្សរ៍បើកមុន ការសងប្រាក់កម្ចី)។",
  },

  // ── Payslip sections ──────────────────────────────────────────────
  section: {
    earning: "ប្រាក់ចំណូល",
    deduction: "ការកាត់ប្រាក់",
    statutory: "ប.ស.ស. និងពន្ធលើប្រាក់បៀវត្សរ៍",
    net_deduction: "ការកាត់ប្រាក់ក្រោយបង់ពន្ធ",
    employer: "ក្រុមហ៊ុនជាអ្នកបង់ (មិនកាត់ពីប្រាក់បៀវត្សរ៍)",
  },

  // ── Reasons for a salary change ───────────────────────────────────
  salaryReason: {
    hired: "ប្រាក់បៀវត្សរ៍ចាប់ផ្តើម",
    probation_passed: "បានបញ្ចប់រយៈពេលសាកល្បងការងារ",
    promotion: "ការដំឡើងតួនាទី",
    annual_increase: "ការដំឡើងប្រចាំឆ្នាំ",
    change: "ការផ្លាស់ប្តូរផ្សេងទៀត",
    correction: "ការកែតម្រូវ",
  },

  // ── A component's rule in one line ────────────────────────────────
  rule: {
    base: "ប្រាក់បៀវត្សរ៍គោល គណនាតាមសមាមាត្រសម្រាប់បុគ្គលិកចូលថ្មី និងបុគ្គលិកលាឈប់",
    employeeItem: "ចំនួនទឹកប្រាក់កំណត់នៅផ្ទាំងប្រាក់បៀវត្សរ៍របស់បុគ្គលិកម្នាក់ៗ",
    overtime: "ថ្ងៃធ្វើការ {workday} · ថ្ងៃសម្រាក {dayOff} · ថ្ងៃឈប់សម្រាកសាធារណៈ {holiday}",
    attendanceBonus: "{amount} នៅពេលអវត្តមានមិនលើស {absences} ដង និងមកយឺតមិនលើស {lates} ដង",
    attendanceBonusUnset: "សូមកំណត់ចំនួនទឹកប្រាក់ ដើម្បីប្រើប្រាស់",
    absence: "អត្រាប្រចាំថ្ងៃ × ចំនួនថ្ងៃអវត្តមាន{multiplier} (ប្រាក់បៀវត្សរ៍ប្រចាំខែ)",
    unpaidLeave: "អត្រាប្រចាំថ្ងៃ × ចំនួនថ្ងៃច្បាប់ឈប់សម្រាកគ្មានប្រាក់ឈ្នួល (ប្រាក់បៀវត្សរ៍ប្រចាំខែ)",
    unpaidPermission: "អត្រាប្រចាំនាទី × ការអនុញ្ញាតមកយឺត / ចេញមុនម៉ោង គ្មានប្រាក់ឈ្នួល",
    perMinute: "គិតតាមនាទី",
    perMinuteGrace: "គិតតាមនាទី ក្រោយពេលអនុគ្រោះ {n} នាទីក្នុងមួយថ្ងៃ",
    perTime: "{amount} ក្នុងមួយដង",
    perTimeFree: "{amount} ក្នុងមួយដង លើកលែង {n} ដងដំបូងក្នុងមួយខែ",
    countBased: "រៀងរាល់ {n} ដង = ប្រាក់បៀវត្សរ៍មួយថ្ងៃ",
    tiersOne: "{n} កម្រិត តាមចំនួននាទីមកយឺតក្នុងមួយថ្ងៃ",
    tiersOther: "{n} កម្រិត តាមចំនួននាទីមកយឺតក្នុងមួយថ្ងៃ",
    notCharged: "មិនកាត់ប្រាក់",
  },

  // ── Warnings ──────────────────────────────────────────────────────
  fixBeforeApproving: "សូមកែមុនពេលអនុម័ត",
};
