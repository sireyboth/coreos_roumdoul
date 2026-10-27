// Late / early / missed detail (components/dashboard/attendance-late-detail.tsx)

export const lateDetail = {
  // ── Toolbar ───────────────────────────────────────────────────────
  toolbar: {
    show: "Show",
    lateFrom: "Late ≥",
    min: "min",
    lateFromAria: "Count lateness from this many minutes",
    sortBy: "Sort by",
    excel: "Excel",
    pdf: "PDF",
  },
  sort: {
    lateDays: "Late days",
    lateMinutes: "Total late",
    latePct: "Late %",
    bradford: "Bradford score",
    name: "Name",
  },

  // ── Heading ───────────────────────────────────────────────────────
  heading: {
    title: "Attendance detail · {period}",
    nothingSelected: "Nothing selected",
    lateFilter: "late ≥ {n} min",
    personOne: "{n} person",
    personMany: "{n} people",
    pickOne: "Pick at least one thing to show.",
    clean: "No one matches — a clean record for this period.",
  },

  // ── Overview table ────────────────────────────────────────────────
  overview: {
    workDays: "Work days",
    lateDays: "Late days",
    latePct: "Late %",
    totalLate: "Total late",
    avg: "Avg",
    longest: "Longest",
    early: "Early",
    missed: "Missed",
    absent: "Absent",
    absencePct: "Absence %",
    bradford: "Bradford",
    bradfordHint: "Separate absence spells² × days absent. Many short absences score higher than one long one — worth a conversation, not a verdict.",
    pattern: "Pattern",
    mostly: "Mostly {day} ({n}×)",
  },

  // Weekday names for the pattern
  weekday: {
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  },

  // ── One person's section ──────────────────────────────────────────
  person: {
    workDays: "{n} work days",
    late: "late {n} ({pct}%) · {total} · avg {avg}",
    neverLate: "never late",
    missedOne: "{n} missed scan",
    missedMany: "{n} missed scans",
    absent: "{n} absent",
    leave: "{n} leave",
  },

  // ── Day table ─────────────────────────────────────────────────────
  day: {
    schedule: "Schedule",
    in: "In",
    out: "Out",
    late: "Late",
    issue: "Issue",
    note: "Note",
    edited: "A scan was added or changed",
    early: "Early {time}",
    monthLate: "{n} late · {time}",
    monthMissed: "{n} missed",
    monthAbsent: "{n} absent",
  },
};
