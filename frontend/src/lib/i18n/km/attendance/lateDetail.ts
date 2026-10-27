import type { Dictionary } from "../../en";

// Late / early / missed detail (components/dashboard/attendance-late-detail.tsx) — same keys as en/attendance/lateDetail.ts.

export const lateDetail: Dictionary["attendance"]["lateDetail"] = {
  // ── Toolbar ───────────────────────────────────────────────────────
  toolbar: {
    show: "បង្ហាញ",
    lateFrom: "មកយឺត ≥",
    min: "នាទី",
    lateFromAria: "គិតការមកយឺតចាប់ពីចំនួននាទីនេះ",
    sortBy: "តម្រៀបតាម",
    excel: "Excel",
    pdf: "PDF",
  },
  sort: {
    lateDays: "ចំនួនថ្ងៃមកយឺត",
    lateMinutes: "រយៈពេលមកយឺតសរុប",
    latePct: "% មកយឺត",
    bradford: "ពិន្ទុ Bradford",
    name: "ឈ្មោះ",
  },

  // ── Heading ───────────────────────────────────────────────────────
  heading: {
    title: "ព័ត៌មានលម្អិតវត្តមាន · {period}",
    nothingSelected: "មិនបានជ្រើសរើស",
    lateFilter: "មកយឺត ≥ {n} នាទី",
    personOne: "{n} នាក់",
    personMany: "{n} នាក់",
    pickOne: "សូមជ្រើសរើសយ៉ាងហោចណាស់មួយ ដើម្បីបង្ហាញ។",
    clean: "មិនមានបុគ្គលិកណាម្នាក់ត្រូវនឹងលក្ខខណ្ឌទេ — កំណត់ត្រាល្អសម្រាប់រយៈពេលនេះ។",
  },

  // ── Overview table ────────────────────────────────────────────────
  overview: {
    workDays: "ថ្ងៃធ្វើការ",
    lateDays: "ថ្ងៃមកយឺត",
    latePct: "% មកយឺត",
    totalLate: "មកយឺតសរុប",
    avg: "មធ្យម",
    longest: "យូរបំផុត",
    early: "ចេញមុន",
    missed: "ខកខានស្កេន",
    absent: "អវត្តមាន",
    absencePct: "% អវត្តមាន",
    bradford: "Bradford",
    bradfordHint: "ចំនួនដងនៃអវត្តមានដាច់ដោយឡែក² × ចំនួនថ្ងៃអវត្តមាន។ អវត្តមានខ្លីៗច្រើនដង ទទួលបានពិន្ទុខ្ពស់ជាងអវត្តមានវែងតែម្តង — ជាមូលដ្ឋានសម្រាប់ការពិភាក្សា មិនមែនជាការសម្រេចចុងក្រោយទេ។",
    pattern: "លំនាំ",
    mostly: "ភាគច្រើនថ្ងៃ{day} ({n} ដង)",
  },

  // Weekday names for the pattern
  weekday: {
    sun: "អាទិត្យ",
    mon: "ច័ន្ទ",
    tue: "អង្គារ",
    wed: "ពុធ",
    thu: "ព្រហស្បតិ៍",
    fri: "សុក្រ",
    sat: "សៅរ៍",
  },

  // ── One person's section ──────────────────────────────────────────
  person: {
    workDays: "ធ្វើការ {n} ថ្ងៃ",
    late: "មកយឺត {n} ថ្ងៃ ({pct}%) · {total} · មធ្យម {avg}",
    neverLate: "មិនដែលមកយឺត",
    missedOne: "ខកខានស្កេន {n} ថ្ងៃ",
    missedMany: "ខកខានស្កេន {n} ថ្ងៃ",
    absent: "អវត្តមាន {n} ថ្ងៃ",
    leave: "ច្បាប់ឈប់សម្រាក {n} ថ្ងៃ",
  },

  // ── Day table ─────────────────────────────────────────────────────
  day: {
    schedule: "កាលវិភាគ",
    in: "ចូល",
    out: "ចេញ",
    late: "មកយឺត",
    issue: "បញ្ហា",
    note: "កំណត់សម្គាល់",
    edited: "ការស្កេនត្រូវបានបន្ថែម ឬកែប្រែ",
    early: "ចេញមុន {time}",
    monthLate: "មកយឺត {n} ថ្ងៃ · {time}",
    monthMissed: "ខកខានស្កេន {n} ថ្ងៃ",
    monthAbsent: "អវត្តមាន {n} ថ្ងៃ",
  },
};
