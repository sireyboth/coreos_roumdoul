import type { Dictionary } from "../../en";

// ជម្រើសបុគ្គលិក — Employee option names on screen. Same keys as en/employees/options.ts.

export const options: Dictionary["employees"]["options"] = {
  // ── Employment status ────────────────────────────────────────────
  status: {
    active: "សកម្ម",
    probation: "រយៈពេលសាកល្បងការងារ",
    on_leave: "កំពុងឈប់សម្រាក",
    suspended: "ផ្អាកការងារ",
    resigned: "បានលាឈប់",
    terminated: "បានបញ្ចប់កិច្ចសន្យា",
    contract_ended: "ផុតកំណត់កិច្ចសន្យា",
    retired: "ចូលនិវត្តន៍",
  },

  // ── Employment type ──────────────────────────────────────────────
  type: {
    full_time: "ពេញម៉ោង",
    part_time: "មិនពេញម៉ោង",
    contract: "កិច្ចសន្យាការងារ",
    temporary: "បណ្តោះអាសន្ន",
  },

  // ── Gender ───────────────────────────────────────────────────────
  gender: {
    female: "ស្រី",
    male: "ប្រុស",
    other: "ផ្សេងទៀត",
  },
};
