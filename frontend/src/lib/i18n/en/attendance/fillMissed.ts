// Fill missed scans dialog (components/dashboard/attendance-fill-missed-dialog.tsx)

export const fillMissed = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Fill missed scans",
  description: "Each missed IN or OUT is added for the selected days. Scans people actually made stay as they are.",

  // ── Summary ───────────────────────────────────────────────────────
  scansOne: "{n} scan",
  scansOther: "{n} scans",
  willBeAdded: "will be added across {days} for {people}.",
  daysOne: "{n} day",
  daysOther: "{n} days",
  peopleOne: "{n} person",
  peopleOther: "{n} people",
  skippedOne: "{n} selected day has nothing missing and will be left alone.",
  skippedOther: "{n} selected days have nothing missing and will be left alone.",
  nothingToFill: "None of the selected days have a missed scan. Days off, leave, holidays and complete days have nothing to fill.",

  // ── Times ─────────────────────────────────────────────────────────
  timesToUse: "Times to use",
  scheduledTimes: "Scheduled times",
  setTimes: "Set times",
  slotIn: "IN {n}",
  slotOut: "OUT {n}",
  customHint: "Used only where a scan is missing.",
  mixedSchedules: "The selected days have different schedules — each time goes to the same IN/OUT position on every day.",
  scheduledHint: "Each missed scan gets the time its schedule expected, so the day counts as on time.",

  // ── Reason & save ─────────────────────────────────────────────────
  reasonPlaceholder: "e.g. Scanner was down all morning",
  reasonHint: "Shown on each day and in the attendance export.",
  filling: "Filling…",
  fillOne: "Fill {n} scan",
  fillOther: "Fill {n} scans",
  doneOne: "Missed scans filled on {n} day",
  doneOther: "Missed scans filled on {n} days",
};
