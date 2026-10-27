import type { Dictionary } from "../../en";

// Shared by the Leave & requests screens and lib/requests.ts — same keys as en/leave/shared.ts.

export const shared: Dictionary["leave"]["shared"] = {
  // ── Request status (REQUEST_STATUS in lib/requests.ts) ────────────
  status: {
    pending: "កំពុងរង់ចាំ",
    approved: "បានអនុម័ត",
    rejected: "បានបដិសេធ",
    cancelled: "បានលុបចោល",
  },

  // ── Part of the day ───────────────────────────────────────────────
  dayPart: {
    full: "ពេញមួយថ្ងៃ",
    am: "ពេលព្រឹក",
    pm: "ពេលរសៀល",
  },

  // ── Late / early request kinds ────────────────────────────────────
  kind: {
    late: "មកយឺត",
    early: "ចេញមុនម៉ោង",
  },
  lateEarly: "មកយឺត / ចេញមុនម៉ោង",

  // ── Dates & amounts ───────────────────────────────────────────────
  halfDay: "{date} ({part})",
  dayOne: "{n} ថ្ងៃ",
  dayOther: "{n} ថ្ងៃ",
  andMore: "{list} និង {n} ថ្ងៃទៀត",
  inAt: "ចូលម៉ោង {time} · {minutes} នាទី",
  outAt: "ចេញម៉ោង {time} · {minutes} នាទី",

  // ── Pay ───────────────────────────────────────────────────────────
  paid: "មានប្រាក់ឈ្នួល",
  unpaid: "គ្មានប្រាក់ឈ្នួល",
  payPercent: "ប្រាក់ឈ្នួល {percent}%",
  unpaidTag: " (គ្មានប្រាក់ឈ្នួល)",
  payTag: " (ប្រាក់ឈ្នួល {percent}%)",

  // ── Request forms ─────────────────────────────────────────────────
  for: "សម្រាប់",
  myself: "ខ្លួនខ្ញុំ",
  choosePerson: "សូមជ្រើសរើសបុគ្គលិក",
  chooseFile: "សូមជ្រើសរើសឯកសារ ឬថតរូប",
  documentOptional: "ឯកសារភ្ជាប់ (ស្រេចចិត្ត)",
  cantSendYet: "មិនទាន់អាចដាក់ស្នើបានទេ",
  approveNow: "អនុម័តភ្លាមៗ",
  sending: "កំពុងដាក់ស្នើ…",
  sendRequest: "ដាក់ស្នើសំណើ",
  willReview: "{name} នឹងពិនិត្យសំណើនេះ។",
  approverWillReview: "អ្នកអនុម័តនឹងពិនិត្យសំណើនេះ។",
  remarkToEmployee: "កំណត់សម្គាល់ជូនបុគ្គលិក",

  // ── Deleting requests ─────────────────────────────────────────────
  deleteOne: "លុបសំណើ {label} នេះឬ?",
  deleteWarning:
    "សំណើ ឯកសារភ្ជាប់ និងការជូនដំណឹងរបស់វានឹងត្រូវលុបជាស្ថាពរ។ ច្បាប់ឈប់សម្រាកដែលបានអនុម័តនឹងត្រូវបញ្ចូលទៅថ្ងៃច្បាប់នៅសល់វិញ ហើយវត្តមាននឹងត្រូវគណនាឡើងវិញ។ សូមប្រើមុខងារនេះសម្រាប់លុបទិន្នន័យសាកល្បងប៉ុណ្ណោះ។ ដើម្បីដកសំណើពិតប្រាកដ សូមលុបចោលសំណើនោះ ដើម្បីរក្សាប្រវត្តិទុក។",
};
