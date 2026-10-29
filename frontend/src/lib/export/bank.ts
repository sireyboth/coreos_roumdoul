import type { Worksheet } from "exceljs";
import type { PayRunReportRow } from "@/lib/api";
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
export type BankTransfer = { name: string; code: string; account: string; amount: number };

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
    sheet.addRow(["A", r.amount, accountCell(r.account), o.remarks, o.remarks]).getCell(2).numFmt = "0.00";
  }
  [10, 14, 14, 18, 18].forEach((width, i) => (sheet.getColumn(i + 1).width = width));
}

/** ABA: a header row, then one row per person. The account stays text so leading zeros survive. */
function abaSheet(sheet: Worksheet, o: BankFileOptions) {
  sheet.addRow(["Employee Name", "Employee Id", "Account Number", "Amount", "Remarks"]).font = { bold: true };
  for (const r of o.transfers) {
    sheet.addRow([r.name, r.code, r.account, r.amount, o.remarks]).getCell(4).numFmt = "0.00";
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
