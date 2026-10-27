import type { Dictionary } from "../../en";

// Corrections tab (components/dashboard/attendance-corrections.tsx) — same keys as en/attendance/corrections.ts.

export const corrections: Dictionary["attendance"]["corrections"] = {
  // ── Toolbar ──────────────────────────────────────────────────────
  request: "ស្នើសុំកែតម្រូវ",

  // ── New request form ─────────────────────────────────────────────
  formTitle: "ស្នើសុំកែតម្រូវវត្តមាន",
  formDescription: "សំណើនេះត្រូវការការអនុម័តពីប្រធានរបស់លោកអ្នក។",
  missedScans: "ការស្កេនដែលបានខកខាន",
  missedScansHint: "សូមបញ្ចូលតែការស្កេនដែលភ្លេចប៉ុណ្ណោះ ឧ. បញ្ចូលតែ 12:00 ប្រសិនបើមិនបានស្កេនចេញពេលសម្រាកអាហារថ្ងៃត្រង់។ កាលវិភាគការងាររបស់លោកអ្នកជាអ្នកកំណត់ថា ការស្កេននីមួយៗជាការស្កេនចូល ឬស្កេនចេញ។",
  scanN: "ការស្កេនទី {n}",
  removeTime: "លុបម៉ោងនេះ",
  addTime: "បន្ថែមម៉ោងផ្សេងទៀត",
  submitting: "កំពុងដាក់ស្នើ…",
  submit: "ដាក់ស្នើសំណើ",
  requested: "បានដាក់ស្នើការកែតម្រូវ",
  requestedHint: "ប្រធានរបស់លោកអ្នកនឹងពិនិត្យសំណើនេះ។",

  // ── Table ────────────────────────────────────────────────────────
  colScans: "ការស្កេនត្រូវបន្ថែម",
  sortEarliest: "ពីម៉ោងដំបូងទៅចុងក្រោយ",
  sortLatest: "ពីម៉ោងចុងក្រោយទៅដំបូង",
  reviewedBy: "ដោយ {name}",
  searchManager: "ស្វែងរកតាមបុគ្គលិក ឬមូលហេតុ…",
  searchOwn: "ស្វែងរកតាមមូលហេតុ…",
  empty: "មិនមានសំណើកែតម្រូវវត្តមានទេ",
  emptyHint: "មិនមានអ្វីត្រូវពិនិត្យនៅពេលនេះទេ។",
  review: "ពិនិត្យ",
  open: "បើក",

  // ── Review dialog ────────────────────────────────────────────────
  title: "ការកែតម្រូវវត្តមាន",
  add: "បន្ថែម៖",
  decidedBy: "{status} ដោយ {name}",
  remark: "កំណត់សម្គាល់ជូនបុគ្គលិក",
  reasonOptional: "មូលហេតុ (ស្រេចចិត្ត)",
  remarkPlaceholder: "ស្រេចចិត្តពេលអនុម័ត តែចាំបាច់ពេលបដិសេធ",
  remarkMissing: "សូមបញ្ចូលកំណត់សម្គាល់។ បុគ្គលិកនឹងឃើញកំណត់សម្គាល់នេះ។",
  cancelRequest: "លុបចោលសំណើ",
  approved: "បានអនុម័តការកែតម្រូវ",
  approvedHint: "ការស្កេនត្រូវបានបន្ថែម ហើយថ្ងៃនេះត្រូវបានគណនាឡើងវិញ។",
  rejected: "បានបដិសេធការកែតម្រូវ",
  cancelled: "បានលុបចោលការកែតម្រូវ",
};
