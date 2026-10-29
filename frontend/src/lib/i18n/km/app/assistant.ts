import type { Dictionary } from "../../en";

// Help assistant chat (components/dashboard/layout/ai-assistant.tsx) — same keys as en/app/assistant.ts.

export const assistant: Dictionary["app"]["assistant"] = {
  // ── Button & header ───────────────────────────────────────────────
  open: "បើកជំនួយការ",
  button: "ជំនួយ",
  title: "ជំនួយការ",
  subtitle: "សួរពីរបៀបប្រើប្រាស់ CoreOS ជាភាសាខ្មែរ ឬភាសាអង់គ្លេស។",

  // ── Suggested questions ───────────────────────────────────────────
  tryThese: "សូមសាកល្បងសំណួរណាមួយខាងក្រោម៖",
  suggestion1: "តើខ្ញុំបិទបញ្ជីប្រចាំខែដោយរបៀបណា?",
  suggestion2: "តើខ្ញុំស្នើសុំច្បាប់ឈប់សម្រាកដោយរបៀបណា?",
  // Kept in Khmer on purpose: shows English speakers that Khmer questions work too.
  suggestion3: "តើខ្ញុំស្កេនវត្តមានដោយរបៀបណា?",

  // ── Chat ──────────────────────────────────────────────────────────
  thinking: "កំពុងគិត",
  unavailable: "ជំនួយការមិនអាចប្រើបាននៅពេលនេះទេ។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេលពីរបីនាទីទៀត។",
  limitReached: "ការសន្ទនានេះបានដល់ {n} សំណួរហើយ។ សូមចាប់ផ្តើមការសន្ទនាថ្មី ដើម្បីសួរបន្ថែម។",
  newChat: "ចាប់ផ្តើមការសន្ទនាថ្មី",
  placeholder: "សូមសរសេរសំណួរ",
  yourQuestion: "សំណួររបស់លោកអ្នក",
  count: "{n} ក្នុងចំណោម {max} សំណួរ",
};
