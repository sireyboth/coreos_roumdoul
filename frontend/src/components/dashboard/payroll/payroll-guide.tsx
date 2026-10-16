"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BookOpen, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/*
 * Plain-language help for payroll: a Guide button on every payroll page that
 * opens on the topic of that page, and a getting-started checklist for
 * companies that haven't run payroll yet.
 */

export type GuideTopic = "start" | "groups" | "salary" | "run" | "adjustments" | "locks" | "faq";

const TOPICS: { key: GuideTopic; title: string }[] = [
  { key: "start", title: "Getting started" },
  { key: "groups", title: "Pay groups & periods" },
  { key: "salary", title: "How pay is worked out" },
  { key: "run", title: "Running payroll" },
  { key: "adjustments", title: "Adjustments" },
  { key: "locks", title: "Approving & fixing mistakes" },
  { key: "faq", title: "Questions" },
];

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Example({ title, rows, note }: { title: string; rows: [string, string][]; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-0.5 text-sm">
          <span>{label}</span>
          <span className="shrink-0 tabular-nums">{value}</span>
        </div>
      ))}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Topic({ topic }: { topic: GuideTopic }) {
  switch (topic) {
    case "start":
      return (
        <div className="flex flex-col gap-4">
          <P>Set things up once, then each pay period is: calculate → check → approve → pay.</P>
          <Steps
            items={[
              <>
                <b>Pay groups</b> (Payroll Settings): one group per way of paying people — e.g. &ldquo;Office&rdquo; once a month, &ldquo;Factory&rdquo; twice a month. Everyone
                starts in the default &ldquo;Monthly&rdquo; group.
              </>,
              <>
                <b>Rules</b> (Payroll Settings): how lateness, absence and overtime are charged. A preset (Office / Factory) fills them in for you.
              </>,
              <>
                <b>Each employee</b> (their Pay tab): salary, pay group, tax/NSSF details, and fixed monthly allowances.
              </>,
              <>
                <b>Each period</b> (Pay runs): start a run for a group and period, check the payslips, approve, then mark as paid.
              </>,
            ]}
          />
        </div>
      );
    case "groups":
      return (
        <div className="flex flex-col gap-4">
          <P>A pay group is a set of people paid on the same days, by the same rules. Each run pays one group for one period.</P>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Example
              title="Once a month, cut-off 31"
              rows={[
                ["Periods", "1 Sep – 30 Sep"],
                ["", "1 Oct – 31 Oct"],
              ]}
            />
            <Example
              title="Once a month, cut-off 20"
              rows={[
                ["Periods", "21 Aug – 20 Sep"],
                ["", "21 Sep – 20 Oct"],
              ]}
              note="Crosses the month — that's fine. Any day from 1 to 31 works: 20, 25, 28…"
            />
            <Example
              title="Twice a month, cut-offs 15 & 31"
              rows={[
                ["Periods", "1 – 15 Sep"],
                ["", "16 – 30 Sep"],
              ]}
            />
            <Example
              title="Twice a month, cut-offs 5 & 20"
              rows={[
                ["Periods", "21 Aug – 5 Sep"],
                ["", "6 – 20 Sep"],
              ]}
              note="Both cut-offs are free to choose, at least a week apart."
            />
            <Example
              title="Every week, from a Monday"
              rows={[
                ["Periods", "28 Sep – 4 Oct"],
                ["", "5 Oct – 11 Oct"],
              ]}
            />
          </div>
          <P>
            Short months: a cut-off of 29, 30 or 31 ends on the last day of February instead, and the next period starts on 1 March. Pick &ldquo;Last day of the month&rdquo; for 1st →
            end-of-month periods.
          </P>
          <H>Moving someone to another group</H>
          <P>
            On their Pay tab, choose <b>Change group</b> and a start date. If the date falls inside a period, each group pays only its own days — nobody is paid twice or missed.
            Days already paid by an approved run can&apos;t be moved.
          </P>
          <H>A group&apos;s own rules</H>
          <P>
            A group can use its own daily rate, missing-scan rule, or its own version of a rule (e.g. stricter lateness for the factory). Anything left as &ldquo;Company
            setting&rdquo; follows Payroll Settings.
          </P>
        </div>
      );
    case "salary":
      return (
        <div className="flex flex-col gap-4">
          <P>A monthly salary is a fixed amount per period — it does not change with 28, 30 or 31 days.</P>
          <Example
            title="Salary $520 a month"
            rows={[
              ["Once a month", "$520.00 each period"],
              ["Twice a month", "$260.00 each period (1/2)"],
              ["Every week", "$120.00 each period (12/52)"],
              ["Every 2 weeks", "$240.00 each period (12/26)"],
            ]}
          />
          <Example
            title="Deductions — daily rate $520 ÷ 26 = $20"
            rows={[
              ["1 absent day", "− $20.00"],
              ["2 days unpaid leave", "− $40.00"],
              ["Half day of a 50%-paid leave", "− $5.00"],
              ["45 min late (per-minute rule)", "− $1.88"],
            ]}
            note="Hourly rate = daily rate ÷ hours in a work day; overtime is paid at 150% on work days, 200% on days off and holidays."
          />
          <Example
            title="Joined on day 11 of a 30-day period"
            rows={[["$520 × 20/30 days", "$346.67"]]}
            note="Days only count when someone joins, leaves, changes group or gets a raise inside the period."
          />
          <H>Daily-paid staff</H>
          <P>Paid for days worked + public holidays + paid leave, in any period. They are never charged for absence — they simply aren&apos;t paid for the day.</P>
          <H>Tax and NSSF</H>
          <P>
            Worked out for 1st → end-of-month periods only, for now. Other periods show &ldquo;Tax and NSSF not included&rdquo; — handle them outside payroll until this is added.
          </P>
        </div>
      );
    case "run":
      return (
        <div className="flex flex-col gap-4">
          <Steps
            items={[
              <>
                <b>New pay run</b> → pick the pay group and the period. Pay is calculated right away from salary, attendance, leave and the rules.
              </>,
              <>
                <b>Check</b> the payslips. &ldquo;Needs fixing&rdquo; means something blocks approval — usually a missing scan. Open the payslip to see why, fix it in Attendance.
              </>,
              <>
                <b>Recalculate</b>. When only some people changed, the run lists them — recalculate just those people, everyone else stays as is.
              </>,
              <>
                <b>Approve</b> once the period is over. The run is frozen and the attendance it used is locked. Only roles with Payroll &ldquo;Approve&rdquo; see this button — HR can
                prepare runs while a manager approves them.
              </>,
              <>
                <b>Export CSV</b> for the bank or accountant, pay your staff, then <b>Mark as paid</b>.
              </>,
            ]}
          />
          <H>Before approving, check</H>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Missing scans are fixed and overtime is approved (pending overtime is not paid).</li>
            <li>Leave requests for the period are approved.</li>
            <li>New joiners have a salary — people without one are listed at the top and left out.</li>
            <li>Bonuses and penalties for the period are added as adjustments.</li>
          </ul>
        </div>
      );
    case "adjustments":
      return (
        <div className="flex flex-col gap-4">
          <P>For one-off amounts the rules don&apos;t cover: a bonus, commission, penalty, back pay or an advance.</P>
          <Example
            title="Which run an adjustment goes into"
            rows={[
              ["Dated 20 Sep, cut-off-25 group", "26 Aug – 25 Sep run"],
              ["Dated 27 Sep, cut-off-25 group", "26 Sep – 25 Oct run"],
            ]}
            note="The date decides the period, in each person's own pay group."
          />
          <H>Types</H>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>
              <b>Earning</b> — added to pay (bonus, commission).
            </li>
            <li>
              <b>Deduction</b> — taken off before tax (penalty).
            </li>
            <li>
              <b>After-tax deduction</b> — taken off the net pay (salary advance, loan).
            </li>
          </ul>
          <P>Add one for a person, a branch or everyone, or import many from Excel. Recalculate the run afterwards so it is included.</P>
        </div>
      );
    case "locks":
      return (
        <div className="flex flex-col gap-4">
          <P>Approving a run freezes its payslips and locks the attendance it used — only for the people in that run, only for its days.</P>
          <H>After approval you can&apos;t</H>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>change scans, corrections, leave or rosters on those days for those people;</li>
            <li>change their salary or pay group on or before the last paid day;</li>
            <li>add adjustments dated in that period.</li>
          </ul>
          <H>Found a mistake after approving?</H>
          <P>
            Add an <b>adjustment</b> dated in the next period — e.g. &ldquo;Back pay: overtime 12 Sep&rdquo; as an earning, or &ldquo;Overpaid in September&rdquo; as a deduction.
            Before approving, just fix the cause and recalculate.
          </P>
        </div>
      );
    case "faq":
      return (
        <div className="flex flex-col gap-4">
          {[
            [
              "Why is someone missing from a run?",
              "They have no salary for that period, they're in another pay group for those days, or they weren't employed yet / had already left.",
            ],
            [
              "Why does a payslip say “Needs fixing”?",
              "Usually a day with a missing scan (when the rule is “must be fixed”), or deductions larger than the pay. Open the payslip to see the reason.",
            ],
            [
              "Someone took more leave than they have?",
              "Paid leave can't go over the balance — the request is refused. Extra days are taken as Unpaid leave and deducted (days × daily rate).",
            ],
            ["Why is a run marked as changed?", "Something it uses changed after it was calculated: attendance, a salary, an adjustment or a rule. Recalculate to include it."],
            ["Can a period cross two months?", "Yes, e.g. 26 Aug – 25 Sep. The payslip shows how the gross splits between the months."],
            ["Can we run payroll twice a month?", "Yes: put those people in a “Twice a month” pay group. Each half pays half the monthly salary."],
          ].map(([q, a]) => (
            <div key={q}>
              <H>{q}</H>
              <P>{a}</P>
            </div>
          ))}
        </div>
      );
  }
}

/** The whole guide, opening on one topic. */
export function PayrollGuideDialog({ open, onOpenChange, topic = "start" }: { open: boolean; onOpenChange: (o: boolean) => void; topic?: GuideTopic }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4" /> Payroll guide
          </DialogTitle>
          <DialogDescription>
            How payroll works here, in plain words.{" "}
            <Link href="/docs-cthh5ueij8/payroll" target="_blank" className="text-primary underline-offset-4 hover:underline">
              Full step-by-step docs ↗
            </Link>
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so every opening starts on the topic it was opened for. */}
        <GuideBody key={open ? topic : "closed"} topic={topic} />
      </DialogContent>
    </Dialog>
  );
}

function GuideBody({ topic }: { topic: GuideTopic }) {
  const [current, setCurrent] = useState(topic);

  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TOPICS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={current === t.key}
            onClick={() => setCurrent(t.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              current === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="pt-1">
        <Topic topic={current} />
      </div>
    </>
  );
}

/** A "Guide" button for a page header, opening on that page's topic. */
export function PayrollGuideButton({ topic }: { topic: GuideTopic }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BookOpen className="size-4" />
        Guide
      </Button>
      <PayrollGuideDialog open={open} onOpenChange={setOpen} topic={topic} />
    </>
  );
}

const DISMISS_KEY = "payroll-getting-started-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The setup steps with what is already done ticked off. Shown on Pay runs
 * until the first run is approved, or until it is dismissed on this device.
 */
export function GettingStartedCard({ groupsCount, hasRuns, hasApprovedRun }: { groupsCount: number; hasRuns: boolean; hasApprovedRun: boolean }) {
  // Hidden while rendering on the server (no storage there), then whatever this device chose.
  const stored = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    readDismissed,
    () => true,
  );
  const [hiddenNow, setHiddenNow] = useState(false);
  const [guide, setGuide] = useState<GuideTopic | null>(null);

  if (stored || hiddenNow || hasApprovedRun) return null;

  function dismiss() {
    setHiddenNow(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: it just shows again next time.
    }
  }

  const steps: {
    title: string;
    text: string;
    href?: string;
    link?: string;
    done?: boolean;
    topic: GuideTopic;
  }[] = [
    {
      title: "Set up pay groups",
      text: "Who is paid once a month, twice a month or weekly.",
      href: "/dashboard/payroll/settings",
      link: "Payroll Settings",
      done: groupsCount > 1,
      topic: "groups",
    },
    {
      title: "Check the pay rules",
      text: "Lateness, absence, overtime — or apply a preset.",
      href: "/dashboard/payroll/settings",
      link: "Payroll Settings",
      topic: "salary",
    },
    {
      title: "Set each employee's salary and group",
      text: "On every employee's Pay tab.",
      href: "/dashboard/employees",
      link: "Employees",
      topic: "groups",
    },
    {
      title: "Start your first pay run",
      text: "Pick a group and a period, then check the payslips.",
      done: hasRuns,
      topic: "run",
    },
    {
      title: "Approve and pay",
      text: "Approve, export for the bank, mark as paid.",
      done: hasApprovedRun,
      topic: "locks",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Getting started with payroll</CardTitle>
          <CardDescription>Five steps to your first pay run. Click &ldquo;How?&rdquo; on any step for an explanation.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" aria-label="Hide getting started" onClick={dismiss}>
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y divide-border">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  s.done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through")}>{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.text}
                  {s.href && (
                    <>
                      {" "}
                      <Link href={s.href} className="text-primary underline-offset-4 hover:underline">
                        {s.link}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setGuide(s.topic)}>
                How?
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
      <PayrollGuideDialog open={guide !== null} onOpenChange={(o) => !o && setGuide(null)} topic={guide ?? "start"} />
    </Card>
  );
}
