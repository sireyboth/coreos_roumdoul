import type { Dictionary } from "../../en";

// Profile page (app/dashboard/profile/page.tsx) — same keys as en/access/profilePage.ts.

export const profilePage: Dictionary["access"]["profilePage"] = {
  // ── Header ───────────────────────────────────────────────────────
  title: "ប្រវត្តិរូប",
  roleAt: "{roles} នៅ {company}",
  noRole: "គ្មានតួនាទី",

  // ── Account details ──────────────────────────────────────────────
  accountTitle: "ព័ត៌មានគណនី",
  accountHintId: "ឈ្មោះ និងអ៊ីមែលរបស់លោកអ្នក (ស្រេចចិត្ត)",
  accountHint: "ឈ្មោះ និងអ៊ីមែលរបស់លោកអ្នក",
  emailOptional: "អ៊ីមែល (ស្រេចចិត្ត)",
  nickname: "ឈ្មោះហៅក្រៅ (ស្រេចចិត្ត)",
  nicknameHint: "ឈ្មោះដែលមិត្តរួមការងារហៅលោកអ្នក។",
  signsInWithId: "លោកអ្នកចូលប្រព័ន្ធដោយប្រើអត្តលេខបុគ្គលិក {id}។ អ៊ីមែលនៅទីនេះជាជម្រើសស្រេចចិត្ត ហើយមិនប្តូររបៀបចូលប្រព័ន្ធនោះទេ។",
  currentPassword: "ពាក្យសម្ងាត់បច្ចុប្បន្ន",
  emailPasswordHint: "ត្រូវការ ដើម្បីប្តូរអ៊ីមែលដែលលោកអ្នកប្រើចូលប្រព័ន្ធ។",
  updated: "បានកែប្រែប្រវត្តិរូប",

  // ── Change password ──────────────────────────────────────────────
  passwordTitle: "ប្តូរពាក្យសម្ងាត់",
  passwordHint: "ត្រូវការពាក្យសម្ងាត់បច្ចុប្បន្នរបស់លោកអ្នក",
  newPassword: "ពាក្យសម្ងាត់ថ្មី",
  confirmPassword: "បញ្ជាក់ពាក្យសម្ងាត់ថ្មី",
  passwordUpdated: "បានប្តូរពាក្យសម្ងាត់",
  updating: "កំពុងប្តូរ…",
  updatePassword: "ប្តូរពាក្យសម្ងាត់",
  passwordChanged: "បានប្តូរពាក្យសម្ងាត់",
};
