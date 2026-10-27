import type { Dictionary } from "../../en";

// Overview dashboard (app/dashboard/page.tsx) — same keys as en/app/dashboard.ts.

export const dashboard: Dictionary["app"]["dashboard"] = {
  // ── Hero ──────────────────────────────────────────────────────────
  hero: {
    checkInOut: "ស្កេនចូល / ស្កេនចេញ",
  },

  // ── Headline numbers ──────────────────────────────────────────────
  kpi: {
    checkedIn: "បានចូលធ្វើការថ្ងៃនេះ",
    checkedInHint: "បុគ្គលិកដែលបានស្កេនថ្ងៃនេះ",
    employees: "បុគ្គលិក",
    employeesHint: "ក្នុងក្រុមការងាររបស់លោកអ្នក",
    branches: "សាខា",
    branchesHint: "ទីតាំងសកម្ម",
    corrections: "ការកែតម្រូវវត្តមានកំពុងរង់ចាំ",
    correctionsHint: "កំពុងរង់ចាំការពិនិត្យ",
    overtime: "ម៉ោងបន្ថែមត្រូវពិនិត្យ",
    overtimeHint: "កំពុងរង់ចាំការអនុម័ត",
    modules: "មុខងារសកម្ម",
    modulesHint: "មាននៅក្នុងគម្រោងសេវាកម្មរបស់លោកអ្នក",
  },

  // ── Attendance this week ──────────────────────────────────────────
  week: {
    title: "វត្តមានសប្តាហ៍នេះ",
    description: "ការស្កេនចូលដែលបានកត់ត្រាក្នុងរយៈពេល 7 ថ្ងៃចុងក្រោយ",
    total: "ចំនួនសរុប",
  },

  // ── Recent check-ins ──────────────────────────────────────────────
  recent: {
    title: "ការស្កេនចូលថ្មីៗ",
    description: "សកម្មភាពវត្តមានចុងក្រោយ",
    viewAll: "មើលទាំងអស់",
    empty: "មិនទាន់មានវត្តមានត្រូវបានកត់ត្រានៅឡើយទេ។",
    late: "មកយឺត {n} នាទី",
  },

  // ── Quick access & quick actions ──────────────────────────────────
  quick: {
    accessTitle: "ចូលប្រើរហ័ស",
    accessDescription: "ទៅកាន់អ្វីដែលលោកអ្នកគ្រប់គ្រងភ្លាមៗ",
    actionsTitle: "សកម្មភាពរហ័ស",
    actionsDescription: "ផ្លូវកាត់ទៅកាន់កន្លែងធ្វើការរបស់លោកអ្នក",
  },

  // ── Modules in the plan ───────────────────────────────────────────
  modules: {
    title: "មុខងារ",
    description: "មុខងារដែលគម្រោងសេវាកម្មរបស់លោកអ្នកផ្តល់ជូនបច្ចុប្បន្ន",
    on: "បើក",
    off: "បិទ",
  },

  // ── Module names by code — t(`app.dashboard.module.${code}`) ──────
  module: {
    attendance: "វត្តមាន",
    hr: "ធនធានមនុស្ស",
    payroll: "ប្រាក់បៀវត្សរ៍",
    pos: "ប្រព័ន្ធលក់ (POS)",
    inventory: "ស្តុកទំនិញ",
    crm: "ទំនាក់ទំនងអតិថិជន (CRM)",
    accounting: "គណនេយ្យ",
    id_cards: "កាតសម្គាល់បុគ្គលិក",
    birthdays: "ខួបកំណើត",
    ai_assistant: "ជំនួយការ",
  },
};
