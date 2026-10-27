import type { Dictionary } from "../../en";

// Sign in (components/login-form.tsx) and sign up (app/signup/page.tsx) — same keys as en/app/auth.ts.

export const auth: Dictionary["app"]["auth"] = {
  // ── Sign in ───────────────────────────────────────────────────────
  signIn: {
    title: "ចូលគណនីរបស់លោកអ្នក",
    description: "សូមបញ្ចូលព័ត៌មានសម្គាល់ ដើម្បីចូលប្រើប្រព័ន្ធរបស់ស្ថាប័នលោកអ្នក។",
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
    headline: "វេទិកាតែមួយ សម្រាប់បុគ្គលិក និងប្រតិបត្តិការរបស់លោកអ្នក។",
    subheadline: "វត្តមាន ច្បាប់ឈប់សម្រាក បៀវត្សរ៍ និងឯកសារបុគ្គលិក — គ្រប់គ្រងដោយសុវត្ថិភាពនៅកន្លែងតែមួយ សម្រាប់គ្រប់សាខានៃស្ថាប័នរបស់លោកអ្នក។",
    attendanceTitle: "វត្តមាន និងកាលវិភាគការងារ",
    attendanceText: "កំណត់ត្រាម៉ោងការងារត្រឹមត្រូវ គ្រប់សាខា និងគ្រប់វេន។",
    payrollTitle: "បៀវត្សរ៍ និងច្បាប់ឈប់សម្រាក",
    payrollText: "គណនាវគ្គបើកប្រាក់ ការកែតម្រូវ និងសមតុល្យច្បាប់ឈប់សម្រាក ប្រកបដោយភាពស៊ីសង្វាក់។",
    securityTitle: "សិទ្ធិចូលប្រើតាមតួនាទី",
    securityText: "រាល់សកម្មភាពត្រូវបានកត់ត្រា ហើយអ្នកប្រើប្រាស់ម្នាក់ៗឃើញតែអ្វីដែលតួនាទីរបស់ខ្លួនអនុញ្ញាត។",
    rights: "រក្សាសិទ្ធិគ្រប់យ៉ាង។",
  },

  // ── Sign up ───────────────────────────────────────────────────────
  signUp: {
    title: "បង្កើតក្រុមហ៊ុនរបស់លោកអ្នក",
    description: "ចាប់ផ្តើមការសាកល្បងឥតគិតថ្លៃរយៈពេល 14 ថ្ងៃលើ Business OS។",
    companyName: "ឈ្មោះក្រុមហ៊ុន",
    yourName: "ឈ្មោះរបស់លោកអ្នក",
    submit: "ចុះឈ្មោះ",
    submitting: "កំពុងចុះឈ្មោះ…",
    haveAccount: "មានគណនីរួចហើយមែនទេ?",
  },
};
