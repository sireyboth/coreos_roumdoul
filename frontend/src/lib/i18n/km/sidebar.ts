import type { Dictionary } from "../en";

// ម៉ឺនុយចំហៀង — Sidebar and the language switch. Same keys as en/sidebar.ts.

export const sidebar: Dictionary["sidebar"] = {
  // ── Menu groups ───────────────────────────────────────────────────
  group: {
    overview: "ទិដ្ឋភាពទូទៅ",
    time: "ពេលវេលា និងវត្តមាន",
    payroll: "ប្រាក់បៀវត្សរ៍",
    organization: "អង្គភាព",
    access: "សិទ្ធិចូលប្រើ",
  },

  // ── Menu items by URL — read with pageLabel(lang, href) ───────────
  items: {
    "/dashboard": "ផ្ទាំងគ្រប់គ្រង",
    "/dashboard/attendance": "វត្តមាន",
    "/dashboard/requests": "ច្បាប់ឈប់សម្រាក និងសំណើ",
    "/dashboard/calendar": "ប្រតិទិន",
    "/dashboard/work-schedules": "កាលវិភាគការងារ",
    "/dashboard/holidays": "ថ្ងៃឈប់សម្រាកសាធារណៈ",
    "/dashboard/leave-policy": "គោលការណ៍ច្បាប់ឈប់សម្រាក",
    "/dashboard/payroll": "ការបើកប្រាក់បៀវត្សរ៍",
    "/dashboard/payroll/adjustments": "ការកែសម្រួល",
    "/dashboard/payroll/settings": "ការកំណត់ប្រាក់បៀវត្សរ៍",
    "/dashboard/employees": "បុគ្គលិក",
    "/dashboard/departments": "នាយកដ្ឋាន",
    "/dashboard/teams": "ក្រុម",
    "/dashboard/branches": "សាខា",
    "/dashboard/work-locations": "ទីតាំងការងារ",
    "/dashboard/id-cards": "កាតសម្គាល់បុគ្គលិក",
    "/dashboard/birthdays": "ខួបកំណើត",
    "/dashboard/users": "អ្នកប្រើប្រាស់",
    "/dashboard/roles": "តួនាទី និងសិទ្ធិ",
    "/dashboard/audit": "កំណត់ហេតុសកម្មភាព",
    "/dashboard/attendance/corrections": "ការកែតម្រូវវត្តមាន",
    "/dashboard/profile": "ប្រវត្តិរូប",
  },

  // ── Modules list ──────────────────────────────────────────────────
  modules: "មុខងារ",
  module: {
    attendance: "វត្តមាន",
    hr: "ធនធានមនុស្ស",
    payroll: "ប្រាក់បៀវត្សរ៍",
    pos: "ប្រព័ន្ធលក់ (POS)",
    inventory: "ស្តុកទំនិញ",
    crm: "ទំនាក់ទំនងអតិថិជន (CRM)",
    accounting: "គណនេយ្យ",
  },

  // ── Account box ───────────────────────────────────────────────────
  workspace: "ក្រុមហ៊ុន",
  member: "សមាជិក",
  signOut: "ចាកចេញ",
  mainMenu: "ម៉ឺនុយមេ",

  // ── Language switch (components/language-toggle.tsx) ──────────────
  language: "ភាសា",
};
