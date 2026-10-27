import type { Dictionary } from "../../en";

// Members dialog for a department or team (components/dashboard/members-dialog.tsx) — same keys as en/org/members.ts.

export const members: Dictionary["org"]["members"] = {
  // ── Header ───────────────────────────────────────────────────────
  addTitle: "បន្ថែមបុគ្គលិកទៅ {name}",
  pickDepartment: "សូមជ្រើសរើសបុគ្គលិកដែលត្រូវបន្ថែមទៅនាយកដ្ឋាននេះ។",
  pickTeam: "សូមជ្រើសរើសបុគ្គលិកដែលត្រូវបន្ថែមទៅក្រុមនេះ។",
  countDepartmentOne: "បុគ្គលិក {n} នាក់ក្នុងនាយកដ្ឋាននេះ",
  countDepartmentOther: "បុគ្គលិក {n} នាក់ក្នុងនាយកដ្ឋាននេះ",
  countTeamOne: "បុគ្គលិក {n} នាក់ក្នុងក្រុមនេះ",
  countTeamOther: "បុគ្គលិក {n} នាក់ក្នុងក្រុមនេះ",

  // ── Search ───────────────────────────────────────────────────────
  search: "ស្វែងរកតាមឈ្មោះ អត្តលេខ ឬមុខតំណែង…",
  searchLabel: "ស្វែងរកបុគ្គលិក",
  noMatches: "គ្មានបុគ្គលិកដែលត្រូវនឹងការស្វែងរកទេ។",

  // ── Member list ──────────────────────────────────────────────────
  emptyDepartment: "មិនទាន់មានបុគ្គលិកក្នុងនាយកដ្ឋាននេះនៅឡើយទេ។",
  emptyTeam: "មិនទាន់មានបុគ្គលិកក្នុងក្រុមនេះនៅឡើយទេ។",
  remove: "ដកចេញ",
  removed: "បានដក {employee} ចេញពី {name}",

  // ── Adding people ────────────────────────────────────────────────
  allInDepartment: "បុគ្គលិកទាំងអស់ស្ថិតនៅក្នុងនាយកដ្ឋាននេះរួចហើយ។",
  allInTeam: "បុគ្គលិកទាំងអស់ស្ថិតនៅក្នុងក្រុមនេះរួចហើយ។",
  movesFrom: "ផ្ទេរពី {place}",
  addPeople: "បន្ថែមបុគ្គលិក",
  adding: "កំពុងបន្ថែម…",
  addOne: "បន្ថែមបុគ្គលិក 1 នាក់",
  addOther: "បន្ថែមបុគ្គលិក {n} នាក់",
  addedOne: "បានបន្ថែមបុគ្គលិក {n} នាក់ទៅ {name}",
  addedOther: "បានបន្ថែមបុគ្គលិក {n} នាក់ទៅ {name}",
};
