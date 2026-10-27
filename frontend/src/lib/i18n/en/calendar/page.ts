// Calendar page (app/dashboard/calendar/page.tsx) — the individual month view and the view tabs.

export const page = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Calendar",
  descTeam: "Everyone's month at a glance — schedules, days off and attendance.",
  descAgenda: "Only the days something happens — holidays, leave, days off and absences — for the whole range.",
  descIndividual: "Work days, holidays and days off — and how each day actually went.",
  loadFailed: "Couldn't load the calendar.",

  // ── View tabs ─────────────────────────────────────────────────────
  tab: {
    team: "Team",
    individual: "Individual",
    myMonth: "My month",
    agenda: "Agenda",
  },
  workSchedules: "Work schedules",

  // ── Toolbar ───────────────────────────────────────────────────────
  myCalendar: "My calendar",
  noEmployees: "There are no employees yet. Add one from the Employees page to see their calendar.",

  // ── Month summary ─────────────────────────────────────────────────
  summary: {
    workDays: "{n} work days",
    holidays: "{n} holidays",
    daysOff: "{n} days off",
    present: "{n} present",
    late: "{n} late",
    absent: "{n} absent",
    incomplete: "{n} missing a scan",
    worked: "{time} worked",
    overtime: "{time} overtime",
  },

  // ── Grid ──────────────────────────────────────────────────────────
  showing: "Showing {name}. Click a day to see details or mark a day off.",
};
