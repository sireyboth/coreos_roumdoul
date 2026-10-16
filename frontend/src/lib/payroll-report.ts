import type { PayLineKind, PayRunReportRow } from "@/lib/api";

/**
 * The figures of a pay run report, worked out once and shared by the printed
 * report (payroll-pdf.ts) and the report dashboard — so both always agree.
 */

const n = (v: unknown) => Number(v ?? 0);

/** One payslip in register columns. Gross, NSSF, tax and net come from the payslip itself: they are what was paid. */
export type RegisterRow = {
  slip: PayRunReportRow;
  base: number;
  otherEarnings: number;
  deductions: number;
  gross: number;
  nssf: number;
  tax: number;
  afterTax: number;
  net: number;
  employer: number;
  cost: number;
};

export type RegisterTotals = Omit<RegisterRow, "slip">;

export const REGISTER_NUMBERS: (keyof RegisterTotals)[] = ["base", "otherEarnings", "deductions", "gross", "nssf", "tax", "afterTax", "net", "employer", "cost"];

export function registerRow(slip: PayRunReportRow): RegisterRow {
  const sum = (test: (l: PayRunReportRow["lines"][number]) => boolean) => slip.lines.filter(test).reduce((t, l) => t + n(l.amount), 0);
  return {
    slip,
    base: sum((l) => l.kind === "earning" && l.is_base),
    otherEarnings: sum((l) => l.kind === "earning" && !l.is_base),
    deductions: sum((l) => l.kind === "deduction"),
    gross: n(slip.gross),
    nssf: n(slip.nssf_employee),
    tax: n(slip.tax),
    afterTax: sum((l) => l.kind === "net_deduction"),
    net: n(slip.net),
    employer: n(slip.employer_cost) - n(slip.gross),
    cost: n(slip.employer_cost),
  };
}

export function totalsOf(rows: RegisterRow[]): RegisterTotals {
  const t = Object.fromEntries(REGISTER_NUMBERS.map((k) => [k, 0])) as RegisterTotals;
  for (const r of rows) for (const k of REGISTER_NUMBERS) t[k] += r[k];
  return t;
}

/** USD first, then KHR: the two are never added together. */
export function byCurrency(slips: PayRunReportRow[]): [string, RegisterRow[]][] {
  const groups = new Map<string, RegisterRow[]>();
  for (const s of slips) groups.set(s.currency, [...(groups.get(s.currency) ?? []), registerRow(s)]);
  return [...groups].sort(([a], [b]) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));
}

export type ComponentTotal = { key: string; name: string; code: string; people: number; total: number };

/** What each pay component of one kind added up to, largest first. */
export function componentTotals(rows: RegisterRow[], kind: PayLineKind): ComponentTotal[] {
  const lines = new Map<string, ComponentTotal>();
  for (const r of rows) {
    for (const l of r.slip.lines) {
      if (l.kind !== kind || Math.abs(n(l.amount)) < 0.005) continue;
      // Adjustments share one code but are named one by one: keep them apart by name.
      const key = `${l.code}|${l.name}`;
      const entry = lines.get(key) ?? { key, name: l.name, code: l.code, people: 0, total: 0 };
      entry.people += 1;
      entry.total += n(l.amount);
      lines.set(key, entry);
    }
  }
  return [...lines.values()];
}

export type GroupTotal = RegisterTotals & { name: string; people: number };

/** Totals per branch, department, or both ("HQ · Sales"). */
export function groupTotals(rows: RegisterRow[], by: "branch" | "department" | "both"): GroupTotal[] {
  const label = (r: RegisterRow) => {
    const branch = r.slip.employee?.branch || "No branch";
    const department = r.slip.employee?.department || "No department";
    return by === "branch" ? branch : by === "department" ? department : `${branch} · ${department}`;
  };
  const groups = new Map<string, RegisterRow[]>();
  for (const r of rows) groups.set(label(r), [...(groups.get(label(r)) ?? []), r]);
  return [...groups].map(([name, rs]) => ({ name, people: rs.length, ...totalsOf(rs) }));
}
