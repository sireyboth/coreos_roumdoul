// Adjustments (app/dashboard/payroll/adjustments/page.tsx)

export const adjustments = {
  // ── Page ──────────────────────────────────────────────────────────
  title: "Adjustments",
  description: "One-off amounts — anything your rules don't cover. Each goes into the pay run whose period holds its date; recalculate that run to include it.",
  importExcel: "Import from Excel",
  add: "Add adjustment",
  month: "Month",

  // ── Table ─────────────────────────────────────────────────────────
  colItem: "Item",
  colAddedBy: "Added by",
  search: "Search adjustments…",
  emptyTitle: "No adjustments for {month}",
  emptyText: "Add a bonus, commission or penalty, or import a spreadsheet.",
  currencyNote: "Amounts are in each employee's salary currency (e.g. {usd} or {khr}).",

  // ── Remove ────────────────────────────────────────────────────────
  removeTitle: "Remove “{name}”?",
  removeText: "For {employee}, {date}.",
  thisEmployee: "this employee",

  // ── Add dialog ────────────────────────────────────────────────────
  dialog: {
    description: "A one-off amount — a bonus, commission, penalty or back pay. It goes on the payslip of the pay period that holds its date.",
    applyTo: "Apply to",
    one: "One employee",
    branch: "A branch",
    all: "Everyone",
    chooseEmployee: "Choose an employee",
    chooseBranch: "Choose a branch",
    recipientsOne: "{n} person will get this amount. It can still be removed on its own.",
    recipientsOther: "{n} people will each get this amount. Each one can still be removed on its own.",
    amountIn: "Amount ({currency})",
    mixedCurrency: "Some are paid in USD and some in KHR: each gets this number in their own currency.",
    dateHint: "Paid with the pay run whose period holds this date, in each person's own pay group.",
    name: "Name on payslip",
    namePlaceholder: "e.g. Khmer New Year bonus",
    reasonPlaceholder: "Optional — shown on the payslip",
    taxable: "Subject to tax on salary and NSSF",
    addFor: "Add for {n}",
    added: "Adjustment added",
    addedMany: "Adjustments added",
    addedManyOne: "{name} for {n} person",
    addedManyOther: "{name} for {n} people",
  },
};
