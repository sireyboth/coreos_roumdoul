// Shared calendar labels and the day dialog (components/dashboard/calendar-shared.tsx).
// Weekdays: t(`calendar.shared.weekday.short.${WEEKDAY_KEYS[d.getDay()]}`).

export const shared = {
  // ── Weekdays ──────────────────────────────────────────────────────
  weekday: {
    short: { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" },
    min: { sun: "Su", mon: "Mo", tue: "Tu", wed: "We", thu: "Th", fri: "Fr", sat: "Sa" },
    full: { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" },
  },

  // ── What kind of day it is (legend & badges) ──────────────────────
  dayType: {
    work: "Work day",
    holiday: "Holiday",
    day_off: "Day off",
    weekly_off: "Weekly day off",
    leave: "On leave",
    none: "Nothing planned",
  },

  // ── How the day went ──────────────────────────────────────────────
  attendance: {
    present: "Present",
    late: "Late",
    incomplete: "Missing a scan",
    absent: "Absent",
    worked: "Worked",
  },

  // ── Half-day leave & legend extras ────────────────────────────────
  halfDay: "½ {type} · {part}",
  morning: "morning",
  afternoon: "afternoon",
  halfDayLegend: "Half-day leave",
  silDay: "Sil day",
  silDayLegend: "Sil day (ថ្ងៃសីល)",

  // ── Day dialog ────────────────────────────────────────────────────
  dialog: {
    silNote: "ថ្ងៃសីល · Buddhist observance day",
    notInList: "A Cambodian holiday, but not in your company's holiday list, so it doesn't change anyone's schedule.",
    importLink: "Import it from Holidays",
    leavePart: "{type} ({part})",
    overrideSource: "A one-off change on the roster for this day",
    usualSource: "Their usual work schedule",
    atLocation: " · at {location}",
    onHoliday: " · on the {holiday} holiday",
    scans: "Scans:",
    worked: "Worked {time}",
    late: " · {n} min late",
    early: " · left {n} min early",
    overtime: " · {time} overtime",
    markOffLabel: "Mark {name} as off this day",
    reasonPlaceholder: "Reason (optional) — e.g. Sick, Family",
    markOff: "Mark as day off",
    removing: "Removing…",
    removeOff: "Remove this day off",
    rosterOverride: "To change or remove this day's change, use the ",
    rosterNone: "They have no work schedule on this date. Assign one from their profile or Work Schedules, or set this one day on the ",
    rosterWork: "To give them different hours on just this day, use the ",
    roster: "Roster",
    rosterEnd: ".",
    added: "Day off added",
    removed: "Day off removed",
  },
};
