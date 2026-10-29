import { api, type Employee, type PayKind } from "@/lib/api";
import { Lookup, RowError, type ImportSpec, type Row } from "@/lib/excel/import";
import { translateNow } from "@/lib/i18n";

/*
 * Excel import for payroll adjustments: one-off amounts (commission, bonus,
 * penalty) worked out in a spreadsheet. Each lands in the pay run whose
 * period holds its date.
 */

const KIND_OPTIONS: { value: PayKind; label: string; aliases: string[] }[] = [
  { value: "earning", label: "Earning", aliases: ["Bonus", "Allowance", "Add"] },
  { value: "deduction", label: "Deduction", aliases: ["Penalty", "Before tax"] },
  { value: "net_deduction", label: "After-tax deduction", aliases: ["Advance", "Loan", "After tax"] },
];

type Ctx = { byCode: Lookup<Employee>; byName: Lookup<Employee> };

function findEmployee(row: Row, ctx: Ctx): Employee {
  const code = row.text("employee_code");
  const name = row.text("employee");
  if (code) return ctx.byCode.require(code);
  if (name) return ctx.byName.require(name);
  throw new RowError(translateNow("app.excelSpecs.row.needEmployee"));
}

/** Rows without a date of their own go in on `date` (from the month open on the Adjustments page). */
export function adjustmentImport(date: string): ImportSpec<Ctx> {
  return {
    noun: { one: "adjustment", many: "adjustments" },
    templateFile: `payroll-adjustments-${date.slice(0, 7)}`,
    matching: "app.excelSpecs.matching.adjustments",
    matchingVars: { date },
    notes: [
      "Amounts are in each employee's salary currency.",
      "Earnings are added to pay; deductions are taken off before tax; after-tax deductions (advances, loans) after it.",
      "Each adjustment goes into the pay run whose period holds its date.",
    ],
    fields: [
      { key: "employee_code", header: "Employee ID", hint: "Employee ID. Fill this in, or Employee (the name), or both.", example: "E-0001" },
      { key: "employee", header: "Employee", hint: "The employee's full name — used when there is no Employee ID.", example: "Sok Dara" },
      { key: "date", header: "Date", type: "date", hint: `Optional. Empty = ${date}.`, example: date },
      { key: "kind", header: "Type", required: true, options: KIND_OPTIONS, hint: "Earning, Deduction or After-tax deduction.", example: "Earning" },
      { key: "name", header: "Name on payslip", required: true, hint: "e.g. Sales commission.", example: "Sales commission" },
      { key: "amount", header: "Amount", type: "number", required: true, hint: "A positive amount.", example: "35" },
      { key: "taxable", header: "Taxable", type: "boolean", hint: "Yes or No. Empty = Yes.", example: "Yes" },
      { key: "reason", header: "Reason", hint: "Optional, shown on the payslip.", example: "September sales" },
    ],
    load: async () => {
      const employees = await api.employees.all();
      return {
        byCode: new Lookup(employees, [(e) => e.employee_code], "employee with the ID"),
        byName: new Lookup(employees, [(e) => e.name], "employee"),
      };
    },
    choices: (ctx) => ({ employee: ctx.byName.names() }),
    save: async (row, ctx) => {
      const amount = row.number("amount") ?? 0;
      if (amount <= 0) throw new RowError(translateNow("app.excelSpecs.row.amountPositive"));

      await api.payroll.createAdjustment({
        employee_id: findEmployee(row, ctx).id,
        date: row.text("date") ?? date,
        kind: row.text("kind") as PayKind,
        name: row.text("name")!,
        amount,
        taxable: row.flag("taxable") ?? true,
        reason: row.text("reason") ?? null,
      });
      return "created";
    },
  };
}
