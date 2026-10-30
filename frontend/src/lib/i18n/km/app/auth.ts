import type { Dictionary } from "../../en";

// Sign in (components/login-form.tsx) and sign up (app/signup/page.tsx) — same keys as en/app/auth.ts.

export const auth: Dictionary["app"]["auth"] = {
  // ── Sign in ───────────────────────────────────────────────────────
  signIn: {
    title: "សូមស្វាគមន៍ការត្រឡប់មកវិញ",
    description: "ចូលប្រព័ន្ធ ដើម្បីបន្តការងារជាមួយក្រុមរបស់លោកអ្នក។",
    email: "អ៊ីមែល",
    employeeId: "អត្តលេខបុគ្គលិក",
    // "Signing in to <company>. Not your company?"
    signingInTo: "កំពុងចូលប្រព័ន្ធរបស់",
    signingInEnd: "។",
    notYourCompany: "មិនមែនក្រុមហ៊ុនរបស់លោកអ្នកមែនទេ?",
    companyCode: "លេខកូដក្រុមហ៊ុន",
    companyCodePlaceholder: "ឧ. acme-x9k2",
    companyCodeHint: "សូមសួរប្រធានរបស់លោកអ្នក។",
    employeeIdPlaceholder: "ឧ. E-001",
    password: "ពាក្យសម្ងាត់",
    showPassword: "បង្ហាញពាក្យសម្ងាត់",
    hidePassword: "លាក់ពាក្យសម្ងាត់",
    submitting: "កំពុងចូលប្រព័ន្ធ…",
    success: "បានចូលប្រព័ន្ធដោយជោគជ័យ",
    redirecting: "កំពុងបើកផ្ទាំងការងាររបស់លោកអ្នក…",
    secureNote: "ការតភ្ជាប់មានសុវត្ថិភាព។ សម្រាប់តែអ្នកប្រើប្រាស់ដែលមានការអនុញ្ញាតប៉ុណ្ណោះ។",
    noAccount: "មិនទាន់មានគណនីមែនទេ?",
    createOne: "ចុះឈ្មោះក្រុមហ៊ុន",
  },

  // ── Brand panel beside both forms (components/auth-layout.tsx) ────
  panel: {
    headline: "ការងារប្រចាំថ្ងៃរបស់ក្រុម នៅកន្លែងតែមួយ។",
    subheadline: "វត្តមាន ច្បាប់ឈប់សម្រាក និងបៀវត្សរ៍ សម្រាប់គ្រប់សាខា — ជាភាសាខ្មែរ និងអង់គ្លេស។",
    // Sample app cards on the panel — an illustration, not real data.
    cards: {
      checkedIn: "បានស្កេនចូល",
      onTime: "ទាន់ម៉ោង",
      payslipReady: "បង្កាន់ដៃបៀវត្សរ៍រួចរាល់",
      payslipPeriod: "តុលា 2026",
      leaveApproved: "ច្បាប់ត្រូវបានអនុម័ត",
      leaveDays: "2 ថ្ងៃ · 4–5 វិច្ឆិកា",
    },
    rights: "រក្សាសិទ្ធិគ្រប់យ៉ាង។",
  },

  // ── Sign up ───────────────────────────────────────────────────────
  signUp: {
    title: "បង្កើតក្រុមហ៊ុនរបស់លោកអ្នក",
    description: "រៀបចំផ្ទាំងការងារក្នុងមួយនាទី រួចអញ្ជើញក្រុមរបស់លោកអ្នក។",
    trial: "សាកល្បងឥតគិតថ្លៃ 14 ថ្ងៃ",
    companyName: "ឈ្មោះក្រុមហ៊ុន",
    companyNamePlaceholder: "ឧ. Angkor Coffee",
    yourName: "ឈ្មោះរបស់លោកអ្នក",
    yourNamePlaceholder: "ឧ. ចាន់ សុខា",
    passwordHint: "យ៉ាងតិច 8 តួអក្សរ",
    submit: "ចុះឈ្មោះ",
    submitting: "កំពុងចុះឈ្មោះ…",
    haveAccount: "មានគណនីរួចហើយមែនទេ?",
  },
};
