// Employee option names on screen (labelIn / optionsIn in components/dashboard/employee-form.tsx).
// The English labels in employee-form.tsx stay as they are: Excel files match them.

export const options = {
  // ── Employment status ────────────────────────────────────────────
  status: {
    active: "Active",
    probation: "Probation",
    on_leave: "On leave",
    suspended: "Suspended",
    resigned: "Resigned",
    terminated: "Terminated",
    contract_ended: "Contract ended",
    retired: "Retired",
  },

  // ── Employment type ──────────────────────────────────────────────
  type: {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    temporary: "Temporary",
  },

  // ── Gender ───────────────────────────────────────────────────────
  gender: {
    female: "Female",
    male: "Male",
    other: "Other",
  },
};
