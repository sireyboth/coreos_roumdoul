// Labels for attendance codes from the API (lib/schedule.ts keeps the colours).
// Read as t(`attendance.status.day.${day.status}`) etc.

export const status = {
  // ── A day's status ────────────────────────────────────────────────
  day: {
    upcoming: "Not yet",
    in_progress: "In progress",
    complete: "Complete",
    incomplete: "Incomplete",
    absent: "Absent",
    off: "Off",
    worked_off: "Worked day off",
    unscheduled: "No schedule",
  },

  // ── Problems on a day ─────────────────────────────────────────────
  exception: {
    late: "Late",
    early_leave: "Left early",
    missing_in: "Missing IN",
    missing_out: "Missing OUT",
    absent: "Absent",
    extra_scan: "Extra scan",
    worked_day_off: "Worked day off",
    worked_holiday: "Worked holiday",
    unscheduled_work: "No schedule",
    overtime_pending: "Overtime to review",
  },

  // ── What kind of day the overtime was on ──────────────────────────
  overtimeType: {
    workday: "Work day",
    day_off: "Day off",
    holiday: "Holiday",
  },
};
