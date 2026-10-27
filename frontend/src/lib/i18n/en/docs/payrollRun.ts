// Payroll guide, part 2: every pay period, steps 6–10 (components/docs/payroll-docs.tsx)
// Inline marks: <b>bold</b>, <i>italic</i>, <path>where to click</path>.

export const payrollRun = {
  // ── Step 6: Start a pay run ───────────────────────────────────────
  run: {
    s1: "<path>Pay runs → New pay run</path>.",
    s2: "Choose the <b>pay group</b>. The dialog shows how many people are in it now and what a run pays (e.g. “half of the monthly salary”).",
    s3: "Choose the <b>period</b> from the list (newest first; periods that already have a run are greyed out). For “Dates picked each time” enter From and To.",
    s4: "Click <path>Calculate pay</path>. Every payslip is worked out immediately and the run opens with status <b>In review</b>.",
    b1: "Only one run per group per period; runs of the same group can never overlap.",
    b2: "A period that hasn't ended can be calculated as a preview, but not approved until it is over.",
    b3: "Different groups are independent: the factory's 1–15 Oct run and the office's October run don't affect each other.",
  },

  // ── Step 7: Review payslips ───────────────────────────────────────
  review: {
    p1: "The run page shows totals per currency (USD and KHR are never added together) and one row per person.",
    head: { check: "In the Check column", meaning: "Meaning", todo: "What to do" },
    rows: {
      ok: { check: "OK", meaning: "Nothing to look at.", todo: "—" },
      note: { check: "Note", meaning: "Something worth knowing, e.g. pending overtime.", todo: "Open it; act if needed." },
      fix: { check: "Needs fixing", meaning: "Something blocks approval, e.g. a missing scan.", todo: "Open the payslip to see why, fix it (usually in Attendance), then recalculate." },
      recalc: { check: "Recalculate", meaning: "This person's attendance, salary or adjustments changed after the calculation.", todo: "Click it — only that person is recalculated." },
    },
    p2: "Click a row to open the payslip. It shows:",
    b1: "Earnings, deductions, NSSF and tax, after-tax deductions — each with how it was worked out.",
    b2: "Gross, net, and the total cost to the company.",
    b3: "The facts it used: days worked, absences, missing scans, late arrivals, daily and hourly rate, exchange rate.",
    b4: "For periods crossing months: gross split by month (by day), for monthly reports.",
    changesTitle: "When something changes",
    changes: "If anything a run uses changes after you calculated it, a yellow banner appears. When only some people are affected it names them and <b>Recalculate these</b> updates just them; when a shared thing changed (a rule, the group, who is in it) recalculate everyone. A run can't be approved while it is out of date.",
  },

  // ── Step 8: Adjustments ───────────────────────────────────────────
  adjustments: {
    intro: "One-off amounts your rules don't cover.",
    head: { type: "Type", use: "Use for", effect: "Effect" },
    rows: {
      earning: { type: "Earning", use: "Bonus, commission, back pay", effect: "Added to gross (tick whether it counts for tax/NSSF)" },
      deduction: { type: "Deduction", use: "Penalty, damage", effect: "Taken off before tax" },
      afterTax: { type: "After-tax deduction", use: "Salary advance, loan", effect: "Taken off net pay" },
    },
    addTitle: "Add one",
    s1: "<path>Adjustments → Add adjustment</path>.",
    s2: "Apply to one employee, a whole branch, or everyone (each person gets their own row you can remove separately).",
    s3: "Pick the <b>date</b>. The adjustment goes into the pay run whose period holds that date, in each person's own group.",
    s4: "Enter the name shown on the payslip, the amount (in each person's salary currency) and an optional reason.",
    s5: "Recalculate the run (the run will show it is out of date until you do).",
    calcTitle: "Which run gets it — cut-off-20 group",
    calc1: "Dated 15 Sep",
    calc1Run: "21 Aug – 20 Sep run",
    calc2: "Dated 25 Sep",
    calc2Run: "21 Sep – 20 Oct run",
    importTitle: "Import from Excel",
    import: "<path>Adjustments → Import from Excel</path> — download the template, fill one row per amount, upload. Columns: Employee ID (or Employee name), Date (optional — empty uses the date shown), Type, Name on payslip, Amount, Taxable (Yes/No), Reason. Rows that can't be matched are reported, not guessed. Importing the same file twice adds them twice.",
    approved: "Adjustments can't be dated in a period already approved for that person — date them in the next period.",
  },

  // ── Step 9: Approve ───────────────────────────────────────────────
  approve: {
    p1: "A person with Payroll <b>Approve</b> clicks <path>Approve</path> once the period is over and nothing blocks. People who only prepare runs don't see the button. The system recalculates one last time, so what is approved is exactly what was checked, then:",
    b1: "The run and its payslips are frozen — no recalculation, no deleting.",
    b2: "Attendance used by it is <b>locked for those people, for those days only</b>: no scans, corrections, leave or roster changes there. Other people and other days stay open.",
    b3: "Their salary and pay group can't change on or before the last paid day; adjustments can't be dated in that period.",
    b4: "The approval is recorded in the audit log.",
    p2: "Approval is refused while: the period isn't over, the run is out of date, nobody is in it, or any payslip “Needs fixing”.",
  },

  // ── Step 10: Export & mark as paid ────────────────────────────────
  pay: {
    s1: "<path>Export CSV</path> — one row per payslip, opens in Excel (Khmer names display correctly).",
    s2: "Pay your staff through the bank or in cash.",
    s3: "<path>Mark as paid</path> — records who paid and when.",
    columns: "CSV columns: Employee ID, Employee, Period start, Period end, Currency, Base salary, Gross, NSSF (employee), Tax on salary, Net pay, Employer cost, Payment method, Bank, Account number, Account name.",
  },
};
