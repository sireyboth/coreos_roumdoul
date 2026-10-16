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

const shortPeriod = (run: PayRun) => {
  const end = new Date(`${run.period_end}T00:00:00`);
  const label = end.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  // Twice-a-month and weekly groups have several runs per month: tell them apart by the end day.
  return run.pay_group?.schedule === "monthly" ? label : `${end.getDate()} ${label}`;
};

export default function PayrollDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

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
  const branches = useMemo(() => [...new Set(allRows.map((r) => r.slip.employee?.branch || "No branch"))].sort(), [allRows]);
  const rows = useMemo(() => (branch ? allRows.filter((r) => (r.slip.employee?.branch || "No branch") === branch) : allRows), [allRows, branch]);

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
      Pay run
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
  const t = totalsOf(rows);
  const people = rows.length;
  const average = people ? t.net / people : 0;

  // Run-level comparison only makes sense for the whole run, not one branch.
  const prev = !branch && previous ? previous.totals![active] : null;
  const vs = previous ? `vs ${previous.period_label}` : "";
  const delta = (now: number, before: number | undefined, upIs: StatDelta["upIs"], format = fmt): StatDelta | null =>
    prev && before !== undefined ? { change: now - before, previous: before, vs, upIs, format } : null;

  const trend = history.map((r) => ({ period: shortPeriod(r), gross: r.totals![active].gross, net: r.totals![active].net, cost: r.totals![active].employer_cost }));
  const earnings = componentTotals(rows, "earning").map((c) => ({ label: c.name, value: c.total }));
  const deductions = [...componentTotals(rows, "deduction"), ...componentTotals(rows, "net_deduction")].map((c) => ({ label: c.name, value: c.total }));
  const byDepartment = groupTotals(rows, "department").map((g) => ({ label: g.name, value: g.cost }));
  const byBranch = groupTotals(rows, "branch").map((g) => ({ label: g.name, value: g.cost }));
  const topEarners = [...rows].sort((a, b) => b.gross - a.gross).slice(0, 10);

  const needsFixing = rows.filter((r) => r.slip.warnings?.some((w) => w.blocking));
  const missingBank = rows.filter((r) => r.slip.employee && r.slip.employee.payment_method !== "cash" && (!r.slip.employee.bank_name || !r.slip.employee.bank_account_number));
  const cashCount = rows.filter((r) => r.slip.employee?.payment_method === "cash").length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {back}
      <PageHeader
        title="Payroll dashboard"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={RUN_STATUS[report.status].variant}>{RUN_STATUS[report.status].label}</Badge>
            {report.pay_group?.name ?? "Payroll"} · {report.period_label}
          </span>
        }
        action={
          <Button variant="outline" render={<Link href={`/dashboard/payroll/runs/${id}`} />} nativeButton={false}>
            <Wallet className="size-4" />
            Open pay run
          </Button>
        }
      />

      {/* Filters: one row, above every chart they affect. */}
      <div className="flex flex-wrap items-center gap-3">
        {currencies.length > 1 && (
          <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Currency">
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
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={SELECT_CLASS} aria-label="Branch">
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
        {currencies.length > 1 && <p className="text-xs text-muted-foreground">USD and KHR salaries are shown separately, never added together.</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile emphasis label="Net pay" value={fmt(t.net)} delta={delta(t.net, prev?.net, "neutral")} hint="What staff receive" />
        <StatTile label="Total cost to company" value={fmt(t.cost)} delta={delta(t.cost, prev?.employer_cost, "bad")} hint="Gross + employer NSSF" />
        <StatTile label="Employees paid" value={String(people)} delta={delta(people, prev?.employees, "neutral", (v) => String(Math.round(v)))} hint={`${cashCount} paid in cash`} />
        <StatTile label="Average net pay" value={fmt(average)} delta={prev && prev.employees ? delta(average, prev.net / prev.employees, "neutral") : null} hint="Per person" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Payroll over time"
          description={branch ? "Whole pay group — the branch filter doesn't apply to past runs." : `Last ${history.length} ${history.length === 1 ? "run" : "runs"} of ${report.pay_group?.name ?? "this group"}, in ${active}`}
        >
          {history.length > 1 ? (
            <TrendChart
              data={trend}
              xKey="period"
              highlight={shortPeriod(report)}
              series={[
                { key: "cost", label: "Total cost" },
                { key: "gross", label: "Gross" },
                { key: "net", label: "Net pay" },
              ]}
              format={fmt}
              compact={compact}
            />
          ) : (
            <ChartEmpty>The trend appears once this pay group has more than one run.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard title="Where the money goes" description={`Total cost ${fmt(t.cost)}`}>
          <ShareBar
            total={t.cost}
            format={fmt}
            parts={[
              { label: "Net pay to staff", value: t.net, color: SERIES[0] },
              { label: "NSSF + tax withheld", value: t.nssf + t.tax, color: SERIES[1] },
              { label: "After-tax deductions", value: t.afterTax, color: SERIES[2] },
              { label: "Employer NSSF", value: t.employer, color: SERIES[3] },
            ]}
          />
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Gross pay</dt>
              <dd className="font-medium tabular-nums">{fmt(t.gross)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Deductions before tax</dt>
              <dd className="font-medium tabular-nums">{fmt(t.deductions)}</dd>
            </div>
          </dl>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Cost by department" description="Total cost to company">
          {byDepartment.length ? <BarListChart data={byDepartment} format={fmt} compact={compact} valueLabel="Total cost" /> : <ChartEmpty>No payslips.</ChartEmpty>}
        </ChartCard>
        <ChartCard title="Cost by branch" description="Total cost to company">
          {byBranch.length ? <BarListChart data={byBranch} format={fmt} compact={compact} valueLabel="Total cost" /> : <ChartEmpty>No payslips.</ChartEmpty>}
        </ChartCard>
        <ChartCard title="Earnings by component" description="Salary, allowances, overtime and bonuses">
          {earnings.length ? <BarListChart data={earnings} format={fmt} compact={compact} valueLabel="Paid" /> : <ChartEmpty>No earnings.</ChartEmpty>}
        </ChartCard>
        <ChartCard title="Deductions by component" description="Before and after tax — NSSF and tax are under “Where the money goes”">
          {deductions.length ? (
            <BarListChart data={deductions} format={fmt} compact={compact} valueLabel="Deducted" color={SERIES[1]} />
          ) : (
            <ChartEmpty>No deductions this period.</ChartEmpty>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Net pay distribution" description="How many people fall in each pay band">
          {people ? <ColumnChart data={payBands(rows, active)} valueLabel="People" /> : <ChartEmpty>No payslips.</ChartEmpty>}
        </ChartCard>

        <ChartCard title="Top earners" description="By gross pay · open one to see the payslip">
          <ol className="flex flex-col">
            {topEarners.map((r, i) => (
              <li key={r.slip.id}>
                <button onClick={() => setOpenSlip(r.slip.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.slip.employee?.name ?? "Removed employee"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[r.slip.employee?.job_title, r.slip.employee?.department].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium tabular-nums">{fmt(r.gross)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">net {fmt(r.net)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </ChartCard>
      </div>

      <ChartCard title="Before paying" description="Things to check in this run">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CheckItem
            ok={needsFixing.length === 0}
            icon={FileWarning}
            title={needsFixing.length ? `${needsFixing.length} ${needsFixing.length === 1 ? "payslip needs" : "payslips need"} fixing` : "No payslip problems"}
            detail={needsFixing.length ? needsFixing.slice(0, 3).map((r) => r.slip.employee?.name).join(", ") + (needsFixing.length > 3 ? "…" : "") : "Nothing blocks approval."}
          />
          <CheckItem
            ok={missingBank.length === 0}
            icon={CreditCard}
            title={missingBank.length ? `${missingBank.length} missing bank details` : "Bank details complete"}
            detail={missingBank.length ? missingBank.slice(0, 3).map((r) => r.slip.employee?.name).join(", ") + (missingBank.length > 3 ? "…" : "") : "Everyone paid by bank has an account."}
          />
          <CheckItem
            ok={report.status === "approved" || report.status === "paid"}
            icon={CheckCircle2}
            title={report.status === "paid" ? "Paid" : report.status === "approved" ? "Approved — ready to pay" : "Not approved yet"}
            detail={report.approved_by ? `Approved by ${report.approved_by.name}` : "Figures can still change until the run is approved."}
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
