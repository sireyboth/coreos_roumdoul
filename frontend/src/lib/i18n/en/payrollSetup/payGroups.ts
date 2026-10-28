// Pay groups card and dialog (components/dashboard/payroll/pay-groups.tsx)

export const payGroups = {
  // ── Setting choices ───────────────────────────────────────────────
  rateBasis: {
    fixed: "Monthly salary ÷ a fixed number of days",
    calendar: "Salary ÷ days in the period",
    scheduled: "Salary ÷ the person's scheduled work days",
  },
  missing: {
    review: "Must be fixed before approving",
    present: "Counts as worked",
    absent: "Counts as absent",
  },

  // ── Dialog: schedule ──────────────────────────────────────────────
  dialog: {
    editTitle: "Edit {name}",
    addTitle: "Add pay group",
    text: "People paid on the same schedule by the same rules, e.g. office staff once a month, factory workers twice a month.",
    namePlaceholder: "e.g. Factory workers",
    paid: "Paid",
    lastDay: "Last day of the month",
    day: "Day {n}",
    periodEnds: "Each period ends on",
    monthlyHint: "{summary} — e.g. day 25 makes periods 26th → 25th.",
    firstEnds: "First period ends on",
    secondEnds: "Second period ends on",
    anchor: "First day of any one period",
    weeklyHint: "{summary}. The rest follow every {n} days.",
    customHint: "HR picks the start and end of each run (at most 62 days). A monthly salary pays the share of each month the dates cover.",
    hasRuns: "This group already has pay runs: a new schedule applies from the period after its last run.",
    shareTitle: "How a monthly salary is paid per period",
    shareText: "Once a month: the full salary. Twice a month: half each period. Weekly: 12/52 of it; every 2 weeks: 12/26. Daily-paid staff are paid for the days they work. Tax and NSSF are only worked out for 1st → end-of-month periods for now.",
    autoCalculate: "Prepare each period's pay run automatically when the period ends (someone still checks and approves it)",
    isDefault: "Default group — anyone not put in a group is paid with it",
  },

  // ── Dialog: the group's own settings ──────────────────────────────
  own: {
    title: "This group's own settings",
    hint: "Leave as “Company setting” to use Payroll Settings.",
    companySetting: "Company setting ({value})",
    dailyRate: "Daily rate",
    daysInMonth: "Days in a month",
    hoursPerDay: "Hours in a work day",
    missingScan: "A day with a missing scan",
    holidays: "Daily-paid staff on public holidays",
    paid: "Paid",
    notPaid: "Not paid",
    paidLower: "paid",
    notPaidLower: "not paid",
  },

  // ── Dialog: pay rules for this group ──────────────────────────────
  rules: {
    title: "Pay rules for this group",
    hint: "Switch a component off, or give it this group's own rule. Nothing changes for other groups.",
    notUsed: "Not used in this group",
    offForCompany: "Off for the company · ",
    inGroup: "{name} in this group",
    company: "As the company",
    off: "Off",
    on: "On",
    own: "Own rule",
  },

  // ── Dialog: saving ────────────────────────────────────────────────
  save: {
    saved: "Pay group saved",
    added: "Pay group added",
    addGroup: "Add group",
  },

  // ── Pay groups card ───────────────────────────────────────────────
  card: {
    title: "Pay groups",
    text: "Who is paid when, and by which rules. Put each employee in a group on their Pay tab; anyone not put in one is in the default group.",
    default: "Default",
    automatic: "Automatic",
    now: " · now {period}",
    personOne: "{n} person",
    personOther: "{n} people",
    ownOne: " · {n} own setting",
    ownOther: " · {n} own settings",
    companyRules: " · company rules",
    deleteTitle: "Delete “{name}”?",
    deleteText: "Only a group nobody was ever in, with no pay runs, can be deleted.",
  },
};
