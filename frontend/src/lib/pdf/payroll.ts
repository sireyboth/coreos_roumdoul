import type { PayLineKind, PayRunReport, PayRunStatus } from "@/lib/api";
import { byCurrency, componentTotals, groupTotals, REGISTER_NUMBERS, totalsOf, type RegisterRow, type RegisterTotals } from "@/lib/payroll-report";
import { escapeHtml as esc, printHtmlDocument, REPORT_FONTS } from "@/lib/print-pdf";

/**
 * A pay run as a printed payroll report, saved as PDF by the browser (see
 * print-pdf.ts for why it isn't made with a PDF library).
 *
 * Reads like an accountant's pack: summary, payroll register, what each pay
 * component cost, cost by branch and department, an optional payment list,
 * and a sign-off block.
 */

export type PayrollPdfOptions = {
  company: string;
  generatedBy?: string | null;
  report: PayRunReport;
  /** Adds the bank / cash list. It holds account numbers, so it's opt-in. */
  includePayments: boolean;
};

const STATUS_LABEL: Record<PayRunStatus, string> = { draft: "Draft", calculated: "In review", approved: "Approved", paid: "Paid" };

const SECTIONS: { kind: PayLineKind; title: string }[] = [
  { kind: "earning", title: "Earnings" },
  { kind: "deduction", title: "Deductions (before tax)" },
  { kind: "statutory", title: "NSSF and tax on salary (employee)" },
  { kind: "net_deduction", title: "After-tax deductions" },
  { kind: "employer", title: "Paid by the company (not from pay)" },
];

/** An amount without its symbol — the currency is in each table's heading. Zero shows as a quiet dot. */
function amt(value: number, currency: string, { zero = false }: { zero?: boolean } = {}): string {
  if (!zero && Math.abs(value) < 0.005) return `<span class="muted">·</span>`;
  return value.toLocaleString("en-US", currency === "KHR" ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** With its symbol, for headline figures. */
function money(value: number, currency: string): string {
  if (currency === "KHR") return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} ៛`;
  if (currency === "USD") return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return value.toLocaleString("en-US");
}

const day = (value: string | null | undefined) =>
  value ? new Date(value.length > 10 ? value : `${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

type Totals = RegisterTotals;
const NUMBERS = REGISTER_NUMBERS;

function header(o: PayrollPdfOptions): string {
  const r = o.report;
  const generated = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rows: [string, string][] = [
    ["Pay group", r.pay_group?.name ?? "Payroll"],
    ["Period", `${day(r.period_start)} → ${day(r.period_end)}`],
    ["Status", STATUS_LABEL[r.status]],
    ...(r.approved_at ? ([["Approved", `${day(r.approved_at)}${r.approved_by ? ` · ${r.approved_by.name}` : ""}`]] as [string, string][]) : []),
    ...(r.paid_at ? ([["Paid", `${day(r.paid_at)}${r.paid_by ? ` · ${r.paid_by.name}` : ""}`]] as [string, string][]) : []),
    ["Generated", `${generated}${o.generatedBy ? ` · ${o.generatedBy}` : ""}`],
  ];
  return `
  <header class="masthead">
    <div>
      <p class="eyebrow">${esc(o.company)}</p>
      <h1>Payroll Report</h1>
      <p class="period">${esc(r.pay_group?.name ?? "Payroll")} · ${esc(r.period_label)}</p>
    </div>
    <dl class="meta">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  </header>
  ${
    r.status === "approved" || r.status === "paid"
      ? ""
      : `<p class="draft-note"><strong>Not approved yet.</strong> These figures can still change when attendance, salaries or rules are updated and the run is recalculated.</p>`
  }`;
}

function kpis(currency: string, rows: RegisterRow[]): string {
  const t = totalsOf(rows);
  const cards: [string, string, string][] = [
    ["Employees", String(rows.length), rows.length === 1 ? "payslip" : "payslips"],
    ["Gross pay", money(t.gross, currency), `earnings ${money(t.base + t.otherEarnings, currency)}`],
    ["Deductions", money(t.deductions + t.afterTax, currency), "before and after tax"],
    ["NSSF + tax withheld", money(t.nssf + t.tax, currency), `NSSF ${money(t.nssf, currency)} · tax ${money(t.tax, currency)}`],
    ["Net pay", money(t.net, currency), "to pay staff"],
    ["Cost to company", money(t.cost, currency), `incl. employer NSSF ${money(t.employer, currency)}`],
  ];
  return `<section class="kpis">${cards
    .map(([label, value, sub], i) => `<div class="kpi${i === 4 ? " kpi-accent" : ""}"><p class="kpi-label">${esc(label)}</p><p class="kpi-value">${esc(value)}</p><p class="kpi-sub">${esc(sub)}</p></div>`)
    .join("")}</section>`;
}

function register(currency: string, rows: RegisterRow[]): string {
  const t = totalsOf(rows);
  const cells = (r: Totals, strong = false) =>
    NUMBERS.map((k) => {
      const cls = ["num", k === "gross" || k === "net" ? "key" : "", k === "employer" ? "sep" : ""].filter(Boolean).join(" ");
      const v = amt(r[k], currency, { zero: strong });
      return `<td class="${cls}">${k === "net" ? `<strong>${v}</strong>` : v}</td>`;
    }).join("");
  const body = rows
    .map(
      (r, i) => `<tr>
        <td class="rank">${i + 1}</td>
        <td class="who"><strong>${esc(r.slip.employee?.name ?? "Removed employee")}</strong><br><span class="muted small">${esc(
          [r.slip.employee?.employee_code, r.slip.employee?.job_title, r.slip.pay_type === "daily" ? "daily pay" : ""].filter(Boolean).join(" · "),
        )}</span></td>
        ${cells(r)}
      </tr>`,
    )
    .join("");

  return `<section>
    <h2>Payroll register <span class="h2-note">${esc(currency)} · one line per payslip</span></h2>
    <table class="data register">
      <thead>
        <tr class="bands">
          <th colspan="2"></th><th colspan="4" class="band">Pay</th><th colspan="4" class="band">Withheld from pay</th><th colspan="2" class="band sep">Company</th>
        </tr>
        <tr>
          <th class="rank">#</th><th>Employee</th>
          <th class="num">Base salary</th><th class="num">Other earnings</th><th class="num">Deductions</th><th class="num key">Gross</th>
          <th class="num">NSSF</th><th class="num">Tax</th><th class="num">After-tax</th><th class="num key">Net pay</th>
          <th class="num sep">Employer NSSF</th><th class="num">Total cost</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td></td><td>Total · ${rows.length} ${rows.length === 1 ? "employee" : "employees"}</td>${cells(t, true)}</tr></tfoot>
    </table>
  </section>`;
}

/** What each pay component added up to across the run. */
function components(currency: string, rows: RegisterRow[]): string {
  const sections = SECTIONS.map((s) => {
    const list = componentTotals(rows, s.kind);
    if (list.length === 0) return "";
    const total = list.reduce((t, l) => t + l.total, 0);
    return `<tbody>
      <tr class="group"><td colspan="3">${esc(s.title)}</td><td class="num">${amt(total, currency, { zero: true })}</td></tr>
      ${list.map((l) => `<tr><td>${esc(l.name)}</td><td class="muted small mono">${esc(l.code)}</td><td class="num">${l.people}</td><td class="num">${amt(l.total, currency)}</td></tr>`).join("")}
    </tbody>`;
  }).join("");

  return `<section class="avoid-break">
    <h2>Pay components <span class="h2-note">${esc(currency)} · totals for the run</span></h2>
    <table class="data compact">
      <thead><tr><th>Component</th><th>Code</th><th class="num">People</th><th class="num">Amount</th></tr></thead>
      ${sections}
    </table>
  </section>`;
}

/** Where the money goes: by branch, then department. */
function costCentres(currency: string, rows: RegisterRow[]): string {
  const all = totalsOf(rows);
  const list = groupTotals(rows, "both").sort((a, b) => a.name.localeCompare(b.name));
  const body = list
    .map((t) => {
      const share = all.cost > 0 ? Math.round((t.cost / all.cost) * 1000) / 10 : 0;
      return `<tr><td>${esc(t.name)}</td><td class="num">${t.people}</td><td class="num">${amt(t.gross, currency)}</td><td class="num">${amt(t.net, currency)}</td><td class="num">${amt(t.cost, currency)}</td><td class="num muted">${share}%</td></tr>`;
    })
    .join("");

  return `<section class="avoid-break">
    <h2>Cost by branch and department <span class="h2-note">${esc(currency)}</span></h2>
    <table class="data compact">
      <thead><tr><th>Branch · Department</th><th class="num">People</th><th class="num">Gross</th><th class="num">Net pay</th><th class="num">Total cost</th><th class="num">Share</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${rows.length}</td><td class="num">${amt(all.gross, currency, { zero: true })}</td><td class="num">${amt(all.net, currency, { zero: true })}</td><td class="num">${amt(all.cost, currency, { zero: true })}</td><td class="num">100%</td></tr></tfoot>
    </table>
  </section>`;
}

/** Who to pay and where: bank transfers grouped by bank, then cash with a signature column. */
function payments(currency: string, rows: RegisterRow[]): string {
  const bank = rows.filter((r) => r.slip.employee?.payment_method !== "cash" && r.net > 0);
  const cash = rows.filter((r) => r.slip.employee?.payment_method === "cash" && r.net > 0);
  // By bank, so each bank's transfers can be keyed in together; anyone missing details goes last.
  const bankOf = (r: RegisterRow) => r.slip.employee?.bank_name ?? "";
  bank.sort((a, b) => Number(!bankOf(a)) - Number(!bankOf(b)) || bankOf(a).localeCompare(bankOf(b)) || (a.slip.employee?.name ?? "").localeCompare(b.slip.employee?.name ?? ""));
  const sum = (rs: RegisterRow[]) => rs.reduce((t, r) => t + r.net, 0);

  const bankTable = bank.length
    ? `<h3>Bank transfer <span class="h2-note">${bank.length} ${bank.length === 1 ? "person" : "people"} · ${esc(money(sum(bank), currency))}</span></h3>
    <table class="data compact">
      <thead><tr><th class="rank">#</th><th>Employee</th><th>Bank</th><th>Account number</th><th>Account name</th><th class="num">Net pay</th></tr></thead>
      <tbody>${bank
        .map((r, i) => {
          const e = r.slip.employee;
          const missing = !e?.bank_name || !e?.bank_account_number;
          return `<tr${missing ? ` class="flag"` : ""}>
            <td class="rank">${i + 1}</td>
            <td><strong>${esc(e?.name ?? "Removed employee")}</strong>${e?.employee_code ? ` <span class="muted small">${esc(e.employee_code)}</span>` : ""}</td>
            <td>${esc(e?.bank_name) || `<span class="warn">Missing</span>`}</td>
            <td class="mono">${esc(e?.bank_account_number) || `<span class="warn">Missing</span>`}</td>
            <td>${esc(e?.bank_account_name || e?.name)}</td>
            <td class="num"><strong>${amt(r.net, currency, { zero: true })}</strong></td>
          </tr>`;
        })
        .join("")}</tbody>
      <tfoot><tr><td></td><td colspan="4">Total bank transfer</td><td class="num">${amt(sum(bank), currency, { zero: true })}</td></tr></tfoot>
    </table>`
    : "";

  const cashTable = cash.length
    ? `<h3>Cash <span class="h2-note">${cash.length} ${cash.length === 1 ? "person" : "people"} · ${esc(money(sum(cash), currency))}</span></h3>
    <table class="data compact">
      <thead><tr><th class="rank">#</th><th>Employee</th><th>Position</th><th class="num">Net pay</th><th class="signature">Received by (signature &amp; date)</th></tr></thead>
      <tbody>${cash
        .map(
          (r, i) => `<tr class="tall">
            <td class="rank">${i + 1}</td>
            <td><strong>${esc(r.slip.employee?.name ?? "Removed employee")}</strong>${r.slip.employee?.employee_code ? ` <span class="muted small">${esc(r.slip.employee.employee_code)}</span>` : ""}</td>
            <td class="muted">${esc(r.slip.employee?.job_title ?? "")}</td>
            <td class="num"><strong>${amt(r.net, currency, { zero: true })}</strong></td>
            <td class="signature"></td>
          </tr>`,
        )
        .join("")}</tbody>
      <tfoot><tr><td></td><td colspan="2">Total cash</td><td class="num">${amt(sum(cash), currency, { zero: true })}</td><td></td></tr></tfoot>
    </table>`
    : "";

  if (!bankTable && !cashTable) return "";
  return `<section class="page-start">
    <h2>Payment list <span class="h2-note">${esc(currency)} · confidential</span></h2>
    ${bankTable}
    ${cashTable}
  </section>`;
}

function signOff(o: PayrollPdfOptions): string {
  const r = o.report;
  const boxes: [string, string, string][] = [
    ["Prepared by", o.generatedBy ?? "", ""],
    ["Reviewed by", "", ""],
    ["Approved by", r.approved_by?.name ?? "", r.approved_at ? day(r.approved_at) : ""],
  ];
  return `<section class="signoff">
    ${boxes
      .map(
        ([role, name, date]) => `<div class="sign">
        <p class="sign-role">${esc(role)}</p>
        <div class="sign-line"></div>
        <p class="sign-field"><span>Name</span>${esc(name)}</p>
        <p class="sign-field"><span>Date</span>${esc(date)}</p>
      </div>`,
      )
      .join("")}
  </section>`;
}

const DEFINITIONS = `<section class="definitions">
  <h2>How to read this report</h2>
  <dl>
    <div><dt>Gross</dt><dd>Base salary + other earnings (allowances, overtime, bonuses) − deductions taken before tax (absence, lateness, unpaid leave).</dd></div>
    <div><dt>Net pay</dt><dd>Gross − employee NSSF − tax on salary − after-tax deductions (advances, loan repayments). What each person receives.</dd></div>
    <div><dt>Total cost</dt><dd>Gross + employer NSSF contributions: what the period costs the company.</dd></div>
    <div><dt>Currencies</dt><dd>USD and KHR salaries are reported separately and never added together.</dd></div>
  </dl>
</section>`;

const STYLES = (footer: string) => `
  @page { size: A4 landscape; margin: 12mm 12mm 14mm;
    @bottom-left { content: ${footer}; font: 7.5pt "Inter", sans-serif; color: #64748b; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7.5pt "Inter", sans-serif; color: #64748b; } }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { font-family: "Inter", "Segoe UI", "Noto Sans Khmer", "Khmer UI", "Leelawadee UI", system-ui, sans-serif; color: #0f172a; font-size: 8.5pt; line-height: 1.4; }
  body { margin: 0; }
  .muted { color: #64748b; } .small { font-size: 7pt; } .mono { font-variant-numeric: tabular-nums; } .warn { color: #b45309; font-weight: 600; }
  .masthead { display: flex; justify-content: space-between; gap: 24px; padding-top: 12px; border-top: 4px solid #4f46e5; margin-bottom: 12px; }
  .eyebrow { margin: 0; font-size: 8pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #4f46e5; }
  h1 { margin: 4px 0 2px; font-size: 21pt; font-weight: 700; letter-spacing: -.02em; }
  .period { margin: 0; font-size: 11pt; color: #334155; }
  .meta { margin: 0; display: grid; gap: 3px; font-size: 7.5pt; min-width: 250px; }
  .meta div { display: grid; grid-template-columns: 64px 1fr; gap: 8px; }
  .meta dt { color: #64748b; } .meta dd { margin: 0; font-weight: 500; }
  .draft-note { margin: 0 0 12px; padding: 7px 10px; border: 1px solid #fcd34d; background: #fffbeb; color: #78350f; border-radius: 6px; font-size: 8pt; }
  .currency { margin-top: 6px; }
  .currency + .currency { break-before: page; }
  .currency-title { display: flex; align-items: baseline; gap: 8px; margin: 4px 0 8px; font-size: 10pt; font-weight: 700; }
  .currency-title span { font-size: 7.5pt; font-weight: 500; color: #64748b; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
  .kpi-accent { border-color: #c7d2fe; background: #eef2ff; }
  .kpi-label { margin: 0; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  .kpi-value { margin: 3px 0 1px; font-size: 13pt; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .kpi-sub { margin: 0; font-size: 6.5pt; color: #64748b; }
  h2 { font-size: 11pt; margin: 16px 0 6px; break-after: avoid; }
  h3 { font-size: 9pt; margin: 12px 0 4px; break-after: avoid; }
  .h2-note { font-size: 7.5pt; font-weight: 400; color: #64748b; margin-left: 6px; }
  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; } tfoot { display: table-row-group; }
  tr { break-inside: avoid; }
  .data th { white-space: nowrap; text-align: left; font-size: 6.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #64748b; padding: 5px 5px; border-bottom: 1.5px solid #cbd5e1; }
  .data td { padding: 4px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .data tfoot td { font-weight: 700; border-top: 1.5px solid #94a3b8; border-bottom: 3px double #94a3b8; background: #f8fafc; }
  .num, .data th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rank { width: 18px; color: #94a3b8; }
  .register .bands th { border-bottom: none; padding-bottom: 0; }
  .register .band { text-align: center; color: #4f46e5; border-bottom: 1px solid #c7d2fe; }
  .register .key { background: #f8fafc; }
  .register thead .key { background: transparent; color: #0f172a; }
  .register .sep { border-left: 1.5px solid #e2e8f0; }
  .register .who { min-width: 150px; }
  .compact td { padding: 3.5px 5px; }
  .compact .group td { background: #f1f5f9; font-weight: 600; font-size: 7.5pt; border-bottom: none; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .avoid-break { break-inside: avoid; }
  .page-start { break-before: page; }
  .flag td { background: #fffbeb; }
  .tall td { height: 26px; vertical-align: middle; }
  .signature { width: 34%; }
  td.signature { border-bottom: 1px solid #94a3b8; }
  .signoff { break-inside: avoid; display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 26px; }
  .sign-role { margin: 0 0 34px; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
  .sign-line { border-bottom: 1px solid #0f172a; margin-bottom: 6px; }
  .sign-field { margin: 3px 0 0; font-size: 8pt; min-height: 12px; }
  .sign-field span { display: inline-block; width: 38px; color: #64748b; }
  .definitions { break-inside: avoid; margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
  .definitions h2 { font-size: 8.5pt; margin-top: 0; }
  .definitions dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 18px; font-size: 7.5pt; }
  .definitions dt { font-weight: 600; } .definitions dd { margin: 0; color: #475569; }
`;

/** The whole report as an HTML document. */
export function payrollPdfHtml(o: PayrollPdfOptions): string {
  const r = o.report;
  const group = r.pay_group?.name ?? "Payroll";
  const footer = `"${`${o.company} · Payroll report · ${group} · ${r.period_label}`.replace(/"/g, "'")} · Confidential"`;
  const title = `Payroll report ${group} ${r.period_start} to ${r.period_end}`;
  const currencies = byCurrency(r.payslips);
  const multi = currencies.length > 1;

  const body = currencies
    .map(
      ([currency, rows]) => `<div class="currency">
      ${multi ? `<p class="currency-title">Paid in ${esc(currency)}<span>${rows.length} ${rows.length === 1 ? "payslip" : "payslips"}</span></p>` : ""}
      ${kpis(currency, rows)}
      ${register(currency, rows)}
      <div class="two-col">
        ${components(currency, rows)}
        ${costCentres(currency, rows)}
      </div>
      ${o.includePayments ? payments(currency, rows) : ""}
    </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
${REPORT_FONTS}
<style>${STYLES(footer)}</style></head>
<body>
  ${header(o)}
  ${body || `<p class="muted">No payslips in this run.</p>`}
  ${signOff(o)}
  ${DEFINITIONS}
</body></html>`;
}

/** Lays the report out and opens the print dialog, where "Save as PDF" makes the file. */
export function printPayrollPdf(o: PayrollPdfOptions): Promise<void> {
  return printHtmlDocument(payrollPdfHtml(o));
}
