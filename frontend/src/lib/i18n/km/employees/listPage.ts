import type { Dictionary } from "../../en";

// ទំព័របុគ្គលិក (app/dashboard/employees/page.tsx) — same keys as en/employees/listPage.ts.

export const listPage: Dictionary["employees"]["listPage"] = {
  // ── Header & tabs ────────────────────────────────────────────────
  title: "បុគ្គលិក",
  descriptionPeople: "កំណត់ត្រា រូបថត និងព័ត៌មានលម្អិតរបស់បុគ្គលិក។",
  descriptionRoster: "បុគ្គលិកណាធ្វើការវេនណា និងនៅពេលណា។",
  descriptionOwnShifts: "វេនការងាររបស់លោកអ្នក។",
  tabPeople: "បុគ្គលិក",
  tabRoster: "តារាងវេនការងារ",

  // ── Notices ──────────────────────────────────────────────────────
  tooMany: "លោកអ្នកមានបុគ្គលិក {total} នាក់ ប៉ុន្តែបង្ហាញតែ {shown} នាក់ដំបូងប៉ុណ្ណោះ។ សូមចម្រាញ់តាមសាខា ឬនាយកដ្ឋាន ដើម្បីបង្រួមបញ្ជី។",

  // ── Table ────────────────────────────────────────────────────────
  colLogin: "គណនីចូលប្រព័ន្ធ",
  sortNoLoginFirst: "គ្មានគណនីមុន",
  sortHasLoginFirst: "មានគណនីមុន",
  noLoginYet: "មិនទាន់មានគណនីចូលប្រព័ន្ធ",
  search: "ស្វែងរកតាមឈ្មោះ អត្តលេខ អ៊ីមែល លេខទូរស័ព្ទ សាខា ឬមុខតំណែង…",
  deleteN: "លុប {n}",
  emptyHint: "សូមបន្ថែមបុគ្គលិកដំបូង ដើម្បីចាប់ផ្តើមបង្កើតបញ្ជីបុគ្គលិករបស់លោកអ្នក។",

  // ── Delete ───────────────────────────────────────────────────────
  deleteManyTitle: "លុបបុគ្គលិក {n} នាក់?",
  deletedOne: "បានលុបបុគ្គលិក 1 នាក់",
  deletedOther: "បានលុបបុគ្គលិក {n} នាក់",
};
