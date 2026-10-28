// Create or edit a work schedule (components/dashboard/work-schedule-dialog.tsx).

export const form = {
  // ── Header ────────────────────────────────────────────────────────
  titleNew: "New work schedule",
  titleEdit: "Edit \"{name}\"",
  description:
    "When people on this schedule should scan in and out. Add as many IN → OUT stretches per day as you need — a split shift is simply two.",
  name: "Name",
  namePlaceholder: "Split shift",
  descriptionLabel: "Description (optional)",
  descriptionPlaceholder: "Shop floor, Mon–Sat",

  // ── Hours ─────────────────────────────────────────────────────────
  hours: "Hours",
  perWeek: "{time} per week. A time earlier than the one before it is the next morning (night shifts).",
  copyMonday: "Copy Monday to every working day",
  overtimeOnlyTitle: "Overtime-only schedule",
  overtimeOnlyOff: "No day has hours. Turn overtime on below to save it as an overtime-only schedule, or add hours.",
  overtimeOnlyOn:
    "No day has hours, so every hour worked under this schedule counts as overtime — as holiday overtime on a holiday. Use it as a one-day roster override, not as someone's usual schedule.",
  noHours: "No hours",
  addHours: "Add hours",
  in: "IN",
  out: "OUT",
  stretchIn: "{day} stretch {n} in",
  stretchOut: "{day} stretch {n} out",
  nextDay: "next day",
  removeHours: "Remove these hours",
  addStretch: "Add a stretch (e.g. after lunch)",

  // ── Scanning ──────────────────────────────────────────────────────
  scanning: "Scanning",
  auto: "Automatic attendance — no scanning needed",
  autoHint:
    "For top management and others who don't scan. Each IN and OUT is recorded at its scheduled time once it passes, so they're never late or absent. Holidays and days off still apply.",

  // ── Tolerances ────────────────────────────────────────────────────
  tolerances: "Tolerances",
  late: "Late after (min)",
  lateHint: "Grace after each IN before it counts as late.",
  early: "Early leave allowance (min)",
  earlyHint: "How early an OUT may be before it counts.",
  break: "Unpaid break (min)",
  breakHint: "Taken off days with one IN/OUT, where people don't scan out for lunch.",
  breakNotNeeded: "Not needed: the gap between your stretches is the break.",
  breakPaid: "The break is paid (counts as worked time)",

  // ── Days off ──────────────────────────────────────────────────────
  daysOff: "Suggested weekly days off",
  daysOffHint: "Pre-filled when you assign this schedule. Each person can have their own days off.",

  // ── Overtime ──────────────────────────────────────────────────────
  overtime: "Overtime",
  mode: {
    off: "Don't count overtime",
    offHelp: "Time past the schedule is recorded as worked, but never as overtime.",
    after_last_out: "Time after the last OUT",
    after_last_outHelp: "Staying past the day's final OUT counts as overtime.",
    above_scheduled: "Hours above the schedule",
    above_scheduledHelp: "Worked hours beyond the day's scheduled hours count as overtime.",
  },
  ignoreShorter: "Ignore overtime shorter than (min)",
  roundDown: "Round overtime down to",
  exactMinutes: "Exact minutes",
  wholeHours: "Whole hours",
  minutes: "{n} minutes",
  countEarly: "Coming in before the first IN counts too",
  needsApproval: "A manager must approve it before it counts",
  dayOffNote: "Work on a day off or a holiday is overtime in full, recorded as day-off or holiday overtime.",

  // ── Status & order ────────────────────────────────────────────────
  active: "Active — inactive schedules can't be newly assigned",
  orderExample: "the most used schedule",

  // ── Footer & messages ─────────────────────────────────────────────
  create: "Create schedule",
  needHours: "Add hours to at least one day, or turn overtime on to make an overtime-only schedule.",
  updated: "Schedule updated",
  updatedHint: "Days already finished keep the hours they were judged by.",
  created: "Schedule created",
};
