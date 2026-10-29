import type { Dictionary } from "../../en";

// Shared calendar labels and the day dialog (components/dashboard/schedules/calendar-shared.tsx) — same keys as en/calendar/shared.ts.

export const shared: Dictionary["calendar"]["shared"] = {
  // ── Weekdays ──────────────────────────────────────────────────────
  weekday: {
    short: { sun: "អា", mon: "ច", tue: "អ", wed: "ពុ", thu: "ព្រ", fri: "សុ", sat: "ស" },
    min: { sun: "អា", mon: "ច", tue: "អ", wed: "ពុ", thu: "ព្រ", fri: "សុ", sat: "ស" },
    full: { sun: "អាទិត្យ", mon: "ច័ន្ទ", tue: "អង្គារ", wed: "ពុធ", thu: "ព្រហស្បតិ៍", fri: "សុក្រ", sat: "សៅរ៍" },
  },

  // ── What kind of day it is (legend & badges) ──────────────────────
  dayType: {
    work: "ថ្ងៃធ្វើការ",
    holiday: "ថ្ងៃឈប់សម្រាកសាធារណៈ",
    day_off: "ថ្ងៃសម្រាក",
    weekly_off: "ថ្ងៃសម្រាកប្រចាំសប្តាហ៍",
    leave: "ច្បាប់ឈប់សម្រាក",
    none: "មិនមានកាលវិភាគ",
  },

  // ── How the day went ──────────────────────────────────────────────
  attendance: {
    present: "មានវត្តមាន",
    late: "មកយឺត",
    incomplete: "ខកខានស្កេន",
    absent: "អវត្តមាន",
    worked: "បានធ្វើការ",
  },

  // ── Half-day leave & legend extras ────────────────────────────────
  halfDay: "½ {type} · {part}",
  morning: "ពេលព្រឹក",
  afternoon: "ពេលរសៀល",
  halfDayLegend: "ច្បាប់ឈប់សម្រាកកន្លះថ្ងៃ",
  silDay: "ថ្ងៃសីល",
  silDayLegend: "ថ្ងៃសីល",

  // ── Day dialog ────────────────────────────────────────────────────
  dialog: {
    silNote: "ថ្ងៃសីល",
    notInList: "ជាថ្ងៃឈប់សម្រាកសាធារណៈនៅកម្ពុជា ប៉ុន្តែមិនមាននៅក្នុងបញ្ជីថ្ងៃឈប់សម្រាករបស់ក្រុមហ៊ុនទេ ដូច្នេះមិនប៉ះពាល់ដល់កាលវិភាគរបស់បុគ្គលិកណាម្នាក់ឡើយ។",
    importLink: "នាំចូលពីទំព័រថ្ងៃឈប់សម្រាកសាធារណៈ",
    leavePart: "{type} ({part})",
    overrideSource: "ការផ្លាស់ប្តូរតែមួយថ្ងៃនៅលើតារាងវេនការងារ",
    usualSource: "កាលវិភាគការងារធម្មតារបស់បុគ្គលិក",
    atLocation: " · នៅ {location}",
    onHoliday: " · ក្នុងថ្ងៃឈប់សម្រាក {holiday}",
    scans: "ការស្កេន៖",
    worked: "ម៉ោងធ្វើការ {time}",
    late: " · មកយឺត {n} នាទី",
    early: " · ចេញមុនម៉ោង {n} នាទី",
    overtime: " · ម៉ោងបន្ថែម {time}",
    markOffLabel: "កំណត់ឱ្យ {name} សម្រាកនៅថ្ងៃនេះ",
    reasonPlaceholder: "មូលហេតុ (ស្រេចចិត្ត) — ឧ. ឈឺ, កិច្ចការគ្រួសារ",
    markOff: "កំណត់ជាថ្ងៃសម្រាក",
    removing: "កំពុងលុប…",
    removeOff: "លុបថ្ងៃសម្រាកនេះ",
    rosterOverride: "ដើម្បីកែប្រែ ឬលុបការផ្លាស់ប្តូរនៃថ្ងៃនេះ សូមប្រើ ",
    rosterNone: "បុគ្គលិកនេះមិនមានកាលវិភាគការងារនៅថ្ងៃនេះទេ។ សូមកំណត់កាលវិភាគពីប្រវត្តិរូប ឬពីទំព័រកាលវិភាគការងារ ឬកំណត់សម្រាប់តែថ្ងៃនេះនៅលើ ",
    rosterWork: "ដើម្បីកំណត់ម៉ោងផ្សេងសម្រាប់តែថ្ងៃនេះ សូមប្រើ ",
    roster: "តារាងវេនការងារ",
    rosterEnd: "។",
    added: "បានបន្ថែមថ្ងៃសម្រាក",
    removed: "បានលុបថ្ងៃសម្រាក",
  },
};
