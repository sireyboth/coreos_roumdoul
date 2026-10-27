import type { Dictionary } from "../../en";

// កូដ QR សម្រាប់ស្កេនវត្តមាន (components/dashboard/qr-code-dialog.tsx) — same keys as en/employees/qrCode.ts.

export const qrCode: Dictionary["employees"]["qrCode"] = {
  // ── Dialog ───────────────────────────────────────────────────────
  title: "កូដ QR សម្រាប់ស្កេនវត្តមាននៅ «{name}»",
  description: "សូមបោះពុម្ព ហើយបិទកូដនេះនៅកន្លែងដែលបុគ្គលិកស្កេនវត្តមាន។ ការស្កេនកូដនេះនឹងកត់ត្រាវត្តមាននៅទីតាំងនេះ ដោយមិនចាំបាច់ប្រើ GPS។",
  alt: "កូដ QR សម្រាប់ {name}",
  done: "រួចរាល់",
  download: "ទាញយកកូដ QR",

  // ── Regenerate ───────────────────────────────────────────────────
  regenerate: "បង្កើតកូដថ្មី",
  regenerating: "កំពុងបង្កើតកូដថ្មី…",
  regenerateTitle: "បង្កើតកូដ QR ថ្មី?",
  regenerateHint: "ផ្ទាំងកូដ QR ចាស់នឹងលែងប្រើបានភ្លាមៗ ដូច្នេះលោកអ្នកត្រូវបោះពុម្ព និងបិទកូដថ្មីជំនួស។",
  regenerateConfirm: "បង្កើតកូដថ្មី",
  regenerated: "បានបង្កើតកូដ QR ថ្មី",
  regeneratedHint: "ផ្ទាំងកូដ QR ចាស់លែងប្រើបានទៀតហើយ។",
};
