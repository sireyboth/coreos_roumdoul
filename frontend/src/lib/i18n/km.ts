import type { Dictionary } from "./en";

// Khmer strings — same keys as en.ts (a missing or extra key fails the build).

export const km: Dictionary = {
  common: {
    home: "ទំព័រដើម",
    scan: "ស្កេន",
    loadFailed: "មិនអាចផ្ទុកទិន្នន័យបានទេ",
  },
  greeting: {
    morning: "អរុណសួស្តី",
    afternoon: "ទិវាសួស្តី",
    evening: "សាយ័ណ្ហសួស្តី",
  },
  home: {
    services: "សេវាកម្ម",
    more: "ផ្សេងៗ",
    language: "ភាសា",
  },
  today: {
    badge: "ថ្ងៃនេះ",
    checkedIn: "បានចូលធ្វើការ",
    checkedOut: "បានចេញពីការងារ",
    notCheckedIn: "មិនទាន់ស្កេនចូល",
    noWork: "គ្មានកាលវិភាគការងារ",
    auto: "កត់ត្រាដោយស្វ័យប្រវត្តិ",
    next: "បន្ទាប់៖ ស្កេន{slot} ម៉ោង {time}",
    allDone: "បានស្កេនគ្រប់សម្រាប់ថ្ងៃនេះ",
    scansDone: "បានស្កេន {done}/{total}",
    worked: "ម៉ោងធ្វើការ {time}",
    in: "ចូល",
    out: "ចេញ",
    scanAttendance: "ស្កេនវត្តមាន",
    request: "ស្នើសុំ",
    correction: "កែតម្រូវ",
  },
  team: {
    badge: "ក្រុមការងារថ្ងៃនេះ",
    checkedIn: "នាក់បានចូលធ្វើការ",
    late: "យឺត",
    corrections: "កែតម្រូវ",
    overtime: "ថែមម៉ោង",
  },
  scanBanner: {
    title: "ស្កេនរហ័ស",
    body: "បើកកាមេរ៉ា ហើយស្កេនចូលធ្វើការភ្លាមៗ។",
    cta: "បើកកាមេរ៉ា",
  },
  nav: {
    "/dashboard": "ទិដ្ឋភាពទូទៅ",
    "/dashboard/home": "ទំព័រដើម",
    "/dashboard/attendance": "វត្តមាន",
    "/dashboard/requests": "ច្បាប់ឈប់",
    "/dashboard/payroll": "ប្រាក់ខែ",
    "/dashboard/calendar": "ប្រតិទិន",
    "/dashboard/work-schedules": "កាលវិភាគ",
    "/dashboard/employees": "បុគ្គលិក",
    "/dashboard/id-cards": "កាតបុគ្គលិក",
    "/dashboard/profile": "គណនី",
    "/dashboard/holidays": "ថ្ងៃឈប់សម្រាក",
    "/dashboard/branches": "សាខា",
    "/dashboard/teams": "ក្រុម",
    "/dashboard/attendance/corrections": "កែតម្រូវវត្តមាន",
    "/dashboard/audit": "កំណត់ហេតុសកម្មភាព",
  },
};
