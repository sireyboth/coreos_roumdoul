import type { Dictionary } from "../../en";

// Missed scans dialog (components/dashboard/missed-scans-dialog.tsx) — same keys as en/attendance/missedScans.ts.
// IN/OUT slot names come from attendance.fillMissed (slotIn / slotOut).

export const missedScans: Dictionary["attendance"]["missedScans"] = {
  // ── Header ────────────────────────────────────────────────────────
  title: "ការស្កេនដែលខកខាន",
  description: "ថ្ងៃដែលបុគ្គលិកបានធ្វើការ ប៉ុន្តែមិនបានស្កេន។ សូមពិនិត្យម៉ោង រួចរក្សាទុកដើម្បីបំពេញកំណត់ត្រារបស់បុគ្គលិក។",

  // ── Employee, month & reason ──────────────────────────────────────
  allEmployees: "បុគ្គលិកទាំងអស់",
  reasonPlaceholder: "ឧ. ម៉ាស៊ីនស្កេនមិនដំណើរការ / ធ្វើការនៅទីតាំងអតិថិជន",
  reasonMissing: "សូមបញ្ចូលមូលហេតុ។ មូលហេតុនឹងត្រូវរក្សាទុកនៅលើថ្ងៃនីមួយៗ និងបង្ហាញក្នុងឯកសារនាំចេញ។",
  reasonHint: "រក្សាទុកនៅលើថ្ងៃនីមួយៗដែលលោកអ្នករក្សាទុក និងបង្ហាញក្នុងឯកសារនាំចេញវត្តមាន។",

  // ── Days list ─────────────────────────────────────────────────────
  noneTitle: "មិនមានការស្កេនខកខានទេ",
  noneHint: "បុគ្គលិកទាំងអស់បានស្កេនចូល និងស្កេនចេញគ្រប់ចំនួនក្នុង {month}។",
  noScans: "គ្មានការស្កេន",
  missingScan: "ខកខានស្កេន",
  slotTime: "ម៉ោង {slot}",

  // ── Footer ────────────────────────────────────────────────────────
  footerHint: "ម៉ោងពណ៌ប្រផេះគឺជាការស្កេនពិត ហើយនឹងរក្សាទុកដដែល។ ម៉ោងដែលលោកអ្នកមិនបានកែប្រែ នឹងប្រើតាមកាលវិភាគ។",
  saveAll: "រក្សាទុកទាំងអស់",
  saveAllCount: "រក្សាទុកទាំងអស់ ({n})",
  savedOne: "បានរក្សាទុកការស្កេនដែលខកខានលើ {n} ថ្ងៃ",
  savedOther: "បានរក្សាទុកការស្កេនដែលខកខានលើ {n} ថ្ងៃ",
};
