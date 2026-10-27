// Pay runs list (app/dashboard/payroll/page.tsx)

export const runs = {
  // ── Page ──────────────────────────────────────────────────────────
  title: "Pay runs",
  description: "One run per pay group and period: calculate, review every payslip, then approve and pay.",
  newRun: "New pay run",
  payGroup: "Pay group",
  allGroups: "All groups",

  // ── Table ─────────────────────────────────────────────────────────
  colPeriod: "Period",
  colEmployees: "Employees",
  colNet: "Net pay",
  colApproved: "Approved",
  search: "Search periods…",
  emptyTitle: "No pay runs yet",
  emptyText: "Set up salaries on each employee's Pay tab and check Payroll settings (pay groups and rules), then start your first pay run.",

  // ── New pay run dialog ────────────────────────────────────────────
  dialog: {
    description: "Works out the pay of everyone in a pay group for one period, from their salary, attendance and the group's rules. You can review and recalculate before approving.",
    peopleOne: "{summary} · {n} person in this group now",
    peopleOther: "{summary} · {n} people in this group now",
    emptyGroup: "Nobody is in {group} yet, so this run would have no payslips. Put employees in it first: open each employee → Pay tab → Change group.",
    period: "Period",
    notOver: "not over yet",
    notOverWarning: "This period isn't over yet: the numbers are a preview until it is.",
    whatItPays: "What this run pays:",
    dailyPaid: "Daily-paid staff get the days they worked. Absence, unpaid leave, lateness and overtime come from attendance inside the period.",
    noTax: "Tax and NSSF are not included for this kind of period yet.",
    failed: "Couldn't start the pay run.",
    calculating: "Calculating…",
    calculate: "Calculate pay",
  },

  // ── How much of a monthly salary one period pays ──────────────────
  share: {
    monthly: "the full monthly salary.",
    semi_monthly: "half of the monthly salary.",
    weekly: "12/52 of the monthly salary (a year's pay over 52 weeks).",
    biweekly: "12/26 of the monthly salary (a year's pay over 26 fortnights).",
    custom: "the share of each month the dates cover (e.g. 10 Sep – 5 Oct ≈ 0.86 of a month).",
  },
};
