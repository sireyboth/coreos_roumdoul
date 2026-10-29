// "Today" scan card (components/dashboard/attendance/attendance-today-card.tsx)

export const today = {
  // ── What kind of day it is ────────────────────────────────────────
  kind: {
    holiday: "Holiday",
    day_off: "Day off",
    weekly_off: "Your day off",
    leave: "You're on leave today",
    unscheduled: "No work schedule today",
  },

  // ── Card description ──────────────────────────────────────────────
  loading: "Loading your day…",
  auto: "Your attendance is recorded automatically — no need to scan.",
  next: "Next: {slot} at {time}",
  allDone: "Every scan for today is done.",
  scanOnArrival: "Scan when you arrive.",
  nothingScheduled: "Nothing is scheduled — scans today still count as worked time.",
  loadFailed: "Couldn't load today's schedule. You can still scan.",

  // ── Scan slots ────────────────────────────────────────────────────
  in: "IN",
  out: "OUT",
  missed: "Missed",
  nextSlot: "Next",
  lateBy: "{n}m late",
  earlyBy: "{n}m early",

  // ── Buttons ───────────────────────────────────────────────────────
  recording: "Recording…",
  scanQrSlot: "Scan QR — {slot}",
  scanQr: "Scan QR",
  useGps: "Use GPS instead",
  openInstant: "Open instant-scan mode →",

  // ── Day summary ───────────────────────────────────────────────────
  worked: "Worked {time}",
  overtime: "{time} overtime",

  // ── Messages ──────────────────────────────────────────────────────
  recordedIn: "IN recorded",
  recordedOut: "OUT recorded",
  recordedScan: "Scan recorded",
  noGeolocation: "Your browser doesn't support location — scan the QR code instead.",
  locationFailed: "Couldn't get your location — check browser permissions, or scan the QR code instead.",
};
