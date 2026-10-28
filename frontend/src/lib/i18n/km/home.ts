import type { Dictionary } from "../en";

// ទំព័រដើម — Phone home screen. Same keys as en/home.ts.

export const home: Dictionary["home"] = {
  // ── Header greeting ───────────────────────────────────────────────
  greeting: {
    morning: "អរុណសួស្តី",
    afternoon: "ទិវាសួស្តី",
    evening: "សាយ័ណ្ហសួស្តី",
  },

  // ── Menu sections ─────────────────────────────────────────────────
  menu: {
    services: "សេវាកម្ម",
    more: "ផ្សេងៗ",
    resetOrder: "កំណត់លំដាប់ឡើងវិញ",
    language: "ភាសា",
  },

  // ── "Today" card — the signed-in employee's own scans ─────────────
  today: {
    badge: "ថ្ងៃនេះ",
    checkedIn: "បានចូលធ្វើការ",
    checkedOut: "បានចេញពីការងារ",
    notCheckedIn: "មិនទាន់ស្កេនចូល",
    noWork: "មិនមានកាលវិភាគការងារ",
    auto: "កត់ត្រាដោយស្វ័យប្រវត្តិ",
    next: "បន្ទាប់៖ ស្កេន{slot} ម៉ោង {time}",
    allDone: "បានស្កេនគ្រប់ចំនួនសម្រាប់ថ្ងៃនេះ",
    scansDone: "បានស្កេន {done}/{total} ដង",
    worked: "ម៉ោងធ្វើការ៖ {time}",
    in: "ចូល",
    out: "ចេញ",
    scanAttendance: "ស្កេនវត្តមាន",
    request: "សំណើ",
    correction: "ការកែតម្រូវ",
  },

  // ── "Team today" card — for managers ──────────────────────────────
  team: {
    badge: "ក្រុមការងារថ្ងៃនេះ",
    checkedIn: "នាក់បានចូលធ្វើការ",
    late: "មកយឺត",
    corrections: "ការកែតម្រូវ",
    overtime: "ម៉ោងបន្ថែម",
  },

  // ── Scan banner ───────────────────────────────────────────────────
  scanBanner: {
    title: "ស្កេនរហ័ស",
    body: "សូមបើកកាមេរ៉ា ហើយស្កេនចូលធ្វើការបានភ្លាមៗ។",
    cta: "បើកកាមេរ៉ាស្កេន",
  },
};
