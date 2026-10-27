// Add an employee page (app/dashboard/employees/new/page.tsx)

export const newPage = {
  // ── Header ───────────────────────────────────────────────────────
  title: "Add an employee",
  description: "Only the name and branch are required. You can fill in the rest later.",

  // ── Photo ────────────────────────────────────────────────────────
  photo: "Photo",
  photoHint: "Optional — shown across the app.",

  // ── Pay group ────────────────────────────────────────────────────
  payGroup: "Pay group",
  payGroupHint: "When and by which rules they are paid, from their first day. You can change it later on their Pay tab.",
  defaultGroup: " (default)",

  // ── Sign-in ──────────────────────────────────────────────────────
  signInHintBefore: "Optional. Give this employee a login so they can sign in and check in. Choose ",
  signInHintOne: "one",
  signInHintAfter: " way for them to sign in. You can also do this later.",
  tempPassword: "Temporary password",
  passwordHint: "Leave empty to add the employee without a login.",
  codeHint: "This is what they'll sign in with.",
  emailInfoBefore: "They'll sign in with the ",
  emailInfoStrong: "email",
  emailInfoAfter: " above and this password.",
  idInfoBefore: "They'll sign in with employee ID ",
  idMissing: "(fill in the Employee ID above)",
  idInfoAfter: " and this password. No email needed. Share this link so the company is filled in for them:",

  // ── Save ─────────────────────────────────────────────────────────
  adding: "Adding…",
  added: "Employee added",
  addedEmail: "{email} can now sign in.",
  addedId: "They sign in with employee ID {code}. Share your company sign-in link with them.",
  photoFailed: "The photo couldn't be uploaded",
  photoFailedHint: "You can add it again from their page.",
};
