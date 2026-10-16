import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS, SALARY_CURRENCIES } from "@/components/dashboard/employee-form";
import {
  api,
  type Branch,
  type CompanyUser,
  type Department,
  type Employee,
  type EmployeeInput,
  type EmployeePayProfile,
  type EveryonesPay,
  type PayCurrency,
  type PayGroupOption,
  type PayItemComponent,
  type Role,
  type ScheduleAssignment,
  type Team,
  type WorkSchedule,
} from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { downloadSheet, today } from "@/lib/excel";
import { errorText, isFatal, Lookup, optionLabel, Row, RowError, yesNo, type ImportSpec, type SaveResult } from "@/lib/excel-import";
import { daysOffProblem, parseDaysOff } from "@/lib/excel-specs/time";
import { daysOffText } from "@/lib/schedule";

/*
 * Excel import/export for people and access: employees (with their pay and
 * schedule), users and roles.
 */

// ───────────────────────────── Employees ────────────────────────────
//
// One row per person with what their Profile, Pay and Schedule tabs show
// today, so an export can be edited and imported straight back. History —
// past salaries, earlier schedules — stays on the employee page.

/**
 * What the person exporting or importing may see or change. salary: base
 * salary and currency. pay: the rest of the Pay tab (payroll module).
 * schedule: their work schedule. items: the allowances and deductions set per
 * person, one column each — an import has to know its columns before it
 * reads the file.
 */
export type EmployeeSheetOptions = { salary: boolean; pay: boolean; schedule: boolean; items?: PayItemComponent[] };

type EmployeePayToday = EveryonesPay["employees"][number];

const PAY_TYPES = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
];

const PAYMENT_METHODS = [
  { value: "bank", label: "Bank transfer", aliases: ["Bank"] },
  { value: "cash", label: "Cash" },
];

const itemKey = (component: PayItemComponent) => `item_${component.id}`;

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The first day a pay change can take effect: today, or the day after the last paid one. */
function firstOpenDay(paidThrough: string | null): string {
  const now = today();
  return paidThrough && paidThrough >= now ? shiftDay(paidThrough, 1) : now;
}

/** The schedule each person follows today — the later one when a temporary schedule covers their usual one. */
function schedulesToday(assignments: ScheduleAssignment[]): Map<number, ScheduleAssignment> {
  const now = today();
  const map = new Map<number, ScheduleAssignment>();
  for (const a of assignments) {
    if (a.effective_from > now || (a.effective_to && a.effective_to < now)) continue;
    const seen = map.get(a.employee_id);
    if (!seen || a.effective_from > seen.effective_from) map.set(a.employee_id, a);
  }
  return map;
}

/** All of a person's amounts for one allowance or deduction today (normally one). */
function itemsToday(pay: EmployeePayToday | undefined, component: PayItemComponent) {
  const items = pay?.items.filter((i) => i.pay_component_id === component.id) ?? [];
  return { items, total: items.reduce((sum, i) => sum + Number(i.amount), 0) };
}

export async function exportEmployees({ salary, pay, schedule }: EmployeeSheetOptions): Promise<string> {
  const filename = `employees-${today()}.xlsx`;
  const [employees, payroll, assignments] = await Promise.all([
    api.employees.all(),
    pay ? api.employeePay.everyone() : null,
    schedule ? api.scheduleAssignments.list() : null,
  ]);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const payOf = new Map(payroll?.employees.map((p) => [p.employee_id, p]) ?? []);
  const scheduleOf = schedulesToday(assignments ?? []);
  const p = (e: Employee) => payOf.get(e.id);

  await downloadSheet(filename, {
    name: "Employees",
    rows: employees,
    columns: [
      { header: "Employee ID", value: (e) => e.employee_code },
      { header: "Name", value: (e) => e.name },
      { header: "First name", value: (e) => e.first_name },
      { header: "Last name", value: (e) => e.last_name },
      { header: "Name (Khmer)", value: (e) => e.name_km },
      { header: "Email", value: (e) => e.email },
      { header: "Phone", value: (e) => e.phone },
      { header: "Job title", value: (e) => e.job_title },
      { header: "Branch", value: (e) => e.branch?.name },
      { header: "Department", value: (e) => e.department?.name },
      { header: "Team", value: (e) => e.team?.name },
      {
        header: "Manager",
        value: (e) => {
          const manager = e.manager_employee_id ? byId.get(e.manager_employee_id) : undefined;
          return manager ? (manager.employee_code ?? manager.name) : null;
        },
      },
      { header: "Status", value: (e) => optionLabel(EMPLOYMENT_STATUSES, e.employment_status) },
      { header: "Employment type", value: (e) => optionLabel(EMPLOYMENT_TYPES, e.employment_type) },
      { header: "Display order", value: (e) => e.sort_order, type: "number" },
      { header: "Hire date", value: (e) => (e.hire_date ? dateOnly(e.hire_date) : null), type: "date" },
      { header: "Termination date", value: (e) => (e.termination_date ? dateOnly(e.termination_date) : null), type: "date" },
      // Personal details only arrive for people who manage employees — blank for everyone else.
      { header: "Gender", value: (e) => optionLabel(GENDERS, e.gender) },
      { header: "Date of birth", value: (e) => (e.date_of_birth ? dateOnly(e.date_of_birth) : null), type: "date" },
      { header: "Nationality", value: (e) => e.nationality },
      { header: "National ID", value: (e) => e.national_id_number },
      { header: "Passport number", value: (e) => e.passport_number },
      { header: "Address", value: (e) => e.address },
      { header: "NSSF number", value: (e) => e.nssf_number },
      { header: "Tax ID", value: (e) => e.tax_id },
      { header: "Bank", value: (e) => e.bank_name },
      { header: "Bank account number", value: (e) => e.bank_account_number },
      ...(salary && !pay
        ? [
            { header: "Base salary", value: (e: Employee) => e.base_salary, type: "number" as const, format: "#,##0.00" },
            { header: "Currency", value: (e: Employee) => e.salary_currency },
          ]
        : []),
      ...(pay
        ? [
            { header: "Base salary", value: (e: Employee) => p(e)?.salary?.amount, type: "number" as const, format: "#,##0.00" },
            { header: "Currency", value: (e: Employee) => p(e)?.salary?.currency },
            { header: "Pay type", value: (e: Employee) => optionLabel(PAY_TYPES, p(e)?.salary?.pay_type) },
            { header: "Salary from", value: (e: Employee) => p(e)?.salary?.effective_from, type: "date" as const },
            { header: "Pay group", value: (e: Employee) => p(e)?.pay_group.name },
            { header: "Tax resident", value: (e: Employee) => yesNo(p(e)?.profile.tax_resident) },
            { header: "Spouse dependent", value: (e: Employee) => yesNo(p(e)?.profile.spouse_dependent) },
            { header: "Dependent children", value: (e: Employee) => p(e)?.profile.child_dependents, type: "number" as const },
            { header: "NSSF enrolled", value: (e: Employee) => yesNo(p(e)?.profile.nssf_enrolled) },
            { header: "Paid by", value: (e: Employee) => optionLabel(PAYMENT_METHODS, p(e)?.profile.payment_method) },
            { header: "Bank account name", value: (e: Employee) => p(e)?.profile.bank_account_name },
            ...(payroll?.item_components ?? []).map((c) => ({
              header: c.name,
              value: (e: Employee) => itemsToday(p(e), c).total || null,
              type: "number" as const,
              format: "#,##0.00",
            })),
          ]
        : []),
      ...(schedule
        ? [
            { header: "Work schedule", value: (e: Employee) => scheduleOf.get(e.id)?.work_schedule?.name },
            { header: "Schedule from", value: (e: Employee) => scheduleOf.get(e.id)?.effective_from, type: "date" as const },
            {
              header: "Days off",
              value: (e: Employee) => {
                const a = scheduleOf.get(e.id);
                return a ? daysOffText(a.days_off) : null;
              },
            },
          ]
        : []),
      { header: "Notes", value: (e) => e.notes },
      { header: "Has login", value: (e) => yesNo(e.has_login) },
    ],
  });
  return filename;
}

type EmployeeCtx = {
  employees: Lookup<Employee>;
  byName: Lookup<Employee>;
  branches: Lookup<Branch>;
  departments: Lookup<Department>;
  teams: Lookup<Team>;
  // Pay and schedule as they stand today, by employee id: a cell that still matches is left alone.
  pay: Map<number, EmployeePayToday>;
  groups: Lookup<PayGroupOption>;
  schedules: Lookup<WorkSchedule>;
  scheduleToday: Map<number, ScheduleAssignment>;
  // "employeeId|from" → assignment, so a change on a date that already has one updates it.
  assignments: Map<string, ScheduleAssignment>;
};

/** The employee import: each column only for someone allowed to change it. */
export function employeeImport({ salary, pay, schedule, items = [] }: EmployeeSheetOptions): ImportSpec<EmployeeCtx> {
  return {
    noun: { one: "employee", many: "employees" },
    templateFile: "employees",
    matching: "A row whose Employee ID (or, without one, Email) matches an existing employee updates that employee.",
    notes: [
      "Imported employees don't get a login. Give them one afterwards from their profile.",
      "If you name a Team but no Department, the team's own department is used.",
      "Fill in Name, or First name and Last name — the full name is then made from them.",
      ...(pay || schedule
        ? [
            "Pay and schedule columns hold what applies today. A change applies from today (pay: from the day after the last paid period) — or put a new date in Salary from / Schedule from.",
            "Earlier salaries and schedules are kept; see them on the employee's page.",
          ]
        : []),
      ...(pay && items.length > 0 ? ["Each allowance or deduction column holds that person's amount. 0 stops it."] : []),
    ],
    fields: [
      { key: "employee_code", header: "Employee ID", hint: "Your own ID for this person, unique in the company. Optional.", example: "E-0001" },
      { key: "name", header: "Name", hint: "Full name. Can be left blank when First name is filled in.", example: "Sok Dara" },
      { key: "first_name", header: "First name", hint: "Optional.", example: "Dara" },
      { key: "last_name", header: "Last name", hint: "Optional.", example: "Sok" },
      { key: "name_km", header: "Name (Khmer)", hint: "Name in Khmer script, optional.", example: "សុខ ដារ៉ា", aliases: ["Name in Khmer", "Khmer name"] },
      { key: "email", header: "Email", type: "email", hint: "Optional contact email.", example: "dara@example.com" },
      { key: "phone", header: "Phone", hint: "Optional.", example: "012 345 678" },
      { key: "job_title", header: "Job title", hint: "Optional.", example: "Accountant" },
      { key: "branch", header: "Branch", hint: "Branch name or code. Required for a new employee.", example: "Phnom Penh HQ" },
      { key: "department", header: "Department", hint: "Department name, optional.", example: "Finance" },
      { key: "team", header: "Team", hint: "Team name, optional. Must belong to the department.", example: "Payroll" },
      { key: "manager", header: "Manager", hint: "Their line manager's Employee ID, or full name. Optional.", example: "E-0002", aliases: ["Line manager"] },
      { key: "employment_status", header: "Status", options: EMPLOYMENT_STATUSES, hint: "New employees are Active unless you say otherwise.", example: "Active" },
      { key: "employment_type", header: "Employment type", options: EMPLOYMENT_TYPES, hint: "Optional.", example: "Full-time" },
      { key: "sort_order", header: "Display order", type: "number", hint: "Optional. Lowest is listed first, e.g. 1 for the director, 2 for managers.", example: "1" },
      { key: "hire_date", header: "Hire date", type: "date", hint: "YYYY-MM-DD, optional.", example: "2026-01-15" },
      { key: "termination_date", header: "Termination date", type: "date", hint: "YYYY-MM-DD, only for someone who has left.", example: "" },
      { key: "gender", header: "Gender", options: GENDERS, hint: "Optional.", example: "Female" },
      { key: "date_of_birth", header: "Date of birth", type: "date", hint: "YYYY-MM-DD, optional.", example: "1995-04-20" },
      { key: "nationality", header: "Nationality", hint: "Optional.", example: "Cambodian" },
      { key: "national_id_number", header: "National ID", hint: "National ID card number, optional.", example: "010203040", aliases: ["National ID card number"] },
      { key: "passport_number", header: "Passport number", hint: "Optional.", example: "N1234567" },
      { key: "address", header: "Address", hint: "Home address, optional." },
      { key: "nssf_number", header: "NSSF number", hint: "National Social Security Fund number, optional." },
      { key: "tax_id", header: "Tax ID", hint: "Optional." },
      { key: "bank_name", header: "Bank", hint: "Bank name, optional.", example: "ABA Bank", aliases: ["Bank name"] },
      {
        key: "bank_account_number",
        header: "Bank account number",
        hint: "Optional. Format the column as Text so leading zeros are kept.",
        example: "000 123 456",
      },
      ...(salary
        ? [
            { key: "base_salary", header: "Base salary", type: "number" as const, hint: "Pay per month (or per day for daily pay), optional.", example: "650" },
            {
              key: "salary_currency",
              header: "Currency",
              options: SALARY_CURRENCIES.map((c) => ({ value: c.value, label: c.value })),
              hint: "USD or KHR. Needed with a salary.",
              example: "USD",
            },
          ]
        : []),
      ...(pay
        ? [
            { key: "pay_type", header: "Pay type", options: PAY_TYPES, hint: "Monthly, or Daily for people paid per day worked.", example: "Monthly" },
            { key: "salary_from", header: "Salary from", type: "date" as const, hint: "When a changed salary starts. Left as it is: from today.", example: "2026-11-01" },
            { key: "pay_group", header: "Pay group", hint: "One of your pay groups, by name. A change applies from today.", example: "Monthly" },
            { key: "tax_resident", header: "Tax resident", type: "boolean" as const, hint: "Yes for a tax resident of Cambodia.", example: "Yes" },
            { key: "spouse_dependent", header: "Spouse dependent", type: "boolean" as const, hint: "Yes when their spouse doesn't work.", example: "No" },
            { key: "child_dependents", header: "Dependent children", type: "integer" as const, hint: "How many, 0 to 20.", example: "1" },
            { key: "nssf_enrolled", header: "NSSF enrolled", type: "boolean" as const, hint: "Yes when enrolled in NSSF.", example: "Yes" },
            { key: "payment_method", header: "Paid by", options: PAYMENT_METHODS, hint: "Bank transfer or Cash.", example: "Bank transfer" },
            { key: "bank_account_name", header: "Bank account name", hint: "The name on their bank account, optional." },
            ...items.map((c) => ({
              key: itemKey(c),
              header: c.name,
              type: "number" as const,
              hint: `${c.kind === "earning" ? "Allowance" : "Deduction"} amount for this person. 0 stops it.`,
              aliases: [c.code],
              validate: (text: string) => (Number(text.replace(/,/g, "")) < 0 ? `${c.name} can't be negative.` : null),
            })),
          ]
        : []),
      ...(schedule
        ? [
            { key: "work_schedule", header: "Work schedule", hint: "One of your work schedules, by name.", example: "Office hours" },
            { key: "schedule_from", header: "Schedule from", type: "date" as const, hint: "When a changed schedule starts. Left as it is: from today.", example: "2026-11-01" },
            { key: "days_off", header: "Days off", hint: 'Weekly days off, e.g. "Sun" or "Sat, Sun".', example: "Sun", validate: (t: string) => daysOffProblem(t, "Days off") },
          ]
        : []),
      { key: "notes", header: "Notes", hint: "Anything else, optional." },
    ],
    load: async () => {
      const [employees, branches, departments, teams, payroll, groups, schedules, assignments] = await Promise.all([
        api.employees.all(),
        api.branches.all(),
        api.departments.all(),
        api.teams.all(),
        pay ? api.employeePay.everyone() : null,
        pay ? api.payroll.groupOptions() : [],
        schedule ? api.workSchedules.list() : [],
        schedule ? api.scheduleAssignments.list() : [],
      ]);
      return {
        employees: new Lookup(employees, [(e) => e.employee_code, (e) => e.email], "employee"),
        byName: new Lookup(employees, [(e) => e.name], "employee"),
        branches: new Lookup(branches, [(b) => b.name, (b) => b.code], "branch"),
        departments: new Lookup(departments, [(d) => d.name, (d) => d.code], "department"),
        teams: new Lookup(teams, [(t) => t.name, (t) => t.code], "team"),
        pay: new Map(payroll?.employees.map((p) => [p.employee_id, p]) ?? []),
        groups: new Lookup(groups, [(g) => g.name], "pay group"),
        // Inactive schedules can't be newly assigned, so they aren't offered.
        schedules: new Lookup(schedules.filter((s) => s.is_active), [(s) => s.name], "active work schedule"),
        scheduleToday: schedulesToday(assignments),
        assignments: new Map(assignments.map((a) => [`${a.employee_id}|${a.effective_from}`, a])),
      };
    },
    choices: (ctx) => ({
      branch: ctx.branches.names(),
      department: ctx.departments.names(),
      team: ctx.teams.names(),
      pay_group: ctx.groups.names(),
      work_schedule: ctx.schedules.names(),
    }),
    save: async (row, ctx) => {
      const payload: EmployeeInput = row.pick(
        "name", "first_name", "last_name", "name_km", "employee_code", "email", "phone", "job_title",
        "employment_status", "employment_type", "sort_order", "hire_date", "termination_date", "gender", "date_of_birth", "address", "notes",
        "nationality", "national_id_number", "passport_number", "nssf_number", "tax_id", "bank_name", "bank_account_number",
        // With payroll the salary goes into the salary history instead (below).
        ...(salary && !pay ? ["base_salary", "salary_currency"] : []),
      ) as EmployeeInput;

      const branch = row.text("branch");
      const department = row.text("department");
      const team = row.text("team");
      const manager = row.text("manager");
      if (branch) payload.branch_id = ctx.branches.require(branch).id;
      if (department) payload.department_id = ctx.departments.require(department).id;
      if (team) {
        const found = ctx.teams.require(team);
        payload.team_id = found.id;
        if (!department && found.department_id) payload.department_id = found.department_id;
      }
      if (manager) payload.manager_employee_id = (ctx.employees.find(manager) ?? ctx.byName.require(manager)).id;

      const existing = ctx.employees.find(row.text("employee_code")) ?? ctx.employees.find(row.text("email"));

      // Every name is checked before anything is saved, so a typo never leaves half a person behind.
      const group = pay && row.text("pay_group") ? ctx.groups.require(row.text("pay_group")!) : undefined;
      const workSchedule = schedule && row.text("work_schedule") ? ctx.schedules.require(row.text("work_schedule")!) : undefined;
      const daysOff = schedule && row.has("days_off") ? parseDaysOff(row.text("days_off")!, "Days off") : undefined;
      if (daysOff && !workSchedule && !(existing && ctx.scheduleToday.has(existing.id))) {
        throw new RowError("Days off needs a Work schedule.");
      }

      if (row.number("base_salary") != null && !row.has("salary_currency")) {
        // An update can reuse the currency they're already paid in.
        const currency = existing ? (pay ? ctx.pay.get(existing.id)?.salary?.currency : existing.salary_currency) : undefined;
        if (!currency) throw new RowError("A Base salary needs a Currency (USD or KHR).");
        if (!pay) payload.salary_currency = currency;
      }
      if (pay && !row.has("base_salary") && !(existing && ctx.pay.get(existing.id)?.salary) && (row.has("salary_currency") || row.has("pay_type"))) {
        throw new RowError("Fill in the Base salary too.");
      }

      let employee: Employee;
      let result: SaveResult;
      if (existing) {
        employee = await api.employees.update(existing.id, payload);
        ctx.employees.put(employee);
        ctx.byName.put(employee);
        result = "updated";
      } else {
        const name = row.text("name") ?? [row.text("first_name"), row.text("last_name")].filter(Boolean).join(" ");
        if (!name) throw new RowError("Fill in Name, or First name and Last name.");
        if (!payload.branch_id) throw new RowError("A new employee needs a Branch.");
        // A new person starts in their pay group from their first day.
        if (group) payload.pay_group_id = group.id;
        employee = await api.employees.create({ ...payload, name, branch_id: payload.branch_id });
        ctx.employees.add(employee);
        ctx.byName.add(employee);
        result = "created";
      }

      try {
        if (pay) await savePay(row, employee, ctx.pay.get(employee.id), existing ? group : undefined, items);
        if (schedule) await saveSchedule(row, employee, ctx, workSchedule, daysOff);
      } catch (err) {
        if (isFatal(err) || err instanceof RowError) throw err;
        throw new RowError(`${employee.name} was saved, but not all of their pay and schedule: ${errorText(err)}`);
      }
      return result;
    },
  };
}

/** The Pay tab's columns: only what differs from today goes through, each with the Pay tab's own call. */
async function savePay(row: Row, employee: Employee, now: EmployeePayToday | undefined, group: PayGroupOption | undefined, items: PayItemComponent[]) {
  const open = firstOpenDay(now?.paid_through ?? null);
  const hired = employee.hire_date ? dateOnly(employee.hire_date) : null;

  const was = now?.salary;
  const amount = row.number("base_salary") ?? (was ? Number(was.amount) : undefined);
  if (amount !== undefined && (row.has("base_salary") || row.has("salary_currency") || row.has("pay_type"))) {
    const currency = (row.text("salary_currency") ?? was?.currency) as PayCurrency;
    const payType = (row.text("pay_type") ?? was?.pay_type ?? "monthly") as "monthly" | "daily";
    if (!was || Number(was.amount) !== amount || was.currency !== currency || was.pay_type !== payType) {
      const date = row.text("salary_from");
      // The same start date as today's salary means the date wasn't touched — a change then starts now.
      // A first salary starts when they were hired.
      const from = date && date !== was?.effective_from ? date : was ? open : (date ?? hired ?? open);
      await api.employeePay.addSalary(employee.id, {
        amount, currency, pay_type: payType, effective_from: from, reason: was ? "change" : "hired", note: "Imported from Excel",
      });
    }
  }

  if (group && now && now.pay_group.id !== group.id) {
    await api.employeePay.setPayGroup(employee.id, { pay_group_id: group.id, effective_from: open });
  }

  const wanted = row.pick("tax_resident", "spouse_dependent", "child_dependents", "nssf_enrolled", "payment_method", "bank_account_name");
  const changes = Object.fromEntries(
    Object.entries(wanted).filter(([key, value]) => !now || now.profile[key as keyof EmployeePayProfile] !== value),
  ) as Partial<EmployeePayProfile>;
  if (Object.keys(changes).length > 0) await api.employeePay.updateProfile(employee.id, changes);

  for (const component of items) {
    const target = row.number(itemKey(component));
    if (target === undefined) continue;
    const current = itemsToday(now, component);
    if (Math.abs(current.total - target) < 0.005) continue;

    // The old amount stops the day before the new one starts; days already paid keep it.
    const start = now ? open : (hired ?? open);
    for (const item of current.items) {
      if (item.effective_from >= start) await api.employeePay.removeItem(employee.id, item.id);
      else await api.employeePay.updateItem(employee.id, item.id, { effective_to: shiftDay(start, -1) });
    }
    if (target > 0) {
      await api.employeePay.addItem(employee.id, { pay_component_id: component.id, amount: target, effective_from: start, effective_to: null, note: null });
    }
  }
}

/** The Schedule tab's columns, through the same rules as the Assign dialog. */
async function saveSchedule(row: Row, employee: Employee, ctx: EmployeeCtx, workSchedule: WorkSchedule | undefined, daysOff: number[] | undefined) {
  if (!workSchedule && daysOff === undefined) return;

  const now = ctx.scheduleToday.get(employee.id);
  const scheduleId = workSchedule?.id ?? now?.work_schedule?.id;
  if (!scheduleId) return;

  const sameDays = daysOff === undefined || (now !== undefined && [...daysOff].sort().join() === [...now.days_off].sort().join());
  if (now && now.work_schedule?.id === scheduleId && sameDays) return;

  const date = row.text("schedule_from");
  const from = date && date !== now?.effective_from ? date : today();
  const days = daysOff ?? (workSchedule ? null : (now?.days_off ?? null));
  const key = `${employee.id}|${from}`;
  const onThatDay = ctx.assignments.get(key);

  const saved = onThatDay
    ? await api.scheduleAssignments.update(onThatDay.id, { work_schedule_id: scheduleId, ...(days ? { days_off: days } : {}) })
    : await api.scheduleAssignments.create({ employee_id: employee.id, work_schedule_id: scheduleId, effective_from: from, effective_to: null, days_off: days, notes: null });
  ctx.assignments.set(key, saved);
  ctx.scheduleToday.set(employee.id, saved);
}

// ─────────────────────────────── Users ──────────────────────────────

export async function exportUsers(): Promise<string> {
  const filename = `users-${today()}.xlsx`;
  const [users, branches] = await Promise.all([api.users.list(), api.branches.all()]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  await downloadSheet(filename, {
    name: "Users",
    rows: users,
    columns: [
      { header: "Name", value: (u) => u.name },
      { header: "Email", value: (u) => u.email },
      { header: "Sign-in ID", value: (u) => u.login_id },
      { header: "Role", value: (u) => u.role },
      { header: "Status", value: (u) => (u.is_active ? "Active" : "Inactive") },
      {
        header: "Branch access",
        value: (u) => (u.branch_ids === null ? "All branches" : u.branch_ids.map((id) => branchName.get(id) ?? `#${id}`).join(", ")),
      },
    ],
  });
  return filename;
}

export const userImport: ImportSpec<{ users: Lookup<CompanyUser>; roles: Lookup<Role> }> = {
  noun: { one: "user", many: "users" },
  templateFile: "users",
  matching: "A row whose Email matches an existing user changes that user's Role.",
  notes: [
    "The password is only used for new accounts. Ask each person to change it after signing in, and delete this file once imported.",
    "Employees who sign in with their employee ID are managed from the Employees page instead.",
  ],
  fields: [
    { key: "name", header: "Name", required: true, hint: "Full name.", example: "Chan Vy" },
    { key: "email", header: "Email", type: "email", required: true, hint: "They sign in with this email.", example: "vy@example.com" },
    { key: "role", header: "Role", required: true, hint: "One of your company's roles.", example: "manager" },
    { key: "password", header: "Password", hint: "At least 8 characters. Required for a new user.", example: "Welcome2026!" },
  ],
  load: async () => {
    const [users, roles] = await Promise.all([api.users.list(), api.roles.list()]);
    return {
      users: new Lookup(users, [(u) => u.email], "user"),
      roles: new Lookup(roles, [(r) => r.name], "role"),
    };
  },
  choices: (ctx) => ({ role: ctx.roles.names() }),
  save: async (row, ctx) => {
    const role = ctx.roles.require(row.text("role")!).name;
    const existing = ctx.users.find(row.text("email"));

    if (existing) {
      if (existing.role === role) return "skipped";
      ctx.users.put(await api.users.updateRole(existing.id, role));
      return "updated";
    }

    const password = row.text("password");
    if (!password) throw new RowError("A new user needs a Password.");
    if (password.length < 8) throw new RowError("The password must be at least 8 characters.");

    ctx.users.add(await api.users.invite({ name: row.text("name")!, email: row.text("email")!, password, role }));
    return "created";
  },
};

// ─────────────────────────────── Roles ──────────────────────────────

export async function exportRoles(): Promise<string> {
  const filename = `roles-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Roles",
    rows: await api.roles.list(),
    columns: [
      { header: "Role", value: (r) => r.name },
      { header: "Display order", value: (r) => r.sort_order, type: "number" },
      { header: "Permissions", value: (r) => r.permissions.join(", "), width: 80 },
      { header: "Permission count", value: (r) => r.permissions.length, type: "number" },
      { header: "Built-in", value: (r) => yesNo(r.protected) },
    ],
  });
  return filename;
}

export const roleImport: ImportSpec<{ roles: Lookup<Role>; permissions: Set<string> }> = {
  noun: { one: "role", many: "roles" },
  templateFile: "roles",
  matching: "A row whose Role matches an existing role replaces that role's permissions.",
  notes: (ctx) => [
    "List permissions separated by commas. Available permissions: " + [...ctx.permissions].sort().join(", ") + ".",
  ],
  fields: [
    { key: "name", header: "Role", required: true, hint: "The role's name.", example: "supervisor" },
    {
      key: "permissions",
      header: "Permissions",
      hint: "Permission codes separated by commas (see the list above).",
      example: "employees.view, attendance.view",
    },
  ],
  load: async () => {
    const [roles, groups] = await Promise.all([api.roles.list(), api.roles.permissions()]);
    return {
      roles: new Lookup(roles, [(r) => r.name], "role"),
      permissions: new Set(groups.flatMap((g) => g.permissions)),
    };
  },
  save: async (row, ctx) => {
    const permissions = row.has("permissions")
      ? [...new Set(row.text("permissions")!.split(/[,;\n]+/).map((p) => p.trim().toLowerCase()).filter(Boolean))]
      : undefined;

    const unknown = permissions?.filter((p) => !ctx.permissions.has(p)) ?? [];
    if (unknown.length > 0) throw new RowError(`Unknown permission${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);

    const existing = ctx.roles.find(row.text("name"));
    if (existing) {
      if (permissions === undefined) return "skipped";
      if (existing.protected) throw new RowError(`"${existing.name}" is a built-in role, so its permissions can't be changed.`);
      const same = permissions.length === existing.permissions.length && permissions.every((p) => existing.permissions.includes(p));
      if (same) return "skipped";
      ctx.roles.put(await api.roles.update(existing.id, { permissions }));
      return "updated";
    }

    ctx.roles.add(await api.roles.create({ name: row.text("name")!, permissions: permissions ?? [] }));
    return "created";
  },
};
