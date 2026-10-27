import type { Dictionary } from "../../en";

// App shell (app/dashboard/layout.tsx) and the theme switch — same keys as en/app/shell.ts.

export const shell: Dictionary["app"]["shell"] = {
  // ── Header ────────────────────────────────────────────────────────
  toggleMenu: "បើក ឬបិទម៉ឺនុយ",
  profile: "ប្រវត្តិរូប",
  toggleTheme: "ប្តូរផ្ទៃភ្លឺ ឬងងឹត",
  loadingWorkspace: "កំពុងផ្ទុកកន្លែងធ្វើការរបស់លោកអ្នក…",

  // ── Company account status (code from the server) ─────────────────
  companyStatus: {
    trial: "ការសាកល្បងឥតគិតថ្លៃ",
    active: "សកម្ម",
    suspended: "បានផ្អាក",
    cancelled: "បានលុបចោល",
  },
};
