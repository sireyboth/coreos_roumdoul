import type { Dictionary } from "../../en";

// Words shared by the organization screens — same keys as en/org/shared.ts.

export const shared: Dictionary["org"]["shared"] = {
  // ── Forms ────────────────────────────────────────────────────────
  editTitle: 'កែប្រែ "{name}"',
  code: "កូដ (ស្រេចចិត្ត)",
  address: "អាសយដ្ឋាន (ស្រេចចិត្ត)",
  saveChanges: "រក្សាទុកការកែប្រែ",
  saving: "កំពុងរក្សាទុក…",
  adding: "កំពុងបន្ថែម…",

  // ── Location fields (branches & work locations) ─────────────────
  location: "ទីតាំង",
  locating: "កំពុងស្វែងរកទីតាំង…",
  useMyLocation: "ប្រើទីតាំងបច្ចុប្បន្នរបស់ខ្ញុំ",
  latitude: "រយៈទទឹង",
  longitude: "រយៈបណ្តោយ",
  latitudeExample: "ឧ. 11.5564",
  longitudeExample: "ឧ. 104.9282",
  noGeolocation: "កម្មវិធីរុករករបស់លោកអ្នកមិនគាំទ្រការប្រើទីតាំងទេ។",
  locationDenied: "មិនអាចទទួលបានទីតាំងរបស់លោកអ្នកទេ — សូមពិនិត្យការអនុញ្ញាតក្នុងកម្មវិធីរុករក។",
  requireLocation: "តម្រូវឱ្យមានទីតាំង ពេលស្កេនកូដ QR",

  // ── Tables ───────────────────────────────────────────────────────
  colCode: "កូដ",
  colAddress: "អាសយដ្ឋាន",
  colEmployees: "បុគ្គលិក",
  companyWide: "ទូទាំងក្រុមហ៊ុន",
  members: "សមាជិក",
  qrCode: "កូដ QR",
  inactiveFirst: "អសកម្មមុន",
  activeFirst: "សកម្មមុន",

  // ── Delete ───────────────────────────────────────────────────────
  deleteTitle: 'លុប "{name}" មែនទេ?',
  deleted: 'បានលុប "{name}"',
};
