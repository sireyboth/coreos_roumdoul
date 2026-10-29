import type { Dictionary } from "../../en";

// Ask to turn on notifications (components/dashboard/layout/push-prompt.tsx) — same keys as en/app/pushPrompt.ts.

export const pushPrompt: Dictionary["app"]["pushPrompt"] = {
  // ── iPhone in Safari: add to Home Screen first ────────────────────
  iphone: {
    title: "ទទួលការជូនដំណឹងលើ iPhone របស់លោកអ្នក",
    description: "iPhone ផ្ញើការជូនដំណឹងតែទៅកាន់កម្មវិធីដែលនៅលើអេក្រង់ដើម (Home Screen) ប៉ុណ្ណោះ។ សូមបន្ថែមម្តង៖",
    step1Before: "សូមចុចប៊ូតុង Share",
    step1After: "នៅផ្នែកខាងក្រោមនៃ Safari។",
    // "Choose Add to Home Screen, then Add." — the two iPhone button names stay in bold.
    step2Before: "សូមជ្រើសរើស",
    step2Middle: " រួចចុច",
    step2After: "។",
    step3: "សូមបើកកម្មវិធីពីរូបតំណាងថ្មីនៅលើអេក្រង់ដើម។",
    gotIt: "យល់ហើយ",
  },

  // ── Turn on ───────────────────────────────────────────────────────
  ask: {
    title: "បើកការជូនដំណឹង?",
    description: "ទទួលការជូនដំណឹងអំពីវត្តមាន ការអនុម័ត និងព័ត៌មានថ្មីៗផ្សេងទៀតលើឧបករណ៍នេះ — ទោះបីកម្មវិធីត្រូវបានបិទក៏ដោយ។",
    notNow: "ពេលក្រោយ",
    allow: "អនុញ្ញាត",
    wait: "សូមរង់ចាំបន្តិច…",
  },

  // ── Result messages ───────────────────────────────────────────────
  result: {
    on: "ការជូនដំណឹងត្រូវបានបើកសម្រាប់ឧបករណ៍នេះ។",
    blocked: "ការជូនដំណឹងត្រូវបានរារាំង។ សូមបើកវាសម្រាប់គេហទំព័រនេះ នៅក្នុងការកំណត់ទូរស័ព្ទ ឬកម្មវិធីរុករករបស់លោកអ្នក។",
    failed: "មិនអាចបើកការជូនដំណឹងបានទេ។ សូមព្យាយាមម្តងទៀតពីរូបកណ្តឹង។",
  },
};
