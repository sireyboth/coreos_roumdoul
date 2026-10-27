// Sign in (components/login-form.tsx) and sign up (app/signup/page.tsx).

export const auth = {
  // ── Sign in ───────────────────────────────────────────────────────
  signIn: {
    title: "Sign in to your account",
    description: "Enter your credentials to access your organization's workspace.",
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
    secureNote: "Secured connection. Access is restricted to authorized users.",
    noAccount: "Don't have an account?",
    createOne: "Register your company",
  },

  // ── Brand panel beside both forms (components/auth-layout.tsx) ────
  panel: {
    headline: "One platform for your people and operations.",
    subheadline: "Attendance, leave, payroll and records — managed securely in one place for every branch of your organization.",
    attendanceTitle: "Attendance & scheduling",
    attendanceText: "Accurate time records across every branch and shift.",
    payrollTitle: "Payroll & leave",
    payrollText: "Pay periods, adjustments and leave balances, calculated consistently.",
    securityTitle: "Role-based access",
    securityText: "Every action audited; each user sees only what their role permits.",
    rights: "All rights reserved.",
  },

  // ── Sign up ───────────────────────────────────────────────────────
  signUp: {
    title: "Create your company",
    description: "Start a free 14-day trial on Business OS.",
    companyName: "Company name",
    yourName: "Your name",
    submit: "Create account",
    submitting: "Creating…",
    haveAccount: "Already have an account?",
  },
};
