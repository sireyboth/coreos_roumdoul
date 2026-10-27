import type { Dictionary } from "../../en";

// Users page (app/dashboard/users/page.tsx) — same keys as en/access/usersPage.ts.

export const usersPage: Dictionary["access"]["usersPage"] = {
  // ── Header ───────────────────────────────────────────────────────
  title: "អ្នកប្រើប្រាស់",
  manageRoles: "គ្រប់គ្រងតួនាទី និងសិទ្ធិ →",
  invite: "អញ្ជើញអ្នកប្រើប្រាស់",

  // ── Invite dialog ────────────────────────────────────────────────
  inviteTitle: "អញ្ជើញសហការី",
  inviteDescription: "បង្កើតគណនីចូលប្រព័ន្ធ និងកំណត់តួនាទីឱ្យសហការី។",
  tempPassword: "ពាក្យសម្ងាត់បណ្តោះអាសន្ន",
  role: "តួនាទី",
  inviting: "កំពុងអញ្ជើញ…",
  inviteButton: "អញ្ជើញ",
  invited: "បានអញ្ជើញសហការី",
  invitedHint: "{email} អាចចូលប្រព័ន្ធបានហើយ។",

  // ── Table ────────────────────────────────────────────────────────
  you: "(លោកអ្នក)",
  colLogin: "អ៊ីមែល / អត្តលេខ",
  signsInById: "ចូលប្រព័ន្ធដោយប្រើអត្តលេខបុគ្គលិក",
  idPrefix: "អត្តលេខ៖ {id}",
  noRole: "គ្មានតួនាទី",
  deactivated: "បានបិទដំណើរការ",
  sortDeactivatedFirst: "បានបិទដំណើរការមុន",
  sortActiveFirst: "សកម្មមុន",
  colBranches: "សិទ្ធិមើលសាខា",
  allBranches: "គ្រប់សាខា",
  search: "ស្វែងរកតាមឈ្មោះ អ៊ីមែល ឬអត្តលេខ…",
  empty: "មិនទាន់មានអ្នកប្រើប្រាស់",
  emptyHint: "សូមអញ្ជើញសហការីដំបូងរបស់លោកអ្នក ដើម្បីផ្តល់សិទ្ធិចូលប្រើប្រាស់។",
  branchAccess: "សិទ្ធិមើលសាខា",
  deactivate: "បិទដំណើរការ",
  activate: "បើកដំណើរការ",

  // ── Messages ─────────────────────────────────────────────────────
  roleChanged: "{name} ឥឡូវមានតួនាទីជា {role}",
  deactivatedToast: "បានបិទដំណើរការ {name}",
  reactivatedToast: "បានបើកដំណើរការ {name} ឡើងវិញ",
  removeTitle: "លុប {name}?",
  removeDescription: "អ្នកប្រើប្រាស់នេះនឹងបាត់បង់សិទ្ធិចូលប្រើភ្លាមៗ។ សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។",
  removed: "បានលុប {name}",

  // ── Branch access dialog ─────────────────────────────────────────
  branchTitle: "សិទ្ធិមើលសាខារបស់ {name}",
  branchDescription: "សូមទុកឱ្យនៅទទេទាំងអស់ ដើម្បីផ្តល់សិទ្ធិមើលគ្រប់សាខា។ សូមធីកសាខាជាក់លាក់ ដើម្បីកំណត់ឱ្យមើលបានតែសាខាទាំងនោះ។",
  saving: "កំពុងរក្សាទុក…",
  branchSaved: "បានកែប្រែសិទ្ធិមើលសាខា",
  branchSavedSome: "{name} អាចមើលបានតែសាខាដែលបានជ្រើសរើស។",
  branchSavedAll: "{name} អាចមើលបានគ្រប់សាខា។",
};
