import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS, SALARY_CURRENCIES } from "@/components/dashboard/employee-form";
import { api, type Branch, type CompanyUser, type Department, type Employee, type EmployeeInput, type Role, type Team } from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { downloadSheet, today } from "@/lib/excel";
import { Lookup, optionLabel, RowError, yesNo, type ImportSpec } from "@/lib/excel-import";

/*
 * Excel import/export for people and access: employees, users and roles.
 */

// ───────────────────────────── Employees ────────────────────────────

/** Who is exporting or importing: pay columns only exist for people allowed to see pay. */
type SalaryOptions = { salary: boolean };

export async function exportEmployees({ salary }: SalaryOptions): Promise<string> {
  const filename = `employees-${today()}.xlsx`;
  await downloadSheet(filename, {
    name: "Employees",
    rows: await api.employees.all(),
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
      { header: "Status", value: (e) => optionLabel(EMPLOYMENT_STATUSES, e.employment_status) },
      { header: "Employment type", value: (e) => optionLabel(EMPLOYMENT_TYPES, e.employment_type) },
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
      ...(salary
        ? [
            { header: "Base salary", value: (e: Employee) => e.base_salary, type: "number" as const, format: "#,##0.00" },
            { header: "Currency", value: (e: Employee) => e.salary_currency },
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
  branches: Lookup<Branch>;
  departments: Lookup<Department>;
  teams: Lookup<Team>;
};

/** The employee import, with the pay columns only for someone allowed to change pay. */
export function employeeImport({ salary }: SalaryOptions): ImportSpec<EmployeeCtx> {
  return {
    noun: { one: "employee", many: "employees" },
    templateFile: "employees",
    matching: "A row whose Employee ID (or, without one, Email) matches an existing employee updates that employee.",
    notes: [
      "Imported employees don't get a login. Give them one afterwards from their profile.",
      "If you name a Team but no Department, the team's own department is used.",
      "Fill in Name, or First name and Last name — the full name is then made from them.",
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
      { key: "employment_status", header: "Status", options: EMPLOYMENT_STATUSES, hint: "New employees are Active unless you say otherwise.", example: "Active" },
      { key: "employment_type", header: "Employment type", options: EMPLOYMENT_TYPES, hint: "Optional.", example: "Full-time" },
      { key: "hire_date", header: "Hire date", type: "date", hint: "YYYY-MM-DD, optional.", example: "2026-01-15" },
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
            { key: "base_salary", header: "Base salary", type: "number" as const, hint: "Monthly base pay, optional.", example: "650" },
            {
              key: "salary_currency",
              header: "Currency",
              options: SALARY_CURRENCIES.map((c) => ({ value: c.value, label: c.value })),
              hint: "USD or KHR. Needed with a salary.",
              example: "USD",
            },
          ]
        : []),
      { key: "notes", header: "Notes", hint: "Anything else, optional." },
    ],
    load: async () => {
      const [employees, branches, departments, teams] = await Promise.all([
        api.employees.all(),
        api.branches.all(),
        api.departments.all(),
        api.teams.all(),
      ]);
      return {
        employees: new Lookup(employees, [(e) => e.employee_code, (e) => e.email], "employee"),
        branches: new Lookup(branches, [(b) => b.name, (b) => b.code], "branch"),
        departments: new Lookup(departments, [(d) => d.name, (d) => d.code], "department"),
        teams: new Lookup(teams, [(t) => t.name, (t) => t.code], "team"),
      };
    },
    choices: (ctx) => ({ branch: ctx.branches.names(), department: ctx.departments.names(), team: ctx.teams.names() }),
    save: async (row, ctx) => {
      const payload: EmployeeInput = row.pick(
        "name", "first_name", "last_name", "name_km", "employee_code", "email", "phone", "job_title",
        "employment_status", "employment_type", "hire_date", "gender", "date_of_birth", "address", "notes",
        "nationality", "national_id_number", "passport_number", "nssf_number", "tax_id", "bank_name", "bank_account_number",
        ...(salary ? ["base_salary", "salary_currency"] : []),
      ) as EmployeeInput;

      const branch = row.text("branch");
      const department = row.text("department");
      const team = row.text("team");
      if (branch) payload.branch_id = ctx.branches.require(branch).id;
      if (department) payload.department_id = ctx.departments.require(department).id;
      if (team) {
        const found = ctx.teams.require(team);
        payload.team_id = found.id;
        if (!department && found.department_id) payload.department_id = found.department_id;
      }

      const existing = ctx.employees.find(row.text("employee_code")) ?? ctx.employees.find(row.text("email"));

      if (payload.base_salary != null && !payload.salary_currency) {
        // An update can reuse the currency they're already paid in.
        if (existing?.salary_currency) payload.salary_currency = existing.salary_currency;
        else throw new RowError("A Base salary needs a Currency (USD or KHR).");
      }

      if (existing) {
        ctx.employees.put(await api.employees.update(existing.id, payload));
        return "updated";
      }

      const name = row.text("name") ?? [row.text("first_name"), row.text("last_name")].filter(Boolean).join(" ");
      if (!name) throw new RowError("Fill in Name, or First name and Last name.");
      if (!payload.branch_id) throw new RowError("A new employee needs a Branch.");
      ctx.employees.add(await api.employees.create({ ...payload, name, branch_id: payload.branch_id }));
      return "created";
    },
  };
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
