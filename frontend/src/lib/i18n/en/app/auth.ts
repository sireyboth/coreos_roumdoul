// Sign in (components/login-form.tsx) and sign up (app/signup/page.tsx).

export const auth = {
  // ── Sign in ───────────────────────────────────────────────────────
  signIn: {
    title: "Welcome back",
    description: "Sign in to pick up where your team left off.",
    email: "Email",
    employeeId: "Employee ID",
    // "Signing in to <company>. Not your company?"
    signingInTo: "Signing in to",
    signingInEnd: ".",
    notYourCompany: "Not your company?",
    companyCode: "Company code",
    companyCodePlaceholder: "e.g. acme-x9k2",
    companyCodeHint: "Your manager can tell you this.",
    employeeIdPlaceholder: "e.g. E-001",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    submitting: "Signing in…",
    success: "Signed in successfully",
    redirecting: "Opening your workspace…",
    secureNote: "Secured connection. Access is restricted to authorized users.",
    noAccount: "Don't have an account?",
    createOne: "Register your company",
  },

  // ── Brand panel beside both forms (components/auth-layout.tsx) ────
  panel: {
    headline: "Your team's whole workday, in one calm place.",
    subheadline: "Check-ins, leave and payroll for every branch — in Khmer and English.",
    // Sample app cards on the panel — an illustration, not real data.
    cards: {
      checkedIn: "Checked in",
      onTime: "On time",
      payslipReady: "Payslip ready",
      payslipPeriod: "October 2026",
      leaveApproved: "Leave approved",
      leaveDays: "2 days · 4–5 Nov",
    },
    rights: "All rights reserved.",
  },

  // ── Sign up ───────────────────────────────────────────────────────
  signUp: {
    title: "Create your company",
    description: "Set up your workspace in a minute, then invite your team.",
    trial: "14-day free trial",
    companyName: "Company name",
    companyNamePlaceholder: "e.g. Angkor Coffee",
    yourName: "Your name",
    yourNamePlaceholder: "e.g. Sokha Chan",
    passwordHint: "At least 8 characters",
    submit: "Create account",
    submitting: "Creating…",
    haveAccount: "Already have an account?",
  },
};
