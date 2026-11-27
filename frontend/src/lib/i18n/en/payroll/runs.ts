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

  // ── Export to Excel dialog: tick runs, get one file ───────────────
  export: {
    button: "Export to Excel",
    title: "Export pay runs",
    description: "Pick a format and the runs. Everything comes in one Excel file.",
    format: "Format",
    formatReport: "Excel report",
    formatReportHint: "Summary + payslips",
    formatBankHint: "Bulk upload file",
    bankOptions: "{bank} file",
    bankSheets: "With two runs or more, the first sheet (\"All USD\") holds every transfer together: upload that one to pay them all at once. A sheet per run follows. Each row's remarks name its period, e.g. \"Payroll Oct 26\".",
    loading: "Loading payslips…",
    downloadBank: "Download {bank} file",
    runsCount: "Pay runs ({n})",
    selectAll: "Select all",
    clearAll: "Clear all",
    peopleOne: "{n} person",
    people: "{n} people",
    none: "No pay runs in this group.",
    selected: "{n} selected",
    downloadN: "Download Excel ({n})",
    pickFirst: "Select pay runs to export",
    preparing: "Preparing file…",
    done: "Exported {n} pay runs to Excel.",
  },
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
