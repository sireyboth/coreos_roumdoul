import type { Dictionary } from "../../en";

// Day details dialog (components/dashboard/attendance/attendance-day-dialog.tsx) — same keys as en/attendance/day.ts.

export const day: Dictionary["attendance"]["day"] = {
  // ── Header ───────────────────────────────────────────────────────
  title: "វត្តមាន",

  // ── Summary ──────────────────────────────────────────────────────
  worked: "ម៉ោងធ្វើការ",
  lateEarly: "មកយឺត / ចេញមុនម៉ោង",
  lateMinutes: "មកយឺត {n} នាទី",
  earlyMinutes: "ចេញមុន {n} នាទី",
  overtime: "ម៉ោងបន្ថែម",

  // ── Expected and actual ──────────────────────────────────────────
  expectedActual: "ម៉ោងកំណត់ និងម៉ោងជាក់ស្តែង",
  colScan: "ការស្កេន",
  colExpected: "ម៉ោងកំណត់",
  colActual: "ម៉ោងជាក់ស្តែង",
  colResult: "លទ្ធផល",
  scanIn: "ចូល",
  scanOut: "ចេញ",
  slot: {
    ok: "ទាន់ម៉ោង",
    late: "មកយឺត",
    early: "មុនម៉ោង",
    missing: "ខកខានស្កេន",
    pending: "មិនទាន់ដល់ពេល",
  },

  // ── Adjustments ──────────────────────────────────────────────────
  adjustedByAdmin: "បានកែសម្រួលដោយអ្នកគ្រប់គ្រង",
  deletedUser: "អ្នកប្រើប្រាស់ដែលបានលុប",
  adjustReason: "មូលហេតុ៖ {reason}",

  // ── Scans list ───────────────────────────────────────────────────
  automatic: "វត្តមាននេះត្រូវបានកត់ត្រាដោយស្វ័យប្រវត្តិតាមកាលវិភាគការងារ។ បុគ្គលិកនេះមិនចាំបាច់ស្កេនទេ។",
  scans: "ការស្កេន ({n})",
  scanTitle: "{n}. {role} ម៉ោង {time}",
  noScans: "មិនមានការស្កេននៅថ្ងៃនេះទេ។",
  noLocation: "គ្មានទីតាំង",
  noLocationHint: "ការស្កេននេះមិនបានភ្ជាប់ទីតាំងទូរស័ព្ទមកជាមួយទេ ដូច្នេះមិនអាចផ្ទៀងផ្ទាត់ជាមួយទីតាំងសាខាបានទេ។",
  method: {
    qr: "ស្កេន QR",
    gps: "GPS",
    correction: "ការកែតម្រូវដែលបានអនុម័ត",
    adjustment: "កែសម្រួលដោយអ្នកគ្រប់គ្រង",
    auto: "ស្វ័យប្រវត្តិ",
    none: "មិនបានផ្ទៀងផ្ទាត់",
  },
  location: "ទីតាំង",
  distance: "ចម្ងាយ",
  distanceValue: "{m} ម៉ែត្រ ពីទីតាំង",
  noGpsToCompare: "គ្មាន GPS សម្រាប់ផ្ទៀងផ្ទាត់",
  recordedBy: "កត់ត្រាដោយ",
  phoneWas: "ទីតាំងទូរស័ព្ទរបស់បុគ្គលិក",
  noPhoneGps: "{location} (ទូរស័ព្ទមិនបានផ្ញើ GPS)",
  openInMaps: "បើកក្នុង Google Maps",

  // ── Deleting a day ───────────────────────────────────────────────
  deleteTitle: "តើលោកអ្នកចង់លុបវត្តមានសម្រាប់ថ្ងៃនេះមែនទេ?",
  deleteTitleNamed: "តើលោកអ្នកចង់លុបវត្តមានរបស់ {name} សម្រាប់ថ្ងៃនេះមែនទេ?",
  deleteWarning:
    "ការស្កេន ការកែតម្រូវ និងការកែសម្រួលទាំងអស់សម្រាប់ថ្ងៃនេះ នឹងត្រូវលុបជាអចិន្ត្រៃយ៍។ ថ្ងៃធ្វើការដែលកន្លងផុតទៅ នឹងបង្ហាញជាអវត្តមាន។ សូមប្រើមុខងារនេះសម្រាប់សម្អាតទិន្នន័យសាកល្បងប៉ុណ្ណោះ។ ដើម្បីកែតម្រូវកំណត់ត្រាពិតប្រាកដ សូមប្រើ «កែសម្រួលការស្កេន»។",
  deleted: "បានលុបវត្តមាន",
};
