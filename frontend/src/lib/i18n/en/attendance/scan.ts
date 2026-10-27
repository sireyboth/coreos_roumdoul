// Instant scan page (app/dashboard/scan/page.tsx)
// Also uses attendance.today (IN/OUT, "Next: …", recorded messages).

export const scan = {
  // ── No employee record ────────────────────────────────────────────
  goToAttendance: "Go to Attendance",

  // ── Camera ────────────────────────────────────────────────────────
  exit: "Exit scan mode",
  pointCamera: "Point your camera at the QR code",

  // ── After a scan ──────────────────────────────────────────────────
  nextThen: "Next: {slot} at {time}. Scan the same QR code then.",
  allDone: "That's every scan for today.",
  scanAgain: "Scan again",
};
