import type { PayRun, PayRunReport, PayRunReportRow, PayRunStatus } from "@/lib/api";
import { downloadWorkbook, today, type SheetColumn } from "@/lib/excel";

/**
 * Several pay runs in one Excel file, for the accountant or the bank:
 *   - "Summary" first: one row per run (and per currency), with grand totals.
 *   - "All payslips" (two runs or more): every payslip together, with its run.
 *   - Then one sheet per run: one row per payslip, with totals at the bottom.
 *
 * Built in the browser from each run's report (GET /payroll/runs/{id}/report),
 * the same data the printed PDF uses, so no extra backend endpoint is needed.
 * Column headers stay in English, like the CSV export: they are file headers
 * that accountants and bank uploads expect.
 */

// USD and KHR are never added together, so every total is per currency.
type Money = { gross: number; nssf: number; tax: number; net: number; employerCost: number };

type SummaryRow = Money & {
  period: string;
  start: string | null;
  end: string | null;
  group: string;
  status: string;
  currency: string;
  employees: number | null;
  approvedBy: string;
  approvedOn: string | null;
  paidOn: string | null;
};

type SlipRow = Money & {
  period: string;
  group: string;
  code: string;
  name: string;
  department: string;
  jobTitle: string;
  currency: string;
  base: number | null;
  method: string;
  bank: string;
  account: string;
  accountName: string;
};

const STATUS_LABEL: Record<PayRunStatus, string> = { draft: "Draft", calculated: "Calculated", approved: "Approved", paid: "Paid" };

const MONEY = "#,##0.00";
const n = (v: unknown) => Number(v ?? 0);
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

const moneyColumns = <T extends Money>(): SheetColumn<T>[] => [
  { header: "Gross", value: (r) => r.gross, type: "number", format: MONEY },
  { header: "NSSF (employee)", value: (r) => r.nssf, type: "number", format: MONEY },
  { header: "Tax on salary", value: (r) => r.tax, type: "number", format: MONEY },
  { header: "Net pay", value: (r) => r.net, type: "number", format: MONEY },
  { header: "Employer cost", value: (r) => r.employerCost, type: "number", format: MONEY },
];

/** Adds up rows that share a currency: one total per currency, in order of first appearance. */
function totalsByCurrency<T extends Money & { currency: string }>(rows: T[]): Map<string, Money & { count: number }> {
  const totals = new Map<string, Money & { count: number }>();
  for (const r of rows) {
    const t = totals.get(r.currency) ?? { gross: 0, nssf: 0, tax: 0, net: 0, employerCost: 0, count: 0 };
    t.gross += r.gross;
    t.nssf += r.nssf;
    t.tax += r.tax;
    t.net += r.net;
    t.employerCost += r.employerCost;
    t.count += 1;
    totals.set(r.currency, t);
  }
  return totals;
}

/** "1 – 16 Oct 2026 · Office staff": the run's sheet name (cut to Excel's 31 characters by the helper). */
function runSheetName(run: PayRun): string {
  return run.pay_group ? `${run.period_label} · ${run.pay_group.name}` : run.period_label;
}

function summaryRows(runs: PayRun[]): SummaryRow[] {
  return runs.flatMap((run): SummaryRow[] => {
    const base = {
      period: run.period_label,
      start: run.period_start,
      end: run.period_end,
      group: run.pay_group?.name ?? "",
      status: STATUS_LABEL[run.status],
      approvedBy: run.approved_by?.name ?? "",
      approvedOn: day(run.approved_at),
      paidOn: day(run.paid_at),
    };
    const totals = Object.entries(run.totals ?? {});
    // A draft run has no totals yet: still listed, with empty amounts.
    if (totals.length === 0) {
      return [{ ...base, currency: "", employees: null, gross: 0, nssf: 0, tax: 0, net: 0, employerCost: 0 }];
    }
    return totals.map(([currency, t]) => ({
      ...base,
      currency,
      employees: t.employees,
      gross: n(t.gross),
      nssf: n(t.nssf_employee),
      tax: n(t.tax),
      net: n(t.net),
      employerCost: n(t.employer_cost),
    }));
  });
}

function slipRow(slip: PayRunReportRow, run: PayRun): SlipRow {
  const e = slip.employee;
  return {
    period: run.period_label,
    group: run.pay_group?.name ?? "",
    code: e?.employee_code ?? "",
    name: e?.name ?? "",
    department: e?.department ?? "",
    jobTitle: e?.job_title ?? "",
    currency: slip.currency,
    base: n(slip.base_salary),
    gross: n(slip.gross),
    nssf: n(slip.nssf_employee),
    tax: n(slip.tax),
    net: n(slip.net),
    employerCost: n(slip.employer_cost),
    method: e?.payment_method === "cash" ? "Cash" : e?.payment_method === "bank" ? "Bank" : "",
    bank: e?.bank_name ?? "",
    account: e?.bank_account_number ?? "",
    accountName: e?.bank_account_name ?? "",
  };
}

const SUMMARY_COLUMNS: SheetColumn<SummaryRow>[] = [
  { header: "Period", value: (r) => r.period },
  { header: "Period start", value: (r) => r.start, type: "date" },
  { header: "Period end", value: (r) => r.end, type: "date" },
  { header: "Pay group", value: (r) => r.group },
  { header: "Status", value: (r) => r.status },
  { header: "Currency", value: (r) => r.currency },
  { header: "Employees", value: (r) => r.employees, type: "number" },
  ...moneyColumns<SummaryRow>(),
  { header: "Approved by", value: (r) => r.approvedBy },
  { header: "Approved on", value: (r) => r.approvedOn, type: "date" },
  { header: "Paid on", value: (r) => r.paidOn, type: "date" },
];

/** Which run a payslip came from — only on the combined sheet; a run's own sheet names it already. */
const RUN_COLUMNS: SheetColumn<SlipRow>[] = [
  { header: "Period", value: (r) => r.period },
  { header: "Pay group", value: (r) => r.group },
];

const SLIP_COLUMNS: SheetColumn<SlipRow>[] = [
  // Kept as text: an ID like "007" must not lose its zeros.
  { header: "Employee ID", value: (r) => r.code },
  { header: "Employee", value: (r) => r.name },
  { header: "Department", value: (r) => r.department },
  { header: "Job title", value: (r) => r.jobTitle },
  { header: "Currency", value: (r) => r.currency },
  { header: "Base salary", value: (r) => r.base, type: "number", format: MONEY },
  ...moneyColumns<SlipRow>(),
  { header: "Payment method", value: (r) => r.method },
  { header: "Bank", value: (r) => r.bank },
  { header: "Account number", value: (r) => r.account },
  { header: "Account name", value: (r) => r.accountName },
];

/**
 * Downloads the chosen runs as one workbook. `reports` are the runs' reports,
 * in any order: sheets follow the period (oldest first), then the pay group name.
 */
export async function downloadPayRunsWorkbook(reports: PayRunReport[]) {
  const ordered = [...reports].sort(
    (a, b) => a.period_end.localeCompare(b.period_end) || (a.pay_group?.name ?? "").localeCompare(b.pay_group?.name ?? ""),
  );
  const summary = summaryRows(ordered);

  await downloadWorkbook(`pay-runs-${today()}`, (book) => {
    book.sheet({
      name: "Summary",
      columns: SUMMARY_COLUMNS,
      rows: summary,
      footer: [...totalsByCurrency(summary.filter((r) => r.currency))].map(([currency, t]) => ({
        ...t,
        period: currency ? `Total ${currency}` : "Total",
        start: null,
        end: null,
        group: "",
        status: "",
        currency,
        employees: summary.filter((r) => r.currency === currency).reduce((sum, r) => sum + (r.employees ?? 0), 0),
        approvedBy: "",
        approvedOn: null,
        paidOn: null,
      })),
    });

    const perRun = ordered.map((report) => ({ report, rows: report.payslips.map((s) => slipRow(s, report)).sort((a, b) => a.name.localeCompare(b.name)) }));

    // Every payslip of every run on one sheet, run after run, to filter or pivot.
    // Only worth it for two runs or more; with one it would repeat the run's sheet.
    if (perRun.length > 1) {
      const all = perRun.flatMap((r) => r.rows);
      book.sheet({ name: "All payslips", columns: [...RUN_COLUMNS, ...SLIP_COLUMNS], rows: all, footer: slipTotals(all, "payslip") });
    }

    for (const { report, rows } of perRun) {
      book.sheet({ name: runSheetName(report), columns: SLIP_COLUMNS, rows, footer: slipTotals(rows, "employee") });
    }
  });
}

/** Bold total rows under a payslip list, one per currency: "Total USD · 12 employees". */
function slipTotals(rows: SlipRow[], noun: "employee" | "payslip"): SlipRow[] {
  return [...totalsByCurrency(rows)].map(([currency, t]) => ({
    ...t,
    period: "",
    group: "",
    code: `Total ${currency}`,
    name: `${t.count} ${noun}${t.count === 1 ? "" : "s"}`,
    department: "",
    jobTitle: "",
    currency,
    base: null,
    method: "",
    bank: "",
    account: "",
    accountName: "",
  }));
}
