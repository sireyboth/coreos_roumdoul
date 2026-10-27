// Pay run dashboard (app/dashboard/payroll/runs/[id]/dashboard/page.tsx)

export const dashboard = {
  // ── Header & filters ──────────────────────────────────────────────
  back: "Pay run",
  title: "Payroll dashboard",
  openRun: "Open pay run",
  allBranches: "All branches",
  noBranch: "No branch",
  noDepartment: "No department",
  separate: "USD and KHR salaries are shown separately, never added together.",
  vs: "vs {period}",

  // ── Stat tiles ────────────────────────────────────────────────────
  net: "Net pay",
  netHint: "What staff receive",
  cost: "Total cost to company",
  costHint: "Gross + employer NSSF",
  employees: "Employees paid",
  cashHint: "{n} paid in cash",
  average: "Average net pay",
  averageHint: "Per person",

  // ── Trend ─────────────────────────────────────────────────────────
  trendTitle: "Payroll over time",
  trendBranch: "Whole pay group — the branch filter doesn't apply to past runs.",
  trendOne: "Last {n} run of {group}, in {currency}",
  trendOther: "Last {n} runs of {group}, in {currency}",
  thisGroup: "this group",
  totalCost: "Total cost",
  gross: "Gross",
  trendEmpty: "The trend appears once this pay group has more than one run.",

  // ── Where the money goes ──────────────────────────────────────────
  moneyTitle: "Where the money goes",
  moneyText: "Total cost {amount}",
  netToStaff: "Net pay to staff",
  withheld: "NSSF + tax withheld",
  afterTax: "After-tax deductions",
  employerNssf: "Employer NSSF",
  grossPay: "Gross pay",
  beforeTax: "Deductions before tax",

  // ── Breakdowns ────────────────────────────────────────────────────
  byDepartment: "Cost by department",
  byBranch: "Cost by branch",
  noPayslips: "No payslips.",
  earningsTitle: "Earnings by component",
  earningsText: "Salary, allowances, overtime and bonuses",
  paid: "Paid",
  noEarnings: "No earnings.",
  deductionsTitle: "Deductions by component",
  deductionsText: "Before and after tax — NSSF and tax are under “Where the money goes”",
  deducted: "Deducted",
  noDeductions: "No deductions this period.",
  distributionTitle: "Net pay distribution",
  distributionText: "How many people fall in each pay band",
  people: "People",
  topTitle: "Top earners",
  topText: "By gross pay · open one to see the payslip",
  removedEmployee: "Removed employee",
  netAmount: "net {amount}",

  // ── Before paying ─────────────────────────────────────────────────
  checksTitle: "Before paying",
  checksText: "Things to check in this run",
  problemsOne: "{n} payslip needs fixing",
  problemsOther: "{n} payslips need fixing",
  noProblems: "No payslip problems",
  noProblemsText: "Nothing blocks approval.",
  missingBank: "{n} missing bank details",
  bankComplete: "Bank details complete",
  bankCompleteText: "Everyone paid by bank has an account.",
  readyToPay: "Approved — ready to pay",
  notApproved: "Not approved yet",
  approvedBy: "Approved by {name}",
  canChange: "Figures can still change until the run is approved.",
};
