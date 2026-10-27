"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Bullets, Calc, Formula, H3, Note, P, Section, Steps, Table, Toc, rich, useDoc, type TocEntry } from "./doc-parts";

/* The payroll guide (app/docs-cthh5ueij8/payroll). Text lives in lib/i18n/<lang>/docs/payroll*.ts. */

const TOC_IDS = [
  { id: "overview" },
  { id: "before" },
  { id: "settings", step: 1 },
  { id: "components", step: 2 },
  { id: "groups", step: 3 },
  { id: "employees", step: 4 },
  { id: "attendance", step: 5 },
  { id: "run", step: 6 },
  { id: "review", step: 7 },
  { id: "adjustments", step: 8 },
  { id: "approve", step: 9 },
  { id: "pay", step: 10 },
  { id: "calculation" },
  { id: "example" },
  { id: "tax" },
  { id: "mistakes" },
  { id: "warnings" },
  { id: "faq" },
  { id: "glossary" },
] as const;

export function PayrollDocs() {
  const t = useT();
  const d = useDoc();
  const p = d.payroll;
  const r = d.payrollRun;
  const m = d.payrollMath;
  const toc: TocEntry[] = TOC_IDS.map((e) => ({ ...e, title: p.toc[e.id] }));

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 py-8 sm:px-6">
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-64 shrink-0 overflow-y-auto lg:block">
        <Toc entries={toc} />
      </aside>

      <main className="min-w-0 flex-1">
        <Link href="/docs-cthh5ueij8" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("docs.chrome.allDocs")}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{p.title}</h1>
        <p className="mt-2 max-w-3xl text-lg text-muted-foreground">{p.intro}</p>

        <div className="mt-6 rounded-lg border border-border p-4 lg:hidden">
          <Toc entries={toc} />
        </div>

        <div className="mt-10 flex flex-col gap-14">
          {/* ───────────────────────────── Overview ───────────────────────────── */}
          <Section id="overview" title={p.toc.overview}>
            <P>{rich(p.overview.p1)}</P>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [p.overview.calculate, p.overview.calculateText],
                [p.overview.check, p.overview.checkText],
                [p.overview.approve, p.overview.approveText],
                [p.overview.pay, p.overview.payText],
              ].map(([title, text], i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-primary">{i + 1}</p>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
            <P>{rich(p.overview.p2)}</P>
          </Section>

          {/* ───────────────────────────── Before ───────────────────────────── */}
          <Section id="before" title={p.toc.before}>
            <Bullets items={[rich(p.before.b1), rich(p.before.b2), rich(p.before.b3)]} />
            <Table
              head={[p.before.permHead.permission, p.before.permHead.allows, p.before.permHead.givenTo]}
              rows={(
                [
                  ["payroll.view", p.before.perm.view],
                  ["payroll.manage", p.before.perm.manage],
                  ["payroll.approve", p.before.perm.approve],
                  ["salary.view", p.before.perm.salaryView],
                  ["salary.manage", p.before.perm.salaryManage],
                ] as const
              ).map(([code, row]) => [<b key={code}>{code}</b>, row.allows, row.givenTo])}
            />
            <P>{rich(p.before.rolesText)}</P>
            <H3>{p.before.exampleTitle}</H3>
            <Table
              head={[p.before.exampleHead.role, p.before.exampleHead.permissions, p.before.exampleHead.does]}
              rows={[p.before.exampleHr, p.before.exampleManager].map((row) => [row.role, row.permissions, row.does])}
            />
            <Steps items={[rich(p.before.s1), rich(p.before.s2), rich(p.before.s3)]} />
            <P>{p.before.p}</P>
          </Section>

          {/* ───────────────────────────── Step 1 ───────────────────────────── */}
          <Section id="settings" step={1} title={p.toc.settings} intro={p.settings.intro}>
            <P>{rich(p.settings.p1)}</P>
            <Table head={[p.settings.presetHead.preset, p.settings.presetHead.sets]} rows={[p.settings.office, p.settings.factory].map((row) => [row.preset, row.sets])} />
            <P>{p.settings.p2}</P>
            <Table
              head={[p.settings.head.setting, p.settings.head.choices, p.settings.head.meaning]}
              rows={Object.values(p.settings.rows).map((row) => [row.setting, row.choices, row.meaning])}
            />
            <Note>{p.settings.note}</Note>
          </Section>

          {/* ───────────────────────────── Step 2 ───────────────────────────── */}
          <Section id="components" step={2} title={p.toc.components} intro={p.components.intro}>
            <P>{rich(p.components.p1)}</P>
            <Table
              head={[p.components.head.component, p.components.head.type, p.components.head.from]}
              rows={Object.entries(p.components.rows).map(([key, row]) => [
                row.component,
                ["base", "overtime", "bonus"].includes(key) ? p.components.earning : p.components.deduction,
                row.from,
              ])}
            />
            <H3>{p.components.latenessTitle}</H3>
            <Table
              head={[p.components.latenessHead.rule, p.components.latenessHead.charges, p.components.latenessHead.example]}
              rows={Object.values(p.components.lateness).map((row) => [row.rule, row.charges, row.example])}
            />
            <H3>{p.components.addTitle}</H3>
            <Steps items={[rich(p.components.s1), rich(p.components.s2), rich(p.components.s3), rich(p.components.s4), rich(p.components.s5)]} />
          </Section>

          {/* ───────────────────────────── Step 3 ───────────────────────────── */}
          <Section id="groups" step={3} title={p.toc.groups} intro={p.groups.intro}>
            <P>{rich(p.groups.p1)}</P>
            <H3>{p.groups.schedulesTitle}</H3>
            <Table
              head={[p.groups.head.schedule, p.groups.head.choose, p.groups.head.examples, p.groups.head.pays]}
              rows={Object.values(p.groups.rows).map((row) => [row.schedule, row.choose, row.examples, row.pays])}
            />
            <Bullets items={[rich(p.groups.b1), rich(p.groups.b2), rich(p.groups.b3)]} />
            <H3>{p.groups.createTitle}</H3>
            <Steps items={[rich(p.groups.s1), rich(p.groups.s2), rich(p.groups.s3), rich(p.groups.s4), rich(p.groups.s5), rich(p.groups.s6)]} />
            <Note variant="warning" title={p.groups.noteTitle}>
              {p.groups.note}
            </Note>
            <P>{p.groups.p2}</P>
          </Section>

          {/* ───────────────────────────── Step 4 ───────────────────────────── */}
          <Section id="employees" step={4} title={p.toc.employees} intro={p.employees.intro}>
            <H3>{p.employees.groupTitle}</H3>
            <Steps items={[rich(p.employees.g1), rich(p.employees.g2), rich(p.employees.g3)]} />
            <P>{p.employees.newHire}</P>
            <H3>{p.employees.salaryTitle}</H3>
            <Steps items={[rich(p.employees.s1), rich(p.employees.s2), rich(p.employees.s3)]} />
            <Bullets items={[p.employees.b1, p.employees.b2, p.employees.b3, p.employees.b4, p.employees.b5]} />
            <H3>{p.employees.itemsTitle}</H3>
            <P>{rich(p.employees.items)}</P>
            <H3>{p.employees.taxTitle}</H3>
            <Table head={[p.employees.taxHead.field, p.employees.taxHead.effect]} rows={Object.values(p.employees.tax).map((row) => [row.field, row.effect])} />
          </Section>

          {/* ───────────────────────────── Step 5 ───────────────────────────── */}
          <Section id="attendance" step={5} title={p.toc.attendance} intro={p.attendance.intro}>
            <Table head={[p.attendance.head.from, p.attendance.head.becomes]} rows={Object.values(p.attendance.rows).map((row) => [row.from, row.becomes])} />
            <H3>{p.attendance.checklistTitle}</H3>
            <Bullets items={[p.attendance.c1, p.attendance.c2, p.attendance.c3, p.attendance.c4]} />
          </Section>

          {/* ───────────────────────────── Step 6 ───────────────────────────── */}
          <Section id="run" step={6} title={p.toc.run}>
            <Steps items={[rich(r.run.s1), rich(r.run.s2), rich(r.run.s3), rich(r.run.s4)]} />
            <Bullets items={[r.run.b1, r.run.b2, r.run.b3]} />
          </Section>

          {/* ───────────────────────────── Step 7 ───────────────────────────── */}
          <Section id="review" step={7} title={p.toc.review}>
            <P>{r.review.p1}</P>
            <Table head={[r.review.head.check, r.review.head.meaning, r.review.head.todo]} rows={Object.values(r.review.rows).map((row) => [row.check, row.meaning, row.todo])} />
            <P>{r.review.p2}</P>
            <Bullets items={[r.review.b1, r.review.b2, r.review.b3, r.review.b4]} />
            <H3>{r.review.changesTitle}</H3>
            <P>{rich(r.review.changes)}</P>
          </Section>

          {/* ───────────────────────────── Step 8 ───────────────────────────── */}
          <Section id="adjustments" step={8} title={p.toc.adjustments} intro={r.adjustments.intro}>
            <Table
              head={[r.adjustments.head.type, r.adjustments.head.use, r.adjustments.head.effect]}
              rows={Object.values(r.adjustments.rows).map((row) => [row.type, row.use, row.effect])}
            />
            <H3>{r.adjustments.addTitle}</H3>
            <Steps items={[rich(r.adjustments.s1), rich(r.adjustments.s2), rich(r.adjustments.s3), rich(r.adjustments.s4), rich(r.adjustments.s5)]} />
            <Calc
              title={r.adjustments.calcTitle}
              rows={[
                [r.adjustments.calc1, r.adjustments.calc1Run],
                [r.adjustments.calc2, r.adjustments.calc2Run],
              ]}
            />
            <H3>{r.adjustments.importTitle}</H3>
            <P>{rich(r.adjustments.import)}</P>
            <P>{r.adjustments.approved}</P>
          </Section>

          {/* ───────────────────────────── Step 9 ───────────────────────────── */}
          <Section id="approve" step={9} title={p.toc.approve}>
            <P>{rich(r.approve.p1)}</P>
            <Bullets items={[r.approve.b1, rich(r.approve.b2), r.approve.b3, r.approve.b4]} />
            <P>{r.approve.p2}</P>
          </Section>

          {/* ───────────────────────────── Step 10 ───────────────────────────── */}
          <Section id="pay" step={10} title={p.toc.pay}>
            <Steps items={[rich(r.pay.s1), r.pay.s2, rich(r.pay.s3)]} />
            <P>{r.pay.columns}</P>
          </Section>

          {/* ───────────────────────────── Calculation ───────────────────────────── */}
          <Section id="calculation" title={p.toc.calculation} intro={m.calc.intro}>
            <Formula>{m.calc.order}</Formula>

            <H3>{m.calc.ratesTitle}</H3>
            <Table head={[m.calc.ratesHead.setting, m.calc.ratesHead.rate, m.calc.ratesHead.example]} rows={Object.values(m.calc.rates).map((row) => [row.setting, row.rate, row.example])} />
            <Formula>{m.calc.hourly}</Formula>
            <P>{m.calc.dailyPaid}</P>

            <H3>{m.calc.monthlyTitle}</H3>
            <Formula>{m.calc.monthlyFormula}</Formula>
            <Table
              head={[m.calc.shareHead.group, m.calc.shareHead.share]}
              rows={[
                [m.calc.share.monthly, "1"],
                [m.calc.share.semi, "1/2"],
                [m.calc.share.weekly, "12/52"],
                [m.calc.share.biweekly, "12/26"],
                [m.calc.share.custom, m.calc.share.customShare],
              ]}
            />
            <P>{m.calc.daysPaid}</P>
            <Calc
              title={m.calc.joinTitle}
              rows={[
                [m.calc.join1, "$100.00"],
                [m.calc.join2, "$150.00"],
              ]}
              total={[m.calc.baseSalary, "$250.00"]}
            />

            <H3>{m.calc.dailyTitle}</H3>
            <Formula>{m.calc.dailyFormula}</Formula>
            <P>{m.calc.dailyText}</P>

            <H3>{m.calc.linesTitle}</H3>
            <Table head={[m.calc.linesHead.line, m.calc.linesHead.formula]} rows={Object.values(m.calc.lines).map((row) => [row.line, row.formula])} />

            <H3>{m.calc.netTitle}</H3>
            <Formula>{m.calc.gross}</Formula>
            <Formula>{m.calc.net}</Formula>
            <Formula>{m.calc.cost}</Formula>
            <P>{m.calc.rounding}</P>
          </Section>

          {/* ───────────────────────────── Example ───────────────────────────── */}
          <Section id="example" title={p.toc.example} intro={m.example.intro}>
            <P>{m.example.attendance}</P>
            <P className="text-sm text-muted-foreground">{m.example.rates}</P>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Calc
                title={m.example.earningsTitle}
                rows={[
                  [m.example.base, "+ $520.00"],
                  [m.example.overtime, "+ $42.50"],
                  [m.example.transport, "+ $20.00"],
                  [m.example.absence, "− $20.00"],
                  [m.example.late, "− $1.88"],
                ]}
                total={[m.example.gross, "$560.62"]}
              />
              <Calc
                title={m.example.netTitle}
                rows={[
                  [m.example.nssf, "− $5.85"],
                  [m.example.tax, "− $13.38"],
                ]}
                total={[m.example.net, "$541.39"]}
                note={m.example.employer}
              />
            </div>
            <Calc
              title={m.example.taxTitle}
              rows={[
                [m.example.band1, "0"],
                [m.example.band2, "25,000"],
                [m.example.band3, "29,854"],
              ]}
              total={[m.example.taxTotal, "54,854 ៛"]}
            />
          </Section>

          {/* ───────────────────────────── Tax ───────────────────────────── */}
          <Section id="tax" title={p.toc.tax}>
            <Note variant="warning" title={m.tax.noteTitle}>
              {m.tax.note}
            </Note>
            <H3>{m.tax.nssfTitle}</H3>
            <Bullets items={[m.tax.n1, m.tax.n2, m.tax.n3]} />
            <H3>{m.tax.taxTitle}</H3>
            <Table
              head={[m.tax.bandsHead.salary, m.tax.bandsHead.rate]}
              rows={[
                ["0 – 1,500,000", "0%"],
                ["1,500,001 – 2,000,000", "5%"],
                ["2,000,001 – 8,500,000", "10%"],
                ["8,500,001 – 12,500,000", "15%"],
                [m.tax.over, "20%"],
              ]}
            />
            <Bullets items={[m.tax.t1, m.tax.t2, m.tax.t3]} />
            <Calc
              title={m.tax.calcTitle}
              rows={[
                [m.tax.c1, "− 24,000"],
                [m.tax.c2, "− 10,003"],
                [m.tax.c3, ""],
              ]}
              total={[m.tax.net, "1,966,000 ៛"]}
            />
            <Note>{m.tax.confirm}</Note>
          </Section>

          {/* ───────────────────────────── Mistakes ───────────────────────────── */}
          <Section id="mistakes" title={p.toc.mistakes}>
            <Table head={[m.mistakes.head.situation, m.mistakes.head.todo]} rows={Object.values(m.mistakes.rows).map((row) => [row.situation, row.todo])} />
          </Section>

          {/* ───────────────────────────── Warnings ───────────────────────────── */}
          <Section id="warnings" title={p.toc.warnings}>
            <Table
              head={[m.warnings.head.message, m.warnings.head.blocks, m.warnings.head.fix]}
              rows={Object.entries(m.warnings.rows).map(([key, row]) => [
                row.message,
                ["noSalary", "overtime", "currency", "noTax"].includes(key) ? m.warnings.no : m.warnings.yes,
                row.fix,
              ])}
            />
          </Section>

          {/* ───────────────────────────── FAQ ───────────────────────────── */}
          <Section id="faq" title={p.toc.faq}>
            {Object.entries(m.faq).map(([key, { q, a }]) => (
              <div key={key}>
                <H3>{q}</H3>
                <P>{a}</P>
              </div>
            ))}
          </Section>

          {/* ───────────────────────────── Glossary ───────────────────────────── */}
          <Section id="glossary" title={p.toc.glossary}>
            <Table head={[m.glossary.head.word, m.glossary.head.meaning]} rows={Object.values(m.glossary.rows).map((row) => [row.word, row.meaning])} />
          </Section>
        </div>
      </main>
    </div>
  );
}
