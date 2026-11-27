import type { Worksheet } from "exceljs";
import { api, type PayRunReport, type PayRunReportRow, type PayrollPolicy } from "@/lib/api";
import { downloadWorkbook } from "@/lib/excel";

/**
 * Bulk salary transfer files, laid out exactly as each bank's upload screen
 * expects. Adding a bank: a new entry in BANK_FORMATS and its sheet writer.
 */

export type BankFormat = "chipmong" | "aba";

export const BANK_FORMATS: { key: BankFormat; name: string; /** Matched against the bank typed on each employee. */ match: RegExp }[] = [
  { key: "chipmong", name: "Chip Mong Bank", match: /chip\s*-?\s*mong|cmcb/i },
  { key: "aba", name: "ABA Bank", match: /\baba\b|advanced bank of asia/i },
];

/** One transfer: who, which account, how much. */
export type BankTransfer = {
  name: string;
  code: string;
  account: string;
  amount: number;
  /** This row's own narration, when rows from several runs share a sheet; else the file's remarks. */
  remarks?: string;
};

export type BankFileOptions = {
  format: BankFormat;
  currency: string;
  transfers: BankTransfer[];
  /** The narration each person sees, e.g. "Payroll Sep 26". */
  remarks: string;
  /** Chip Mong's header row. */
  companyCode?: string;
  debitAccount?: string;
  /** YYYY-MM-DD; Chip Mong shows it as DD-MM-YYYY. */
  valueDate?: string;
  filename: string;
};

export type SkippedSlip = { name: string; reason: "cash" | "noAccount" | "nothingToPay" | "otherBank" };

const n = (v: unknown) => Number(v ?? 0);
const cents = (v: number) => Math.round(v * 100) / 100;

/** Banks reject spaces and dashes inside an account number. */
export function cleanAccount(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s-]/g, "");
}

/** Whether the bank typed on an employee is this format's bank. */
export function isBank(format: BankFormat, bankName: string | null | undefined): boolean {
  const bank = BANK_FORMATS.find((b) => b.key === format);
  return !!bank && !!bankName && bank.match.test(bankName);
}

/**
 * The transfers in one currency, and everyone left out with why. `sameBankOnly`
 * keeps only people whose account is at the chosen bank.
 */
export function bankTransfers(slips: PayRunReportRow[], currency: string, format: BankFormat, sameBankOnly: boolean) {
  const transfers: BankTransfer[] = [];
  const skipped: SkippedSlip[] = [];

  for (const slip of slips) {
    if (slip.currency !== currency) continue;
    const e = slip.employee;
    const name = e?.bank_account_name || e?.name || "";
    const net = cents(n(slip.net));
    if (net <= 0) skipped.push({ name, reason: "nothingToPay" });
    else if (e?.payment_method === "cash") skipped.push({ name, reason: "cash" });
    // Before the same-bank check: paid by bank with no bank details typed in at all is a gap
    // HR must fix (it raises the warning), not "another bank" quietly left out.
    else if (!e?.bank_name?.trim() && !cleanAccount(e?.bank_account_number)) skipped.push({ name, reason: "noAccount" });
    else if (sameBankOnly && !isBank(format, e?.bank_name)) skipped.push({ name, reason: "otherBank" });
    else if (!cleanAccount(e?.bank_account_number)) skipped.push({ name, reason: "noAccount" });
    else transfers.push({ name, code: e?.employee_code ?? "", account: cleanAccount(e?.bank_account_number), amount: net });
  }

  return { transfers, skipped };
}

/** "Payroll Sep 26" for a period ending in September 2026. */
export function defaultRemarks(periodEnd: string): string {
  const [y, m] = periodEnd.split("-");
  // Spelled out here: browsers disagree on short months ("Sep" vs "Sept").
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Payroll ${months[Number(m) - 1]} ${y.slice(2)}`;
}

/** A number cell when the account is plain digits (as the bank's sample has it); text when a leading zero would be lost. */
function accountCell(account: string): string | number {
  return /^[1-9]\d{0,14}$/.test(account) ? Number(account) : account;
}

function excelDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Chip Mong: no header. Row 1 is the company code, debit account, total,
 * currency and value date; then one "A" row per person: amount, account,
 * and the remarks twice.
 */
function chipmongSheet(sheet: Worksheet, o: BankFileOptions) {
  const total = cents(o.transfers.reduce((t, r) => t + r.amount, 0));
  const head = sheet.addRow([o.companyCode ?? "", o.debitAccount ?? "", total, o.currency, o.valueDate ? excelDate(o.valueDate) : null]);
  head.getCell(3).numFmt = "0.00";
  head.getCell(5).numFmt = "dd-mm-yyyy";

  for (const r of o.transfers) {
    const remarks = r.remarks ?? o.remarks;
    sheet.addRow(["A", r.amount, accountCell(r.account), remarks, remarks]).getCell(2).numFmt = "0.00";
  }
  [10, 14, 14, 18, 18].forEach((width, i) => (sheet.getColumn(i + 1).width = width));
}

/** ABA: a header row, then one row per person. The account stays text so leading zeros survive. */
function abaSheet(sheet: Worksheet, o: BankFileOptions) {
  sheet.addRow(["Employee Name", "Employee Id", "Account Number", "Amount", "Remarks"]).font = { bold: true };
  for (const r of o.transfers) {
    sheet.addRow([r.name, r.code, r.account, r.amount, r.remarks ?? o.remarks]).getCell(4).numFmt = "0.00";
  }
  [28, 14, 18, 12, 18].forEach((width, i) => (sheet.getColumn(i + 1).width = width));
}

/** Writes the chosen bank's layout onto an empty sheet. */
export function fillBankSheet(sheet: Worksheet, o: BankFileOptions) {
  (o.format === "chipmong" ? chipmongSheet : abaSheet)(sheet, o);
}

export async function downloadBankFile(o: BankFileOptions) {
  await downloadWorkbook(o.filename, (book) => book.worksheet("Sheet1", (sheet) => fillBankSheet(sheet, o)));
}

// ───────────────────────── Several runs in one file ─────────────────────────

/** One upload batch: one run's transfers in one currency (banks never mix currencies). */
export type BankBatch = { run: PayRunReport; currency: string; transfers: BankTransfer[]; skipped: SkippedSlip[] };

/**
 * The batches for several runs, one per run and currency, in the order given.
 * Like the one-run dialog: when nobody in any run banks at the chosen bank,
 * `sameBankOnly` is dropped so the file isn't empty (`filtered` says which applied).
 */
export function bankBatches(reports: PayRunReport[], format: BankFormat, sameBankOnly: boolean) {
  const anyAtBank = reports.some((r) => r.payslips.some((p) => isBank(format, p.employee?.bank_name)));
  const filtered = sameBankOnly && anyAtBank;
  const batches: BankBatch[] = reports.flatMap((run) =>
    [...new Set(run.payslips.map((p) => p.currency))].map((currency) => ({ run, currency, ...bankTransfers(run.payslips, currency, format, filtered) })),
  );
  return { batches, anyAtBank, filtered };
}

/**
 * One workbook, each sheet laid out as the bank expects and uploaded on its own:
 *   - "All USD" / "All KHR" first (two batches or more in that currency): every
 *     run's transfers together, each row keeping its own run's remarks. First,
 *     because a bank's upload screen often reads only the first sheet.
 *   - Then one sheet per batch; its remarks name the run's period ("Payroll Oct 26").
 */
export async function downloadBankWorkbook(
  filename: string,
  batches: BankBatch[],
  options: Pick<BankFileOptions, "format" | "companyCode" | "debitAccount" | "valueDate">,
) {
  // Oldest period first, whatever order the batches came in.
  const filled = batches.filter((x) => x.transfers.length > 0).sort((a, b) => a.run.period_end.localeCompare(b.run.period_end));
  await downloadWorkbook(filename, (book) => {
    for (const currency of [...new Set(filled.map((b) => b.currency))]) {
      const inCurrency = filled.filter((b) => b.currency === currency);
      // With one batch the combined sheet would only repeat it.
      if (inCurrency.length < 2) continue;
      const transfers = inCurrency.flatMap((b) => b.transfers.map((tr) => ({ ...tr, remarks: defaultRemarks(b.run.period_end) })));
      book.worksheet(`All ${currency}`, (sheet) =>
        fillBankSheet(sheet, { ...options, currency, transfers, remarks: defaultRemarks(inCurrency[inCurrency.length - 1].run.period_end), filename }),
      );
    }

    for (const b of filled) {
      // Currency first so the 31-character cut never drops it.
      const name = `${b.currency} ${b.run.period_label}${b.run.pay_group ? ` ${b.run.pay_group.name}` : ""}`;
      book.worksheet(name, (sheet) =>
        fillBankSheet(sheet, { ...options, currency: b.currency, transfers: b.transfers, remarks: defaultRemarks(b.run.period_end), filename }),
      );
    }
  });
}

/**
 * Saves Chip Mong's company code and debit account on the payroll policy when
 * they changed, so the next export is filled in. Returns what is saved now.
 */
export async function rememberChipmong(saved: PayrollPolicy["bank_exports"], companyCode: string, debitAccount: string): Promise<PayrollPolicy["bank_exports"]> {
  const next = { company_code: companyCode.trim(), debit_account: debitAccount.trim() };
  if (next.company_code === (saved?.chipmong?.company_code ?? "") && next.debit_account === (saved?.chipmong?.debit_account ?? "")) return saved;
  const policy = await api.payroll.updatePolicy({ bank_exports: { ...saved, chipmong: next } });
  return policy.bank_exports;
}
