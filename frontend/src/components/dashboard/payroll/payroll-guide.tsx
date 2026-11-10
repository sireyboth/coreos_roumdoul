"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Lock,
  PlayCircle,
  Rocket,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/*
 * Plain-language help for payroll: a Guide button on every payroll page that
 * opens on the topic of that page, and a getting-started checklist for
 * companies that haven't run payroll yet.
 */

export type GuideTopic = "start" | "groups" | "salary" | "run" | "adjustments" | "locks" | "faq";

/** The topics in reading order, each with its icon and colour (side menu and heading). */
const TOPICS: { key: GuideTopic; icon: LucideIcon; tone: string }[] = [
  { key: "start", icon: Rocket, tone: "from-sky-500 to-indigo-500" },
  { key: "groups", icon: Users, tone: "from-violet-500 to-fuchsia-500" },
  { key: "salary", icon: Wallet, tone: "from-emerald-500 to-teal-500" },
  { key: "run", icon: PlayCircle, tone: "from-amber-400 to-orange-500" },
  { key: "adjustments", icon: ArrowUpDown, tone: "from-rose-500 to-pink-500" },
  { key: "locks", icon: Lock, tone: "from-slate-500 to-slate-700" },
  { key: "faq", icon: CircleHelp, tone: "from-cyan-500 to-blue-500" },
];

/** Numbered steps, each on its own soft row. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3.5 rounded-xl border border-border bg-card px-4 py-3 text-[15px] leading-relaxed">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** A worked example: a titled card of "label … value" rows. */
function Example({ title, rows, note }: { title: string; rows: [string, string][]; note?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <p className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-semibold">{title}</p>
      <div className="px-4 py-2.5">
        {rows.map(([label, value]) => (
          <div key={`${label}|${value}`} className="flex items-baseline justify-between gap-4 py-1 text-[15px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="shrink-0 font-medium tabular-nums">{value}</span>
          </div>
        ))}
        {note && (
          <p className="mt-1.5 flex gap-1.5 text-sm text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/** Bullet lists inside a topic: same size and colour as the paragraphs. */
const LIST = "flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-foreground/80 marker:text-primary";

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-1 text-base font-semibold">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-foreground/80">{children}</p>;
}

function Topic({ topic }: { topic: GuideTopic }) {
  const t = useT();
  switch (topic) {
    case "start":
      return (
        <div className="flex flex-col gap-4">
          <P>{t("payroll.guide.start.intro")}</P>
          <Steps
            items={[
              <>
                <b>{t("payroll.guide.start.groupsB")}</b> {t("payroll.guide.start.groupsText")}
              </>,
              <>
                <b>{t("payroll.guide.start.rulesB")}</b> {t("payroll.guide.start.rulesText")}
              </>,
              <>
                <b>{t("payroll.guide.start.employeeB")}</b> {t("payroll.guide.start.employeeText")}
              </>,
              <>
                <b>{t("payroll.guide.start.periodB")}</b> {t("payroll.guide.start.periodText")}
              </>,
            ]}
          />
        </div>
      );
    case "groups": {
      const periods = t("payroll.guide.groups.periods");
      return (
        <div className="flex flex-col gap-4">
          <P>{t("payroll.guide.groups.intro")}</P>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Example
              title={t("payroll.guide.groups.ex1")}
              rows={[
                [periods, t("payroll.guide.groups.ex1a")],
                ["", t("payroll.guide.groups.ex1b")],
              ]}
            />
            <Example
              title={t("payroll.guide.groups.ex2")}
              rows={[
                [periods, t("payroll.guide.groups.ex2a")],
                ["", t("payroll.guide.groups.ex2b")],
              ]}
              note={t("payroll.guide.groups.ex2Note")}
            />
            <Example
              title={t("payroll.guide.groups.ex3")}
              rows={[
                [periods, t("payroll.guide.groups.ex3a")],
                ["", t("payroll.guide.groups.ex3b")],
              ]}
            />
            <Example
              title={t("payroll.guide.groups.ex4")}
              rows={[
                [periods, t("payroll.guide.groups.ex4a")],
                ["", t("payroll.guide.groups.ex4b")],
              ]}
              note={t("payroll.guide.groups.ex4Note")}
            />
            <Example
              title={t("payroll.guide.groups.ex5")}
              rows={[
                [periods, t("payroll.guide.groups.ex5a")],
                ["", t("payroll.guide.groups.ex5b")],
              ]}
            />
          </div>
          <P>{t("payroll.guide.groups.shortMonths")}</P>
          <H>{t("payroll.guide.groups.moveTitle")}</H>
          <P>
            {t("payroll.guide.groups.moveBefore")} <b>{t("payroll.guide.groups.moveB")}</b> {t("payroll.guide.groups.moveAfter")}
          </P>
          <H>{t("payroll.guide.groups.ownTitle")}</H>
          <P>{t("payroll.guide.groups.ownText")}</P>
        </div>
      );
    }
    case "salary": {
      const each = (amount: string) => t("payroll.guide.salary.eachPeriod", { amount });
      return (
        <div className="flex flex-col gap-4">
          <P>{t("payroll.guide.salary.intro")}</P>
          <Example
            title={t("payroll.guide.salary.ex1")}
            rows={[
              [t("payroll.shared.schedule.monthly"), each("$520.00")],
              [t("payroll.shared.schedule.semi_monthly"), `${each("$260.00")} (1/2)`],
              [t("payroll.shared.schedule.weekly"), `${each("$120.00")} (12/52)`],
              [t("payroll.shared.schedule.biweekly"), `${each("$240.00")} (12/26)`],
            ]}
          />
          <Example
            title={t("payroll.guide.salary.ex2")}
            rows={[
              [t("payroll.guide.salary.absentDay"), "− $20.00"],
              [t("payroll.guide.salary.unpaidDays"), "− $40.00"],
              [t("payroll.guide.salary.halfLeave"), "− $5.00"],
              [t("payroll.guide.salary.lateMinutes"), "− $1.88"],
            ]}
            note={t("payroll.guide.salary.ex2Note")}
          />
          <Example title={t("payroll.guide.salary.ex3")} rows={[[t("payroll.guide.salary.ex3Row"), "$346.67"]]} note={t("payroll.guide.salary.ex3Note")} />
          <H>{t("payroll.guide.salary.dailyTitle")}</H>
          <P>{t("payroll.guide.salary.dailyText")}</P>
          <H>{t("payroll.guide.salary.taxTitle")}</H>
          <P>{t("payroll.guide.salary.taxText")}</P>
        </div>
      );
    }
    case "run":
      return (
        <div className="flex flex-col gap-4">
          <Steps
            items={[
              <>
                <b>{t("payroll.guide.run.newB")}</b> {t("payroll.guide.run.newText")}
              </>,
              <>
                <b>{t("payroll.guide.run.checkB")}</b> {t("payroll.guide.run.checkText")}
              </>,
              <>
                <b>{t("payroll.guide.run.recalcB")}</b>
                {t("payroll.guide.run.recalcText")}
              </>,
              <>
                <b>{t("payroll.guide.run.approveB")}</b> {t("payroll.guide.run.approveText")}
              </>,
              <>
                <b>{t("payroll.guide.run.exportB")}</b> {t("payroll.guide.run.exportText")} <b>{t("payroll.guide.run.paidB")}</b>
                {t("payroll.guide.run.end")}
              </>,
            ]}
          />
          <H>{t("payroll.guide.run.checkTitle")}</H>
          <ul className={LIST}>
            <li>{t("payroll.guide.run.check1")}</li>
            <li>{t("payroll.guide.run.check2")}</li>
            <li>{t("payroll.guide.run.check3")}</li>
            <li>{t("payroll.guide.run.check4")}</li>
          </ul>
        </div>
      );
    case "adjustments":
      return (
        <div className="flex flex-col gap-4">
          <P>{t("payroll.guide.adjustments.intro")}</P>
          <Example
            title={t("payroll.guide.adjustments.exTitle")}
            rows={[
              [t("payroll.guide.adjustments.row1"), t("payroll.guide.adjustments.row1Run")],
              [t("payroll.guide.adjustments.row2"), t("payroll.guide.adjustments.row2Run")],
            ]}
            note={t("payroll.guide.adjustments.exNote")}
          />
          <H>{t("payroll.guide.adjustments.typesTitle")}</H>
          <ul className={LIST}>
            <li>
              <b>{t("payroll.shared.kind.earning")}</b> {t("payroll.guide.adjustments.earningText")}
            </li>
            <li>
              <b>{t("payroll.shared.kind.deduction")}</b> {t("payroll.guide.adjustments.deductionText")}
            </li>
            <li>
              <b>{t("payroll.shared.kind.net_deduction")}</b> {t("payroll.guide.adjustments.netText")}
            </li>
          </ul>
          <P>{t("payroll.guide.adjustments.outro")}</P>
        </div>
      );
    case "locks":
      return (
        <div className="flex flex-col gap-4">
          <P>{t("payroll.guide.locks.intro")}</P>
          <H>{t("payroll.guide.locks.cantTitle")}</H>
          <ul className={LIST}>
            <li>{t("payroll.guide.locks.cant1")}</li>
            <li>{t("payroll.guide.locks.cant2")}</li>
            <li>{t("payroll.guide.locks.cant3")}</li>
          </ul>
          <H>{t("payroll.guide.locks.mistakeTitle")}</H>
          <P>
            {t("payroll.guide.locks.mistakeBefore")} <b>{t("payroll.guide.locks.mistakeB")}</b> {t("payroll.guide.locks.mistakeAfter")}
          </P>
        </div>
      );
    case "faq":
      return (
        <div className="flex flex-col gap-4">
          {(
            [
              ["payroll.guide.faq.q1", "payroll.guide.faq.a1"],
              ["payroll.guide.faq.q2", "payroll.guide.faq.a2"],
              ["payroll.guide.faq.q3", "payroll.guide.faq.a3"],
              ["payroll.guide.faq.q4", "payroll.guide.faq.a4"],
              ["payroll.guide.faq.q5", "payroll.guide.faq.a5"],
              ["payroll.guide.faq.q6", "payroll.guide.faq.a6"],
            ] as const
          ).map(([q, a]) => (
            <div key={q} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="flex gap-2 font-semibold">
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-cyan-500" />
                {t(q)}
              </p>
              <p className="mt-1 pl-6 text-[15px] leading-relaxed text-foreground/80">{t(a)}</p>
            </div>
          ))}
        </div>
      );
  }
}

/**
 * The whole guide, opening on one topic: a big dialog with the topics in a side
 * menu (a scrolling row on a phone), the topic on the right, and Back / Next so
 * it reads like a short course.
 */
export function PayrollGuideDialog({ open, onOpenChange, topic = "start" }: { open: boolean; onOpenChange: (o: boolean) => void; topic?: GuideTopic }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88dvh,780px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border px-5 py-4 pr-12 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-sm">
            <BookOpen className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{t("payroll.guide.title")}</DialogTitle>
            <DialogDescription>
              {t("payroll.guide.description")}{" "}
              <Link href="/docs-cthh5ueij8/payroll" target="_blank" className="text-primary underline-offset-4 hover:underline">
                {t("payroll.guide.docs")}
              </Link>
            </DialogDescription>
          </div>
        </DialogHeader>
        {/* Keyed so every opening starts on the topic it was opened for. */}
        <GuideBody key={open ? topic : "closed"} topic={topic} />
      </DialogContent>
    </Dialog>
  );
}

function GuideBody({ topic }: { topic: GuideTopic }) {
  const t = useT();
  const [current, setCurrent] = useState(topic);
  const scroller = useRef<HTMLDivElement>(null);
  const index = TOPICS.findIndex((item) => item.key === current);
  const active = TOPICS[index];
  const previous = TOPICS[index - 1];
  const next = TOPICS[index + 1];

  /** Opens a topic and starts reading it from the top. */
  function go(key: GuideTopic) {
    setCurrent(key);
    scroller.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Topics: a side menu on wide screens, a scrolling row on a phone. */}
      <nav
        role="tablist"
        aria-orientation="vertical"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 md:w-60 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:p-3"
      >
        {TOPICS.map(({ key, icon: Icon, tone }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={current === key}
            onClick={() => go(key)}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors",
              current === key ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white", tone)}>
              <Icon className="size-4" />
            </span>
            {t(`payroll.guide.topic.${key}`)}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm", active.tone)}>
                <active.icon className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground tabular-nums">
                  {index + 1} / {TOPICS.length}
                </p>
                <h2 className="text-xl font-bold tracking-tight">{t(`payroll.guide.topic.${current}`)}</h2>
              </div>
            </div>
            <Topic topic={current} />
          </div>
        </div>

        {/* Back / Next, named so you know where you're going. */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          {previous ? (
            <Button variant="outline" onClick={() => go(previous.key)}>
              <ChevronLeft className="size-4" />
              <span className="max-w-36 truncate">{t(`payroll.guide.topic.${previous.key}`)}</span>
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button onClick={() => go(next.key)}>
              <span className="max-w-36 truncate">{t(`payroll.guide.topic.${next.key}`)}</span>
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A "Guide" button for a page header, opening on that page's topic. */
export function PayrollGuideButton({ topic }: { topic: GuideTopic }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BookOpen className="size-4" />
        {t("payroll.guide.button")}
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
  const t = useT();
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
      title: t("payroll.guide.card.groupsTitle"),
      text: t("payroll.guide.card.groupsText"),
      href: "/dashboard/payroll/settings",
      link: t("payroll.guide.card.settingsLink"),
      done: groupsCount > 1,
      topic: "groups",
    },
    {
      title: t("payroll.guide.card.rulesTitle"),
      text: t("payroll.guide.card.rulesText"),
      href: "/dashboard/payroll/settings",
      link: t("payroll.guide.card.settingsLink"),
      topic: "salary",
    },
    {
      title: t("payroll.guide.card.employeeTitle"),
      text: t("payroll.guide.card.employeeText"),
      href: "/dashboard/employees",
      link: t("payroll.guide.card.employeesLink"),
      topic: "groups",
    },
    {
      title: t("payroll.guide.card.runTitle"),
      text: t("payroll.guide.card.runText"),
      done: hasRuns,
      topic: "run",
    },
    {
      title: t("payroll.guide.card.payTitle"),
      text: t("payroll.guide.card.payText"),
      done: hasApprovedRun,
      topic: "locks",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{t("payroll.guide.card.title")}</CardTitle>
          <CardDescription>{t("payroll.guide.card.description")}</CardDescription>
        </div>
        <Button variant="ghost" size="icon" aria-label={t("payroll.guide.card.hide")} onClick={dismiss}>
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y divide-border">
          {steps.map((s, i) => (
            <li key={s.topic + i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
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
                {t("payroll.guide.card.how")}
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
      <PayrollGuideDialog open={guide !== null} onOpenChange={(o) => !o && setGuide(null)} topic={guide ?? "start"} />
    </Card>
  );
}
