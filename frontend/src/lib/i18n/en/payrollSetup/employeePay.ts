// Employee's Pay tab (components/dashboard/payroll/employee-pay-panel.tsx)

export const employeePay = {
  // ── Shared words ──────────────────────────────────────────────────
  shared: {
    saving: "Saving…",
    saveFailed: "Couldn't save.",
    note: "Note",
    optional: "Optional",
    now: "now",
    upcoming: "Upcoming",
    fromDate: "{value} from {date}",
  },

  // ── Set / change salary dialog ────────────────────────────────────
  salaryDialog: {
    setTitle: "Set salary",
    changeTitle: "Change salary",
    text: "Takes effect from the date you choose. Earlier months keep the salary they had; a future date is applied automatically when it arrives.",
    paid: "Paid",
    perMonth: "Per month",
    perDayWorked: "Per day worked",
    saveSalary: "Save salary",
    saved: "Salary saved",
  },

  // ── Add allowance or deduction dialog ─────────────────────────────
  itemDialog: {
    title: "Add allowance or deduction",
    text: "A fixed amount every month, in their salary currency, for as long as you choose.",
    item: "Item",
    amountMonth: "Amount a month",
    until: "Until",
    untilHint: "Empty = every month from now on.",
    notePlaceholder: "Optional — shown on the payslip",
    added: "Item added",
  },

  // ── Tax, NSSF and payment card ────────────────────────────────────
  profile: {
    title: "Tax, NSSF and payment",
    text: "Dependents lower tax on salary. Bank and account number are on the Profile tab.",
    taxResident: "Tax resident of Cambodia",
    nssfEnrolled: "Enrolled in NSSF",
    spouse: "Spouse doesn't work (dependent)",
    children: "Dependent children",
    paidBy: "Paid by",
    bank: "Bank transfer",
    cash: "Cash",
    holder: "Account holder name",
    holderPlaceholder: "As on the bank account",
    nonResident: "Non-residents pay a flat rate with no dependent allowances.",
    saved: "Tax and payment details saved",
  },

  // ── Change pay group dialog ───────────────────────────────────────
  groupDialog: {
    title: "Change pay group",
    text: "From the date you choose, this person is paid on the new group's schedule and rules. A period they were only partly in pays its share of days.",
    group: "Pay group",
    nowSuffix: " (now)",
    fromHint: "The first day they are paid with the new group. To include them in a pay run that has already started, pick that run's first day (or earlier).",
    paidThrough: "Already paid through {date}, so the change can start the day after at the earliest.",
    future: "This date is in the future: until then they stay in {group}.",
    currentGroup: "their current group",
    changeGroup: "Change group",
    changed: "Pay group changed",
  },

  // ── Pay group card ────────────────────────────────────────────────
  groupCard: {
    title: "Pay group",
    text: "When this person is paid, and by which group's rules.",
    paidThrough: "paid through {date}",
    neverMoved: "Never moved — paid with the company's default group.",
    group: "Group",
    undoChange: "Undo this change",
    undoTitle: "Undo the latest pay group change?",
    undoText: "{group} from {date}. The group before it applies again.",
    theGroup: "The group",
    undo: "Undo",
  },

  // ── Salary card ───────────────────────────────────────────────────
  salaryCard: {
    title: "Salary",
    text: "Every change is kept, so each pay period is paid at the salary it had.",
    current: "Current salary",
    perDay: "per day",
    perMonth: "per month",
    slashDay: "/ day",
    slashMonth: "/ month",
    none: "No salary yet — this person is left out of pay runs until one is set.",
    removeThis: "Remove this salary",
    removeTitle: "Remove the latest salary?",
    removeText: "{amount} from {date}. The salary before it applies again.",
  },

  // ── Allowances and deductions card ────────────────────────────────
  itemsCard: {
    title: "Allowances and deductions",
    text: "Fixed monthly amounts: transport, phone, a loan repayment… Paid twice a month or weekly, each period pays its share.",
    noTypesBefore: "No allowance or deduction types yet. Create them in",
    settingsLink: "Payroll Settings",
    noTypesAfter: "(amount set on each employee).",
    none: "None.",
    item: "Item",
    aMonth: "{amount} a month",
    ongoing: "ongoing",
    thisItem: "this item",
    removeTitle: "Remove {name}?",
    removeText: "It stops appearing on future payslips. Approved payslips keep it.",
  },
};
