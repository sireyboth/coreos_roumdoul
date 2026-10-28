// Employee profile page (app/dashboard/employees/[id]/page.tsx)

export const profilePage = {
  // ── Not found ────────────────────────────────────────────────────
  notFound: "Employee not found",
  notFoundHint: "They may have been deleted, or you don't have access to their branch.",

  // ── Toasts ───────────────────────────────────────────────────────
  updated: "Employee updated",
  photoUpdated: "Photo updated",
  photoRemoved: "Photo removed",

  // ── Summary card ─────────────────────────────────────────────────
  code: "Code",

  // ── Sign-in card ─────────────────────────────────────────────────
  canSignIn: "Can sign in and check in.",
  cantSignIn: "Can't sign in or check in yet.",
  signsInWith: "Signs in with",
  shareLink: "Share this link so they don't have to type the company code:",

  // ── Attendance report card ───────────────────────────────────────
  attendanceTitle: "Attendance report",
  attendanceHint: "Download {name}'s check-ins and check-outs as a CSV file.",
  exportAttendance: "Export attendance",

  // ── ID card ──────────────────────────────────────────────────────
  cardTitle: "ID card",
  cardHint: "A printable badge with {name}'s photo, ID, and a scannable QR code.",
  deleteEmployee: "Delete employee",

  // ── Tabs ─────────────────────────────────────────────────────────
  tabProfile: "Profile",
  tabSchedule: "Schedule",
  tabPay: "Pay",

  // ── Edit form ────────────────────────────────────────────────────
  emailIsSignIn: "This is their sign-in email — change it from Users.",
  idIsSignIn: "This is their sign-in ID, so it can't be changed here.",
  branchMoveHint: "Moving someone to another branch also moves where they're allowed to check in.",
  reset: "Reset",

  // ── Read-only details ────────────────────────────────────────────
  details: "Details",
  employmentType: "Employment type",
  baseSalary: "Base salary",

  // ── Schedule tab ─────────────────────────────────────────────────
  oneOffChanges: "One-off changes",
};
