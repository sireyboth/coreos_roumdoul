"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, FileWarning, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { ChartCard, ChartEmpty } from "@/components/dashboard/charts/chart-card";
import { BarListChart, ColumnChart, SERIES, ShareBar, TrendChart } from "@/components/dashboard/charts/charts";
import { StatTile, type StatDelta } from "@/components/dashboard/charts/stat-tile";
import { PayslipDialog } from "@/components/dashboard/payroll/payslip-view";
import { RUN_STATUS, compactMoney, money } from "@/components/dashboard/payroll/shared";
import { api, type PayRun, type PayRunReport } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import { byCurrency, componentTotals, groupTotals, totalsOf, type RegisterRow } from "@/lib/payroll-report";
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";
// How many earlier runs of the same pay group the trend shows.
const TREND_RUNS = 12;

/** "$300–400" style pay bands: about eight, on round edges. */
function payBands(rows: RegisterRow[], currency: string) {
  if (rows.length === 0) return [];
  const max = Math.max(...rows.map((r) => r.net));
  const raw = max / 8 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const count = Math.max(1, Math.ceil((max + 0.01) / step));
  const bands = Array.from({ length: count }, (_, i) => ({ from: i * step, to: (i + 1) * step, value: 0 }));
  for (const r of rows) bands[Math.min(count - 1, Math.floor(r.net / step))].value += 1;
  // Band edges are round, so no cents: "$200–400", "400K–600K ៛".
  const edge = (v: number) => (v >= 1000 ? v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 }) : v.toLocaleString("en-US", { maximumFractionDigits: 0 }));
  return bands.map((b) => ({ label: currency === "KHR" ? `${edge(b.from)}–${edge(b.to)} ៛` : `$${edge(b.from)}–${edge(b.to)}`, value: b.value }));
}

const shortPeriod = (run: PayRun, lang: Lang) => {
  const end = new Date(`${run.period_end}T00:00:00`);
  const label = end.toLocaleDateString(dateLocale(lang) ?? "en-US", { month: "short", year: "2-digit" });
  // Twice-a-month and weekly groups have several runs per month: tell them apart by the end day.
  return run.pay_group?.schedule === "monthly" ? label : `${end.getDate()} ${label}`;
};

export default function PayrollDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const t = useT();
  const lang = useLang();
  const noBranch = t("payroll.dashboard.noBranch");

  const [report, setReport] = useState<PayRunReport | null>(null);
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [openSlip, setOpenSlip] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.payroll.runReport(id), api.payroll.runs()])
      .then(([r, all]) => {
        setReport(r);
        setRuns(all);
      })
      .catch(notifyError);
  }, [id]);

  const currencies = useMemo(() => (report ? byCurrency(report.payslips) : []), [report]);
  const active = currency ?? currencies[0]?.[0] ?? "USD";
  const allRows = useMemo(() => currencies.find(([c]) => c === active)?.[1] ?? [], [currencies, active]);
  const branches = useMemo(() => [...new Set(allRows.map((r) => r.slip.employee?.branch || noBranch))].sort(), [allRows, noBranch]);
  const rows = useMemo(() => (branch ? allRows.filter((r) => (r.slip.employee?.branch || noBranch) === branch) : allRows), [allRows, branch, noBranch]);

  // This run and the ones before it in the same pay group, oldest first.
  const history = useMemo(() => {
    if (!report) return [];
    return runs
      .filter((r) => r.pay_group?.id === report.pay_group?.id && r.period_end <= report.period_end && r.totals?.[active])
      .sort((a, b) => a.period_end.localeCompare(b.period_end))
      .slice(-TREND_RUNS);
  }, [runs, report, active]);
  const previous = history.length > 1 && history[history.length - 1].id === report?.id ? history[history.length - 2] : null;

  const back = (
    <Link href={`/dashboard/payroll/runs/${id}`} className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("payroll.dashboard.back")}
    </Link>
  );

  if (!report) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {back}
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const fmt = (v: number) => money(v, active);
  const compact = (v: number) => compactMoney(v, active);
  const sum = totalsOf(rows);
  const people = rows.length;
  const average = people ? sum.net / people : 0;

  // Run-level comparison only makes sense for the whole run, not one branch.
  const prev = !branch && previous ? previous.totals![active] : null;
  const vs = previous ? t("payroll.dashboard.vs", { period: previous.period_label }) : "";
  const delta = (now: number, before: number | undefined, upIs: StatDelta["upIs"], format = fmt): StatDelta | null =>
    prev && before !== undefined ? { change: now - before, previous: before, vs, upIs, format } : null;

  const trend = history.map((r) => ({ period: shortPeriod(r, lang), gross: r.totals![active].gross, net: r.totals![active].net, cost: r.totals![active].employer_cost }));
  const earnings = componentTotals(rows, "earning").map((c) => ({ label: c.name, value: c.total }));
  const deductions = [...componentTotals(rows, "deduction"), ...componentTotals(rows, "net_deduction")].map((c) => ({ label: c.name, value: c.total }));
  const none = { branch: noBranch, department: t("payroll.dashboard.noDepartment") };
  const byDepartment = groupTotals(rows, "department", none).map((g) => ({ label: g.name, value: g.cost }));
  const byBranch = groupTotals(rows, "branch", none).map((g) => ({ label: g.name, value: g.cost }));
  const topEarners = [...rows].sort((a, b) => b.gross - a.gross).slice(0, 10);

  const needsFixing = rows.filter((r) => r.slip.warnings?.some((w) => w.blocking));
  const missingBank = rows.filter((r) => r.slip.employee && r.slip.employee.payment_method !== "cash" && (!r.slip.employee.bank_name || !r.slip.employee.bank_account_number));
  const cashCount = rows.filter((r) => r.slip.employee?.payment_method === "cash").length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {back}
      <PageHeader
        title={t("payroll.dashboard.title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={RUN_STATUS[report.status].variant}>{t(RUN_STATUS[report.status].labelKey)}</Badge>
            {report.pay_group?.name ?? t("payroll.run.payroll")} · {report.period_label}
          </span>
        }
        action={
          <Button variant="outline" render={<Link href={`/dashboard/payroll/runs/${id}`} />} nativeButton={false}>
            <Wallet className="size-4" />
            {t("payroll.dashboard.openRun")}
          </Button>
        }
      />

      {/* Filters: one row, above every chart they affect. */}
      <div className="flex flex-wrap items-center gap-3">
        {currencies.length > 1 && (
          <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label={t("common.field.currency")}>
            {currencies.map(([c, rs]) => (
              <button
                key={c}
                role="tab"
                aria-selected={c === active}
                onClick={() => setCurrency(c)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${c === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {c} <span className="opacity-70">· {rs.length}</span>
              </button>
            ))}
          </div>
        )}
        {branches.length > 1 && (
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={SELECT_CLASS} aria-label={t("common.field.branch")}>
            <option value="">{t("payroll.dashboard.allBranches")}</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
        {currencies.length > 1 && <p className="text-xs text-muted-foreground">{t("payroll.dashboard.separate")}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile emphasis label={t("payroll.dashboard.net")} value={fmt(sum.net)} delta={delta(sum.net, prev?.net, "neutral")} hint={t("payroll.dashboard.netHint")} />
        <StatTile label={t("payroll.dashboard.cost")} value={fmt(sum.cost)} delta={delta(sum.cost, prev?.employer_cost, "bad")} hint={t("payroll.dashboard.costHint")} />
        <StatTile
          label={t("payroll.dashboard.employees")}
          value={String(people)}
          delta={delta(people, prev?.employees, "neutral", (v) => String(Math.round(v)))}
          hint={t("payroll.dashboard.cashHint", { n: cashCount })}
        />
        <StatTile
          label={t("payroll.dashboard.average")}
          value={fmt(average)}
          delta={prev && prev.employees ? delta(average, prev.net / prev.employees, "neutral") : null}
          hint={t("payroll.dashboard.averageHint")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={t("payroll.dashboard.trendTitle")}
          description={
            branch
              ? t("payroll.dashboard.trendBranch")
              : t(history.length === 1 ? "payroll.dashboard.trendOne" : "payroll.dashboard.trendOther", {
                  n: history.length,
                  group: report.pay_group?.name ?? t("payroll.dashboard.thisGroup"),
                  currency: active,
                })
          }
        >
          {history.length > 1 ? (
            <TrendChart
              data={trend}
              xKey="period"
              highlight={shortPeriod(report, lang)}
              series={[
                { key: "cost", label: t("payroll.dashboard.totalCost") },
                { key: "gross", label: t("payroll.dashboard.gross") },
                { key: "net", label: t("payroll.dashboard.net") },
              ]}
              format={fmt}
              compact={compact}
            />
          ) : (
            <ChartEmpty>{t("payroll.dashboard.trendEmpty")}</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard title={t("payroll.dashboard.moneyTitle")} description={t("payroll.dashboard.moneyText", { amount: fmt(sum.cost) })}>
          <ShareBar
            total={sum.cost}
            format={fmt}
            parts={[
              { label: t("payroll.dashboard.netToStaff"), value: sum.net, color: SERIES[0] },
              { label: t("payroll.dashboard.withheld"), value: sum.nssf + sum.tax, color: SERIES[1] },
              { label: t("payroll.dashboard.afterTax"), value: sum.afterTax, color: SERIES[2] },
              { label: t("payroll.dashboard.employerNssf"), value: sum.employer, color: SERIES[3] },
            ]}
          />
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("payroll.dashboard.grossPay")}</dt>
              <dd className="font-medium tabular-nums">{fmt(sum.gross)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("payroll.dashboard.beforeTax")}</dt>
              <dd className="font-medium tabular-nums">{fmt(sum.deductions)}</dd>
            </div>
          </dl>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("payroll.dashboard.byDepartment")} description={t("payroll.dashboard.cost")}>
          {byDepartment.length ? (
            <BarListChart data={byDepartment} format={fmt} compact={compact} valueLabel={t("payroll.dashboard.totalCost")} />
          ) : (
            <ChartEmpty>{t("payroll.dashboard.noPayslips")}</ChartEmpty>
          )}
        </ChartCard>
        <ChartCard title={t("payroll.dashboard.byBranch")} description={t("payroll.dashboard.cost")}>
          {byBranch.length ? (
            <BarListChart data={byBranch} format={fmt} compact={compact} valueLabel={t("payroll.dashboard.totalCost")} />
          ) : (
            <ChartEmpty>{t("payroll.dashboard.noPayslips")}</ChartEmpty>
          )}
        </ChartCard>
        <ChartCard title={t("payroll.dashboard.earningsTitle")} description={t("payroll.dashboard.earningsText")}>
          {earnings.length ? (
            <BarListChart data={earnings} format={fmt} compact={compact} valueLabel={t("payroll.dashboard.paid")} />
          ) : (
            <ChartEmpty>{t("payroll.dashboard.noEarnings")}</ChartEmpty>
          )}
        </ChartCard>
        <ChartCard title={t("payroll.dashboard.deductionsTitle")} description={t("payroll.dashboard.deductionsText")}>
          {deductions.length ? (
            <BarListChart data={deductions} format={fmt} compact={compact} valueLabel={t("payroll.dashboard.deducted")} color={SERIES[1]} />
          ) : (
            <ChartEmpty>{t("payroll.dashboard.noDeductions")}</ChartEmpty>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("payroll.dashboard.distributionTitle")} description={t("payroll.dashboard.distributionText")}>
          {people ? <ColumnChart data={payBands(rows, active)} valueLabel={t("payroll.dashboard.people")} /> : <ChartEmpty>{t("payroll.dashboard.noPayslips")}</ChartEmpty>}
        </ChartCard>

        <ChartCard title={t("payroll.dashboard.topTitle")} description={t("payroll.dashboard.topText")}>
          <ol className="flex flex-col">
            {topEarners.map((r, i) => (
              <li key={r.slip.id}>
                <button onClick={() => setOpenSlip(r.slip.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.slip.employee?.name ?? t("payroll.dashboard.removedEmployee")}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[r.slip.employee?.job_title, r.slip.employee?.department].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium tabular-nums">{fmt(r.gross)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{t("payroll.dashboard.netAmount", { amount: fmt(r.net) })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </ChartCard>
      </div>

      <ChartCard title={t("payroll.dashboard.checksTitle")} description={t("payroll.dashboard.checksText")}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CheckItem
            ok={needsFixing.length === 0}
            icon={FileWarning}
            title={
              needsFixing.length
                ? t(needsFixing.length === 1 ? "payroll.dashboard.problemsOne" : "payroll.dashboard.problemsOther", { n: needsFixing.length })
                : t("payroll.dashboard.noProblems")
            }
            detail={needsFixing.length ? needsFixing.slice(0, 3).map((r) => r.slip.employee?.name).join(", ") + (needsFixing.length > 3 ? "…" : "") : t("payroll.dashboard.noProblemsText")}
          />
          <CheckItem
            ok={missingBank.length === 0}
            icon={CreditCard}
            title={missingBank.length ? t("payroll.dashboard.missingBank", { n: missingBank.length }) : t("payroll.dashboard.bankComplete")}
            detail={missingBank.length ? missingBank.slice(0, 3).map((r) => r.slip.employee?.name).join(", ") + (missingBank.length > 3 ? "…" : "") : t("payroll.dashboard.bankCompleteText")}
          />
          <CheckItem
            ok={report.status === "approved" || report.status === "paid"}
            icon={CheckCircle2}
            title={report.status === "paid" ? t("common.status.paid") : report.status === "approved" ? t("payroll.dashboard.readyToPay") : t("payroll.dashboard.notApproved")}
            detail={report.approved_by ? t("payroll.dashboard.approvedBy", { name: report.approved_by.name }) : t("payroll.dashboard.canChange")}
          />
        </ul>
      </ChartCard>

      <PayslipDialog payslipId={openSlip} onOpenChange={(o) => !o && setOpenSlip(null)} />
    </div>
  );
}

/** One readiness check: an icon and words carry the state, the colour only backs them up. */
function CheckItem({ ok, icon: Icon, title, detail }: { ok: boolean; icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <li className={`flex gap-3 rounded-lg border p-3 ${ok ? "border-border" : "border-warning/40 bg-warning/5"}`}>
      {ok ? <Icon className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
