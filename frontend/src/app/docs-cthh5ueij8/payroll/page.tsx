import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Bullets, Calc, Formula, H3, Note, P, Path, Section, Steps, Table, Toc, type TocEntry } from "@/components/docs/doc-parts";

export const metadata: Metadata = {
  title: "Payroll — Business OS Docs",
  robots: { index: false, follow: false },
};

const TOC: TocEntry[] = [
  { id: "overview", title: "How payroll works" },
  { id: "before", title: "Before you start" },
  { id: "settings", title: "Company pay settings", step: 1 },
  { id: "components", title: "Pay components (rules)", step: 2 },
  { id: "groups", title: "Pay groups & periods", step: 3 },
  { id: "employees", title: "Set up each employee", step: 4 },
  { id: "attendance", title: "Get attendance & leave ready", step: 5 },
  { id: "run", title: "Start a pay run", step: 6 },
  { id: "review", title: "Review payslips", step: 7 },
  { id: "adjustments", title: "Adjustments", step: 8 },
  { id: "approve", title: "Approve", step: 9 },
  { id: "pay", title: "Export & mark as paid", step: 10 },
  { id: "calculation", title: "How pay is calculated" },
  { id: "example", title: "A full worked payslip" },
  { id: "tax", title: "Tax on salary & NSSF" },
  { id: "mistakes", title: "Fixing mistakes" },
  { id: "warnings", title: "Warnings explained" },
  { id: "faq", title: "Questions" },
  { id: "glossary", title: "Words used" },
];

export default function PayrollDocsPage() {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 py-8 sm:px-6">
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-64 shrink-0 overflow-y-auto lg:block">
        <Toc entries={TOC} />
      </aside>

      <main className="min-w-0 flex-1">
        <Link href="/docs-cthh5ueij8" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All docs
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Payroll</h1>
        <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
          Everything about paying your staff in Business OS: what to set up once, what to do every pay period, and exactly how each amount is worked out.
        </p>

        <div className="mt-6 rounded-lg border border-border p-4 lg:hidden">
          <Toc entries={TOC} />
        </div>

        <div className="mt-10 flex flex-col gap-14">
          {/* ───────────────────────────── Overview ───────────────────────────── */}
          <Section id="overview" title="How payroll works">
            <P>
              Payroll turns three things into a payslip for each person: their <b>salary</b>, their <b>attendance and leave</b>, and your company&apos;s <b>pay rules</b>. You set the rules and
              salaries up once. After that, every pay period is the same four moves:
            </P>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Calculate", "Start a pay run for a group and period."],
                ["Check", "Look at every payslip, fix what's wrong."],
                ["Approve", "Freeze the numbers and lock attendance."],
                ["Pay", "Export for the bank, mark as paid."],
              ].map(([t, d], i) => (
                <div key={t} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-primary">{i + 1}</p>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
            <P>
              Every line on a payslip says how it was worked out (for example <i>&ldquo;45 min × 0.0417&rdquo;</i>), so any amount can be explained to the employee.
            </P>
          </Section>

          {/* ───────────────────────────── Before ───────────────────────────── */}
          <Section id="before" title="Before you start">
            <Bullets
              items={[
                <>
                  Your plan must include the <b>Payroll</b> module. Without it the payroll pages don&apos;t appear.
                </>,
                <>Employees and their attendance should already be in the system — payroll reads attendance, it doesn&apos;t replace it.</>,
                <>Decide who does what. Five permissions control payroll:</>,
              ]}
            />
            <Table
              head={["Permission", "Allows", "Given to"]}
              rows={[
                [<b key="a">payroll.view</b>, "See pay runs, payslips, adjustments and payroll settings.", "Company admin"],
                [<b key="b">payroll.manage</b>, "Prepare payroll: settings, pay groups, start/recalculate/delete runs, adjustments, mark as paid.", "Company admin"],
                [<b key="e">payroll.approve</b>, "Approve pay runs (sign them off). Nothing else.", "Company admin"],
                [<b key="c">salary.view</b>, "See salaries and the Pay tab on employees.", "Set per role"],
                [<b key="d">salary.manage</b>, "Change salaries, pay groups, tax details and allowances of employees.", "Set per role"],
              ]}
            />
            <P>
              Permissions are given to roles under <Path>Roles</Path> (on the Payroll card: View, Manage, Approve).
            </P>
            <H3>Example: HR prepares, a manager approves</H3>
            <Table
              head={["Role", "Payroll permissions", "What they do"]}
              rows={[
                ["HR office", "View + Manage (+ salary.view / salary.manage)", "Set up pay, start and recalculate runs, fix problems, add adjustments, export, mark as paid. Can't approve."],
                ["Manager / director", "View + Approve", "Open runs and payslips, check them, click Approve. Can't change anything."],
              ]}
            />
            <Steps
              items={[
                <>
                  <Path>Roles → Add role</Path> &ldquo;HR office&rdquo;: tick Payroll <b>View</b> and <b>Manage</b> (not Approve), and Salary View/Manage. Assign it to the HR staff.
                </>,
                <>
                  Edit the manager&apos;s role: tick Payroll <b>View</b> and <b>Approve</b>.
                </>,
                <>
                  Check other roles: any role with Payroll <b>Approve</b> can sign off runs — untick it where it isn&apos;t wanted.
                </>,
              ]}
            />
            <P>
              Each run records who approved it and when. If an approver finds a problem, they tell HR, who fixes it and recalculates; the approver then approves the new numbers.
            </P>
          </Section>

          {/* ───────────────────────────── Step 1 ───────────────────────────── */}
          <Section id="settings" step={1} title="Company pay settings" intro="How day and hour rates are worked out, and a few company-wide choices.">
            <P>
              Open <Path>Payroll Settings</Path>. The first time, everything is filled with sensible defaults. The quickest start is a <b>preset</b>:
            </P>
            <Table
              head={["Preset", "What it sets"]}
              rows={[
                ["Office standard", "26-day month; late arrival and early leave charged per minute after 10 minutes' grace; overtime 150% / 200%; absence = one day's pay."],
                ["Factory standard", "26-day month; every 3 late arrivals cost one day's pay; early leave per minute; overtime 150% / 200%; attendance bonus ready to fill in."],
              ]}
            />
            <P>Then check the card &ldquo;How pay is worked out&rdquo;:</P>
            <Table
              head={["Setting", "Choices", "Meaning"]}
              rows={[
                [
                  "Daily rate",
                  "Fixed days (default 26) · Days in the period · Scheduled work days",
                  "How a monthly salary becomes a day's pay. 26 is the most common in Cambodia: $520 ÷ 26 = $20 a day.",
                ],
                ["Hours in a work day", "1–24 (default 8)", "Hourly rate = daily rate ÷ these hours. Used for overtime and lateness."],
                [
                  "A day with a missing scan",
                  "Must be fixed (recommended) · Counts as worked · Counts as absent",
                  "“Must be fixed” stops approval until someone corrects the scan in Attendance.",
                ],
                ["Fallback exchange rate", "KHR per USD, e.g. 4100", "Used for tax and NSSF on dollar salaries only when the official monthly rate isn't published yet."],
                ["Round riel net pay to", "Exact · 100 · 500 · 1,000 ៛", "Riel salaries are rounded to this; dollar salaries to the cent."],
                ["Pay daily-paid staff for public holidays", "On / off", "Required by the Labour Law — keep it on unless your accountant says otherwise."],
              ]}
            />
            <Note>Pay groups (step 3) can override any of these for their own people. Anything a group leaves as &ldquo;Company setting&rdquo; uses this card.</Note>
          </Section>

          {/* ───────────────────────────── Step 2 ───────────────────────────── */}
          <Section id="components" step={2} title="Pay components (rules)" intro="Every line a payslip can have, and how it is worked out.">
            <P>
              The list at the bottom of <Path>Payroll Settings</Path> holds your components. The built-in ones can be tuned or switched off but not deleted:
            </P>
            <Table
              head={["Component", "Type", "Worked out from"]}
              rows={[
                ["Base salary", "Earning", "The salary (see How pay is calculated)."],
                ["Overtime", "Earning", "Approved overtime hours × hourly rate × 150% (work day) or 200% (day off, holiday). The law doesn't allow less."],
                ["Attendance bonus", "Earning", "A fixed amount when absences and late arrivals stay within limits you set. Off until you switch it on."],
                ["Absence", "Deduction", "Absent days × daily rate × charge % (100% = one day). Monthly salaries only."],
                ["Unpaid leave", "Deduction", "Unpaid leave days × daily rate. Partly paid leave is charged only for the unpaid part. Monthly salaries only."],
                ["Late arrival", "Deduction", "Your chosen lateness rule (below)."],
                ["Early leave", "Deduction", "Same choices as late arrival."],
                ["Unpaid permission", "Deduction", "Approved late/early permission that isn't paid: minutes × minute rate."],
              ]}
            />
            <H3>Lateness and early-leave rules</H3>
            <Table
              head={["Rule", "How it charges", "Example (daily rate $20, 8 h)"]}
              rows={[
                ["Per minute", "Every minute after a daily grace costs the minute rate.", "Late 12 and 40 min, 10 min grace → 2 + 30 = 32 min × $0.0417 = $1.33"],
                ["Fixed amount each time", "The same amount every time, with some free each pay period.", "4 times, 2 free, $1 each → (4 − 2) × $1 = $2.00"],
                ["Every few times = one day", "Each N late arrivals cost a day's pay.", "Every 3 → 4 times = 1 day = $20.00"],
                ["Tiers by minutes", "Each late day is charged by how late it was.", "≤10 min $0.50, ≤30 min $1, longer ½ day"],
                ["Not charged", "Shown in attendance, never deducted.", "—"],
              ]}
            />
            <H3>Add your own</H3>
            <Steps
              items={[
                <>
                  Click <Path>Add component</Path>.
                </>,
                <>
                  Choose the type: <b>Earning</b> (added to pay), <b>Deduction</b> (taken off before tax) or <b>After-tax deduction</b> (taken off net pay — advances, loans).
                </>,
                <>
                  Choose how it is set: <b>amount set on each employee</b> (transport, phone, loan repayment) or a <b>rule from attendance</b>.
                </>,
                <>Tick whether it counts for tax on salary and for NSSF.</>,
                <>
                  Under <b>Try it on an employee</b>, pick someone and a month and click <b>Preview</b> to see the rule on their real payslip — nothing is saved until you click Save.
                </>,
              ]}
            />
          </Section>

          {/* ───────────────────────────── Step 3 ───────────────────────────── */}
          <Section id="groups" step={3} title="Pay groups & periods" intro="Who is paid when, and by which rules.">
            <P>
              A <b>pay group</b> is a set of people paid on the same schedule by the same rules — for example &ldquo;Office staff&rdquo; once a month and &ldquo;Factory workers&rdquo; twice a
              month. Every pay run pays <b>one group for one period</b>. Every company starts with a default group called <b>Monthly</b> (1st → end of month); anyone you never put in a
              group is in it.
            </P>
            <H3>Schedules</H3>
            <Table
              head={["Schedule", "You choose", "Example periods", "A $520 monthly salary pays"]}
              rows={[
                ["Once a month", "The day each period ends (any day 1–31)", "Day 31: 1 – 30 Sep · Day 20: 21 Aug – 20 Sep · Day 25: 26 Aug – 25 Sep", "$520 per period"],
                ["Twice a month", "Two end days, at least a week apart", "15 & 31: 1–15, 16–30 Sep · 5 & 20: 21 Aug – 5 Sep, 6 – 20 Sep", "$260 per period (½)"],
                ["Every week", "The first day of any one week", "From a Monday: 28 Sep – 4 Oct, 5 – 11 Oct", "$120 per period (12/52)"],
                ["Every 2 weeks", "The first day of any one period", "From Monday 7 Sep: 7 – 20 Sep, 21 Sep – 4 Oct", "$240 per period (12/26)"],
                ["Dates picked each time", "Nothing — HR enters From and To on each run (max 62 days)", "10 Sep – 5 Oct", "The share of each month covered: 21/30 + 5/31 ≈ 0.86 × $520"],
              ]}
            />
            <Bullets
              items={[
                <>Periods may cross months and years. That is normal for cut-off days like 20 or 25.</>,
                <>Short months: a cut-off of 29, 30 or 31 ends on the last day of February, and the next period starts on 1 March.</>,
                <>
                  <b>Twice a month vs every 2 weeks:</b> twice a month always gives 24 runs a year on the same dates; every 2 weeks gives 26 runs on the same weekday, so two months a year
                  have three runs. Use twice a month for monthly salaries, every 2 weeks mainly for daily-paid workers.
                </>,
              ]}
            />
            <H3>Create a group</H3>
            <Steps
              items={[
                <>
                  <Path>Payroll Settings → Pay groups → Add group</Path>.
                </>,
                <>Name it and choose the schedule and its days. The dialog shows the resulting periods (e.g. &ldquo;21st → 20th&rdquo;).</>,
                <>
                  Optional — <b>this group&apos;s own settings</b>: daily rate, hours per day, missing-scan rule, holiday pay. Leave &ldquo;Company setting&rdquo; to follow step 1.
                </>,
                <>
                  Optional — <b>pay rules for this group</b>: for each component choose <i>As the company</i>, <i>Off</i>, or <i>Own rule</i> (e.g. stricter lateness for the factory).
                  Other groups are not affected.
                </>,
                <>
                  Optional — <b>prepare automatically</b>: when a period ends, its pay run is created and calculated by itself. A person still checks and approves it.
                </>,
                <>Optional — make it the <b>default group</b> (people not put in any group are paid with it).</>,
              ]}
            />
            <Note variant="warning" title="A group pays only its members">
              Creating a group doesn&apos;t move anyone into it. A run for a group nobody is in has no payslips — the run says so. Put people in the group first (step 4).
            </Note>
            <P>
              Changing a group&apos;s schedule is only allowed when it has no open runs; the new schedule starts with the period after its last run. A group can be deleted only if it never
              had members or runs.
            </P>
          </Section>

          {/* ───────────────────────────── Step 4 ───────────────────────────── */}
          <Section id="employees" step={4} title="Set up each employee" intro="Open the employee → Pay tab. Four cards, top to bottom.">
            <H3>Pay group</H3>
            <Steps
              items={[
                <>
                  Click <Path>Change group</Path>, pick the group and the date it starts.
                </>,
                <>
                  If the date is inside a period, each group pays only its own days: e.g. moving from Monthly to Twice a month on 16 Sep → September&apos;s monthly run pays 15/30 of the salary,
                  the 16–30 Sep run pays the other half. Nobody is paid twice or missed.
                </>,
                <>
                  You can&apos;t move someone on or before the last day they were already paid (&ldquo;paid through&rdquo;). The latest change can be undone with the bin icon.
                </>,
              ]}
            />
            <P>New employees: the &ldquo;Add employee&rdquo; form has a Pay group choice, starting from their hire date.</P>
            <H3>Salary</H3>
            <Steps
              items={[
                <>
                  Click <Path>Set salary</Path> (or <Path>Change salary</Path>).
                </>,
                <>
                  Enter the amount and currency (USD or KHR), and whether it is <b>per month</b> or <b>per day worked</b>.
                </>,
                <>
                  Choose <b>From</b> (the date it starts) and a reason: Starting salary, Probation passed, Promotion, Annual increase, Other change, Correction.
                </>,
              ]}
            />
            <Bullets
              items={[
                <>Every change is kept. Each period is paid at the salary it had; a raise in the middle of a period is split by days.</>,
                <>A future date is marked &ldquo;Upcoming&rdquo; and applies by itself when it arrives.</>,
                <>The same start date again corrects that row instead of adding a new one. Only the latest salary can be removed.</>,
                <>Days already paid by an approved run can&apos;t get a different salary — use an adjustment instead.</>,
                <>People without a salary are left out of pay runs, and each run lists them at the top.</>,
              ]}
            />
            <H3>Allowances and deductions</H3>
            <P>
              Fixed <b>monthly</b> amounts set per person — transport, phone, a loan repayment — with start and optional end dates. A twice-a-month period pays half of the monthly amount, a
              weekly one 12/52. The types come from components &ldquo;set on each employee&rdquo; (step 2).
            </P>
            <H3>Tax, NSSF and payment</H3>
            <Table
              head={["Field", "Effect"]}
              rows={[
                ["Tax resident of Cambodia", "Residents pay progressive tax with dependent allowances; non-residents a flat 20%."],
                ["Enrolled in NSSF", "Off = no NSSF contributions for this person."],
                ["Spouse doesn't work / dependent children", "Each dependent lowers the taxable salary (150,000 ៛ each by default)."],
                ["Paid by / account holder", "Bank transfer or cash; shown in the export for the bank. Bank name and number are on the Profile tab."],
              ]}
            />
          </Section>

          {/* ───────────────────────────── Step 5 ───────────────────────────── */}
          <Section id="attendance" step={5} title="Get attendance & leave ready" intro="Payroll reads attendance; mistakes there become mistakes in pay.">
            <Table
              head={["From attendance & leave", "Becomes on the payslip"]}
              rows={[
                ["Absent days (work day, no scans, no leave)", "Absence deduction"],
                ["Late minutes per day", "Late arrival deduction (by your rule)"],
                ["Early-leave minutes per day", "Early leave deduction"],
                ["Approved overtime (work day / day off / holiday)", "Overtime earning — pending overtime is NOT paid"],
                ["Days with a missing scan", "Blocks approval, or counts as worked/absent (your setting)"],
                ["Unpaid leave, and the unpaid part of partly paid leave", "Unpaid leave deduction"],
                ["Paid leave", "No deduction; daily-paid staff are paid for it"],
                ["Approved permission that isn't paid", "Unpaid permission deduction"],
                ["Days worked, public holidays (daily-paid staff)", "Base pay"],
              ]}
            />
            <H3>Checklist before calculating</H3>
            <Bullets
              items={[
                <>Missing scans corrected (Attendance → review).</>,
                <>Overtime approved or rejected — pending overtime shows as a note and isn&apos;t paid.</>,
                <>Leave requests for the period approved. Paid leave can&apos;t go over the balance; extra days must be requested as Unpaid leave.</>,
                <>New joiners have a hire date and salary; leavers have their status and last day set.</>,
              ]}
            />
          </Section>

          {/* ───────────────────────────── Step 6 ───────────────────────────── */}
          <Section id="run" step={6} title="Start a pay run">
            <Steps
              items={[
                <>
                  <Path>Pay runs → New pay run</Path>.
                </>,
                <>
                  Choose the <b>pay group</b>. The dialog shows how many people are in it now and what a run pays (e.g. &ldquo;half of the monthly salary&rdquo;).
                </>,
                <>
                  Choose the <b>period</b> from the list (newest first; periods that already have a run are greyed out). For &ldquo;Dates picked each time&rdquo; enter From and To.
                </>,
                <>
                  Click <Path>Calculate pay</Path>. Every payslip is worked out immediately and the run opens with status <b>In review</b>.
                </>,
              ]}
            />
            <Bullets
              items={[
                <>Only one run per group per period; runs of the same group can never overlap.</>,
                <>A period that hasn&apos;t ended can be calculated as a preview, but not approved until it is over.</>,
                <>Different groups are independent: the factory&apos;s 1–15 Oct run and the office&apos;s October run don&apos;t affect each other.</>,
              ]}
            />
          </Section>

          {/* ───────────────────────────── Step 7 ───────────────────────────── */}
          <Section id="review" step={7} title="Review payslips">
            <P>The run page shows totals per currency (USD and KHR are never added together) and one row per person.</P>
            <Table
              head={["In the Check column", "Meaning", "What to do"]}
              rows={[
                ["OK", "Nothing to look at.", "—"],
                ["Note", "Something worth knowing, e.g. pending overtime.", "Open it; act if needed."],
                ["Needs fixing", "Something blocks approval, e.g. a missing scan.", "Open the payslip to see why, fix it (usually in Attendance), then recalculate."],
                ["Recalculate", "This person's attendance, salary or adjustments changed after the calculation.", "Click it — only that person is recalculated."],
              ]}
            />
            <P>Click a row to open the payslip. It shows:</P>
            <Bullets
              items={[
                <>Earnings, deductions, NSSF and tax, after-tax deductions — each with how it was worked out.</>,
                <>Gross, net, and the total cost to the company.</>,
                <>The facts it used: days worked, absences, missing scans, late arrivals, daily and hourly rate, exchange rate.</>,
                <>For periods crossing months: gross split by month (by day), for monthly reports.</>,
              ]}
            />
            <H3>When something changes</H3>
            <P>
              If anything a run uses changes after you calculated it, a yellow banner appears. When only some people are affected it names them and <b>Recalculate these</b> updates just
              them; when a shared thing changed (a rule, the group, who is in it) recalculate everyone. A run can&apos;t be approved while it is out of date.
            </P>
          </Section>

          {/* ───────────────────────────── Step 8 ───────────────────────────── */}
          <Section id="adjustments" step={8} title="Adjustments" intro="One-off amounts your rules don't cover.">
            <Table
              head={["Type", "Use for", "Effect"]}
              rows={[
                ["Earning", "Bonus, commission, back pay", "Added to gross (tick whether it counts for tax/NSSF)"],
                ["Deduction", "Penalty, damage", "Taken off before tax"],
                ["After-tax deduction", "Salary advance, loan", "Taken off net pay"],
              ]}
            />
            <H3>Add one</H3>
            <Steps
              items={[
                <>
                  <Path>Adjustments → Add adjustment</Path>.
                </>,
                <>Apply to one employee, a whole branch, or everyone (each person gets their own row you can remove separately).</>,
                <>
                  Pick the <b>date</b>. The adjustment goes into the pay run whose period holds that date, in each person&apos;s own group.
                </>,
                <>Enter the name shown on the payslip, the amount (in each person&apos;s salary currency) and an optional reason.</>,
                <>Recalculate the run (the run will show it is out of date until you do).</>,
              ]}
            />
            <Calc
              title="Which run gets it — cut-off-20 group"
              rows={[
                ["Dated 15 Sep", "21 Aug – 20 Sep run"],
                ["Dated 25 Sep", "21 Sep – 20 Oct run"],
              ]}
            />
            <H3>Import from Excel</H3>
            <P>
              <Path>Adjustments → Import from Excel</Path> — download the template, fill one row per amount, upload. Columns: Employee ID (or Employee name), Date (optional — empty uses
              the date shown), Type, Name on payslip, Amount, Taxable (Yes/No), Reason. Rows that can&apos;t be matched are reported, not guessed. Importing the same file twice adds them twice.
            </P>
            <P>Adjustments can&apos;t be dated in a period already approved for that person — date them in the next period.</P>
          </Section>

          {/* ───────────────────────────── Step 9 ───────────────────────────── */}
          <Section id="approve" step={9} title="Approve">
            <P>
              A person with Payroll <b>Approve</b> clicks <Path>Approve</Path> once the period is over and nothing blocks. People who only prepare runs don&apos;t see the button. The system
              recalculates one last time, so what is approved is exactly what was checked, then:
            </P>
            <Bullets
              items={[
                <>The run and its payslips are frozen — no recalculation, no deleting.</>,
                <>
                  Attendance used by it is <b>locked for those people, for those days only</b>: no scans, corrections, leave or roster changes there. Other people and other days stay open.
                </>,
                <>Their salary and pay group can&apos;t change on or before the last paid day; adjustments can&apos;t be dated in that period.</>,
                <>The approval is recorded in the audit log.</>,
              ]}
            />
            <P>Approval is refused while: the period isn&apos;t over, the run is out of date, nobody is in it, or any payslip &ldquo;Needs fixing&rdquo;.</P>
          </Section>

          {/* ───────────────────────────── Step 10 ───────────────────────────── */}
          <Section id="pay" step={10} title="Export & mark as paid">
            <Steps
              items={[
                <>
                  <Path>Export CSV</Path> — one row per payslip, opens in Excel (Khmer names display correctly).
                </>,
                <>Pay your staff through the bank or in cash.</>,
                <>
                  <Path>Mark as paid</Path> — records who paid and when.
                </>,
              ]}
            />
            <P>
              CSV columns: Employee ID, Employee, Period start, Period end, Currency, Base salary, Gross, NSSF (employee), Tax on salary, Net pay, Employer cost, Payment method, Bank,
              Account number, Account name.
            </P>
          </Section>

          {/* ───────────────────────────── Calculation ───────────────────────────── */}
          <Section id="calculation" title="How pay is calculated" intro="The exact order and formulas, so any payslip can be checked by hand.">
            <Formula>rates → base pay → earnings & deductions → gross → NSSF & tax → after-tax deductions → net</Formula>

            <H3>1. Rates</H3>
            <Table
              head={["Daily rate setting", "Daily rate", "Example $520, twice a month (15-day period, 13 work days)"]}
              rows={[
                ["Fixed days (26)", "monthly salary ÷ 26", "$20.00"],
                ["Days in the period", "period salary ÷ days in the period", "$260 ÷ 15 = $17.33"],
                ["Scheduled work days", "period salary ÷ person's scheduled work days in the period", "$260 ÷ 13 = $20.00"],
              ]}
            />
            <Formula>hourly rate = daily rate ÷ hours per day · minute rate = hourly rate ÷ 60</Formula>
            <P>Daily-paid staff: the daily rate is their salary.</P>

            <H3>2. Base pay — monthly salary</H3>
            <Formula>base = monthly salary × share of the group × (days paid ÷ days in the period)</Formula>
            <Table
              head={["Group", "Share"]}
              rows={[
                ["Once a month", "1"],
                ["Twice a month", "1/2"],
                ["Every week", "12/52"],
                ["Every 2 weeks", "12/26"],
                ["Dates picked each time", "days in each month covered ÷ days of that month, added up"],
              ]}
            />
            <P>
              &ldquo;Days paid&rdquo; is the whole period unless the person joined, left, changed group or changed salary inside it. A full period reads &ldquo;Full month&rdquo; or e.g.
              &ldquo;520.00 × 1/2&rdquo;.
            </P>
            <Calc
              title="Joined on 11 Sep, raise from 21 Sep (monthly group, 30-day September)"
              rows={[
                ["$300 × 10/30 days (11–20 Sep)", "$100.00"],
                ["$450 × 10/30 days (21–30 Sep)", "$150.00"],
              ]}
              total={["Base salary", "$250.00"]}
            />

            <H3>3. Base pay — daily-paid staff</H3>
            <Formula>base = (days worked + public holidays + paid leave days) × daily salary</Formula>
            <P>They are never charged absence — an unworked day is simply not paid. Absence and unpaid-leave rules apply to monthly salaries only.</P>

            <H3>4. Earnings and deductions from attendance</H3>
            <Table
              head={["Line", "Formula"]}
              rows={[
                ["Overtime", "hours × hourly rate × 150% (work day) / 200% (day off) / 200% (holiday) — approved overtime only"],
                ["Attendance bonus", "the amount, if absences ≤ limit and late arrivals ≤ limit"],
                ["Absence", "absent days × daily rate × charge %"],
                ["Unpaid leave", "(leave days × unpaid part) × daily rate — a 50%-paid day counts ½"],
                ["Late / early leave", "your rule (step 2), counted per day inside the period"],
                ["Unpaid permission", "unpaid excused minutes × minute rate"],
                ["Allowances (per person)", "monthly amount × share of the group"],
                ["Adjustments", "as entered, if dated inside the period"],
              ]}
            />

            <H3>5. Gross, net and cost</H3>
            <Formula>gross = earnings − deductions</Formula>
            <Formula>net = gross − NSSF (employee) − tax on salary − after-tax deductions</Formula>
            <Formula>cost to the company = gross + NSSF (employer)</Formula>
            <P>Dollar amounts round to the cent; riel net pay rounds to your setting (e.g. nearest 100 ៛). If deductions are larger than pay, the payslip is flagged and gross is set to 0.</P>
          </Section>

          {/* ───────────────────────────── Example ───────────────────────────── */}
          <Section id="example" title="A full worked payslip" intro="Sokha, $520 a month, monthly group, September (exchange rate 4,100 ៛).">
            <P>Attendance: 1 absent day; late 20 and 25 minutes; 6 h approved overtime on a work day and 4 h on a day off; transport allowance $20. Rules: Office standard without grace.</P>
            <P className="text-sm text-muted-foreground">Rates: daily $520 ÷ 26 = $20 · hourly $20 ÷ 8 = $2.50 · minute $0.0417</P>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Calc
                title="Earnings and deductions"
                rows={[
                  ["Base salary — full month", "+ $520.00"],
                  ["Overtime — 6 h × 2.5 × 150% + 4 h × 2.5 × 200%", "+ $42.50"],
                  ["Transport", "+ $20.00"],
                  ["Absence — 1 day × 20", "− $20.00"],
                  ["Late arrival — 45 min × 0.0417", "− $1.88"],
                ]}
                total={["Gross", "$560.62"]}
              />
              <Calc
                title="NSSF, tax and net"
                rows={[
                  ["NSSF pension (employee) — 1,200,000 ៛ cap × 2% = 24,000 ៛ ÷ 4,100", "− $5.85"],
                  ["Tax on salary — 2,298,542 ៛ taxable → 54,854 ៛ ÷ 4,100", "− $13.38"],
                ]}
                total={["Net pay", "$541.39"]}
                note="Employer NSSF (pension 2%, health 2.6%, occupational risk 0.8% of 1,200,000 ៛) = $15.80 → cost to the company $576.42."
              />
            </div>
            <Calc
              title="Tax worked out (riel, resident, no dependents)"
              rows={[
                ["First 1,500,000 ៛ at 0%", "0"],
                ["1,500,001 – 2,000,000 at 5%", "25,000"],
                ["2,000,001 – 2,298,542 at 10%", "29,854"],
              ]}
              total={["Tax on salary", "54,854 ៛"]}
            />
          </Section>

          {/* ───────────────────────────── Tax ───────────────────────────── */}
          <Section id="tax" title="Tax on salary & NSSF">
            <Note variant="warning" title="Only for 1st → end-of-month periods, for now">
              Tax and NSSF are monthly by law. They are worked out only when a run covers exactly one calendar month. Runs for other periods (cut-off 20, twice a month, weekly, custom) say
              &ldquo;Tax and NSSF not included&rdquo; — handle them outside payroll until this is added. Each payslip already stores its gross split by month for when it is.
            </Note>
            <H3>NSSF</H3>
            <Bullets
              items={[
                <>Insured wage = gross that counts for NSSF, in riel, kept between 400,000 ៛ and 1,200,000 ៛.</>,
                <>Employee: pension 2%. Employer: pension 2% + health 2.6% + occupational risk 0.8% (not taken from the employee).</>,
                <>Only for people &ldquo;Enrolled in NSSF&rdquo;.</>,
              ]}
            />
            <H3>Tax on salary</H3>
            <Table
              head={["Monthly taxable salary (riel)", "Rate"]}
              rows={[
                ["0 – 1,500,000", "0%"],
                ["1,500,001 – 2,000,000", "5%"],
                ["2,000,001 – 8,500,000", "10%"],
                ["8,500,001 – 12,500,000", "15%"],
                ["Over 12,500,000", "20%"],
              ]}
            />
            <Bullets
              items={[
                <>Taxable salary = earnings that count for tax − deductions, converted to riel.</>,
                <>Residents: 150,000 ៛ off per dependent (a spouse who doesn&apos;t work, each child). Non-residents: flat 20%, no allowances.</>,
                <>
                  Dollar salaries use the official monthly tax exchange rate, or your fallback rate if it isn&apos;t published. Without either, the payslip is blocked.
                </>,
              ]}
            />
            <Calc
              title="Riel salary 2,000,050 ៛, spouse + 1 child"
              rows={[
                ["NSSF 2% of 1,200,000 ៛ cap", "− 24,000"],
                ["Tax: 2,000,050 − 2 × 150,000 = 1,700,050 → 5% of 200,050", "− 10,003"],
                ["2,000,050 − 24,000 − 10,003 = 1,966,047, rounded to 100", ""],
              ]}
              total={["Net pay", "1,966,000 ៛"]}
            />
            <Note>These rates are kept by the platform and shipped as a starting point — have your accountant confirm them before paying anyone.</Note>
          </Section>

          {/* ───────────────────────────── Mistakes ───────────────────────────── */}
          <Section id="mistakes" title="Fixing mistakes">
            <Table
              head={["Situation", "What to do"]}
              rows={[
                ["Before approval", "Fix the cause (attendance, salary, rule), then recalculate — the whole run, or only the people listed."],
                ["Wrong run started", "Delete it (only possible before approval) and start again."],
                ["After approval: someone was underpaid", "Add an Earning adjustment dated in the next period, e.g. “Back pay: overtime 12 Sep”."],
                ["After approval: someone was overpaid", "Add a Deduction (or After-tax deduction) dated in the next period, with the reason."],
                ["Attendance on a paid day was wrong", "It stays locked; correct the pay with an adjustment in the next period."],
                ["Salary raise was entered late", "Enter it from the first unpaid day, and add back pay for the paid days as an adjustment."],
              ]}
            />
          </Section>

          {/* ───────────────────────────── Warnings ───────────────────────────── */}
          <Section id="warnings" title="Warnings explained">
            <Table
              head={["Message (short)", "Blocks approval?", "Fix"]}
              rows={[
                ["Nobody is in this group for these dates", "Yes", "Put employees in the group (Pay tab → Change group), or run their current group."],
                ["The period isn't over yet", "Yes", "Wait until the day after the period ends; the numbers are a preview."],
                ["Days have a missing scan", "Yes", "Correct the scans in Attendance, or change the missing-scan setting."],
                ["Deductions are larger than the pay", "Yes", "Check attendance (e.g. wrong absences) and the rules."],
                ["Net pay is below zero", "Yes", "Usually a large after-tax deduction — reduce or move it."],
                ["No tax exchange rate", "Yes", "Set a fallback exchange rate in Payroll Settings."],
                ["Tax on salary rates are not set up", "Yes", "Ask the platform admin."],
                ["Something changed since this was calculated", "Yes", "Recalculate (everyone, or the people listed)."],
                ["Employees have no salary and are left out", "No", "Set their salary if they should be paid, then recalculate."],
                ["Overtime still waiting for approval", "No", "Approve it in Attendance and recalculate, or leave it for the next period."],
                ["Salary changed currency in this period", "No", "The whole period is paid in the new currency — check it's intended."],
                ["Tax and NSSF not included", "No", "Expected for non-calendar periods; handle tax/NSSF outside payroll for now."],
              ]}
            />
          </Section>

          {/* ───────────────────────────── FAQ ───────────────────────────── */}
          <Section id="faq" title="Questions">
            {[
              ["Why is someone missing from a run?", "They have no salary for that period, they are in another pay group for those days, or they weren't employed yet / had already left."],
              ["Why does my run have no payslips at all?", "Usually nobody is in that pay group. Creating a group doesn't move anyone — use Change group on each employee."],
              ["Someone took more leave than they have?", "Paid leave can't go over the balance — the request is refused. The extra days are requested as Unpaid leave and deducted (days × daily rate)."],
              ["Can a period cross two months?", "Yes, e.g. 21 Aug – 20 Sep. Any cut-off day works; the payslip shows how the gross splits between the months."],
              ["Can we pay twice a month?", "Yes — put those people in a “Twice a month” group. Each period pays half the monthly salary and half of monthly allowances."],
              ["Can HR choose any dates?", "Yes, with a group set to “Dates picked each time”. Fixed-schedule groups always use their own periods so days are never paid twice."],
              ["Does a 31-day month pay more?", "No. A monthly salary is a fixed amount per period. Days only matter for joiners, leavers and mid-period changes."],
              ["Who can see salaries?", "Only roles with salary.view; payroll pages need payroll.view."],
              ["Can HR prepare payroll and only a manager approve it?", "Yes: give HR Payroll View + Manage, and the manager Payroll View + Approve. See “Before you start”."],
            ].map(([q, a]) => (
              <div key={q}>
                <H3>{q}</H3>
                <P>{a}</P>
              </div>
            ))}
          </Section>

          {/* ───────────────────────────── Glossary ───────────────────────────── */}
          <Section id="glossary" title="Words used">
            <Table
              head={["Word", "Meaning"]}
              rows={[
                ["Pay group", "People paid on the same schedule by the same rules."],
                ["Period", "The dates one pay run covers, e.g. 21 Aug – 20 Sep."],
                ["Cut-off day", "The day a period ends; the next starts the day after."],
                ["Pay run", "One group's pay for one period: In review → Approved → Paid."],
                ["Payslip", "One person's pay in a run, with every line explained."],
                ["Component", "A kind of payslip line and its rule (overtime, absence, transport…)."],
                ["Adjustment", "A one-off amount for a person, placed in a period by its date."],
                ["Gross", "Earnings minus deductions, before NSSF and tax."],
                ["Net", "What the employee receives."],
                ["Paid through", "The last day an approved run has paid a person for."],
                ["Daily / hourly / minute rate", "A monthly salary turned into a day's, hour's, minute's pay."],
              ]}
            />
          </Section>
        </div>
      </main>
    </div>
  );
}
