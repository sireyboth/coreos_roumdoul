"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Branch, Department, Employee, EmployeeInput, SalaryCurrency, Team } from "@/lib/api";
import { translate, useLang, useT, type Lang, type TKey } from "@/lib/i18n";

// Kept in step with Employee::STATUSES on the server. `aliases` are other
// words an Excel import accepts for the same status.
export const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active", aliases: ["Working", "Permanent"] },
  { value: "probation", label: "Probation", aliases: ["Probationary", "Trial"] },
  { value: "on_leave", label: "On leave", aliases: ["Leave", "Maternity leave", "Sick leave", "Unpaid leave"] },
  { value: "suspended", label: "Suspended" },
  { value: "resigned", label: "Resigned", aliases: ["Quit", "Left"] },
  { value: "terminated", label: "Terminated", aliases: ["Fired", "Dismissed"] },
  { value: "contract_ended", label: "Contract ended", aliases: ["End of contract", "Contract expired"] },
  { value: "retired", label: "Retired" },
];

/** No longer works here: can't check in, off the roster. Matches Employee::LEFT_STATUSES. */
export const LEFT_STATUSES = ["resigned", "terminated", "contract_ended", "retired"];

export const hasLeft = (status: string) => LEFT_STATUSES.includes(status);

export function statusVariant(status: string): "success" | "info" | "warning" | "secondary" | "destructive" {
  if (status === "active") return "success";
  if (status === "probation") return "info";
  if (status === "on_leave") return "warning";
  return hasLeft(status) ? "destructive" : "secondary";
}

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
];

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

export const SALARY_CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "KHR", label: "KHR (៛)" },
];

// Suggestions only — any bank can be typed in.
const CAMBODIAN_BANKS = [
  "ABA Bank", "ACLEDA Bank", "Canadia Bank", "Wing Bank", "Prince Bank", "Sathapana Bank",
  "Hattha Bank", "AMK Bank", "Chip Mong Commercial Bank", "Bank of China (Phnom Penh)",
  "Cambodia Post Bank", "Foreign Trade Bank of Cambodia", "J Trust Royal Bank", "Maybank Cambodia",
  "Phillip Bank", "Vattanac Bank", "Woori Bank Cambodia",
];

export const labelFor = (options: { value: string; label: string }[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? value ?? "—";

// The English labels above are what Excel files use; on screen these give the
// name in the chosen language (employees.options in the dictionary).
const OPTION_GROUPS = { status: EMPLOYMENT_STATUSES, type: EMPLOYMENT_TYPES, gender: GENDERS };
type OptionGroup = keyof typeof OPTION_GROUPS;

/** An employee status / type / gender in `lang`, e.g. labelIn(lang, "status", "on_leave"). */
export function labelIn(lang: Lang, group: OptionGroup, value: string | null | undefined): string {
  if (!OPTION_GROUPS[group].some((o) => o.value === value)) return value ?? "—";
  return translate(lang, `employees.options.${group}.${value}` as TKey);
}

/** The same options with their labels in `lang` (for pickers and filters). */
export function optionsIn<T extends { value: string; label: string }>(lang: Lang, group: OptionGroup, options: T[]): T[] {
  return options.map((o) => ({ ...o, label: labelIn(lang, group, o.value) }));
}

/** "650.00" + "USD" → "$650.00"; riel has no decimals and its own symbol. */
export function formatSalary(amount: string | number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = Number(amount);
  if (currency === "KHR") return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} ៛`;
  if (currency === "USD") return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return value.toLocaleString("en-US");
}

/** Who can see and change pay on this form. */
export type SalaryAccess = "none" | "view" | "edit";

const joinName = (first: string, last: string) => [first.trim(), last.trim()].filter(Boolean).join(" ");

// Everything is a string here so inputs stay controlled; toPayload() turns
// empty strings into nulls for the API.
export type EmployeeForm = {
  name: string;
  employee_code: string;
  email: string;
  phone: string;
  branch_id: string;
  department_id: string;
  team_id: string;
  manager_employee_id: string;
  job_title: string;
  employment_type: string;
  employment_status: string;
  hire_date: string;
  termination_date: string;
  sort_order: string;
  gender: string;
  date_of_birth: string;
  address: string;
  notes: string;
  first_name: string;
  last_name: string;
  name_km: string;
  nationality: string;
  national_id_number: string;
  passport_number: string;
  nssf_number: string;
  tax_id: string;
  bank_name: string;
  bank_account_number: string;
  base_salary: string;
  salary_currency: string;
};

export function emptyEmployeeForm(branchId = ""): EmployeeForm {
  return {
    first_name: "",
    last_name: "",
    name_km: "",
    nationality: "",
    national_id_number: "",
    passport_number: "",
    nssf_number: "",
    tax_id: "",
    bank_name: "",
    bank_account_number: "",
    base_salary: "",
    salary_currency: "USD",
    name: "",
    employee_code: "",
    email: "",
    phone: "",
    branch_id: branchId,
    department_id: "",
    team_id: "",
    manager_employee_id: "",
    job_title: "",
    employment_type: "",
    employment_status: "active",
    hire_date: "",
    termination_date: "",
    sort_order: "",
    gender: "",
    date_of_birth: "",
    address: "",
    notes: "",
  };
}

export function formFromEmployee(employee: Employee): EmployeeForm {
  return {
    first_name: employee.first_name ?? "",
    last_name: employee.last_name ?? "",
    name_km: employee.name_km ?? "",
    nationality: employee.nationality ?? "",
    national_id_number: employee.national_id_number ?? "",
    passport_number: employee.passport_number ?? "",
    nssf_number: employee.nssf_number ?? "",
    tax_id: employee.tax_id ?? "",
    bank_name: employee.bank_name ?? "",
    bank_account_number: employee.bank_account_number ?? "",
    base_salary: employee.base_salary ?? "",
    salary_currency: employee.salary_currency ?? "USD",
    name: employee.name,
    employee_code: employee.employee_code ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    // The API sends the branch as a nested object, not a branch_id field.
    branch_id: employee.branch?.id != null ? String(employee.branch.id) : "",
    department_id: employee.department?.id != null ? String(employee.department.id) : "",
    team_id: employee.team?.id != null ? String(employee.team.id) : "",
    manager_employee_id: employee.manager_employee_id != null ? String(employee.manager_employee_id) : "",
    job_title: employee.job_title ?? "",
    employment_type: employee.employment_type ?? "",
    employment_status: employee.employment_status,
    hire_date: employee.hire_date?.slice(0, 10) ?? "",
    termination_date: employee.termination_date?.slice(0, 10) ?? "",
    sort_order: employee.sort_order != null ? String(employee.sort_order) : "",
    gender: employee.gender ?? "",
    date_of_birth: employee.date_of_birth?.slice(0, 10) ?? "",
    address: employee.address ?? "",
    notes: employee.notes ?? "",
  };
}

/**
 * `org` says whether the department/team pickers were available. Only then
 * are they sent — otherwise a person who can't see departments would wipe an
 * employee's department just by editing their phone number. `salary` works
 * the same way: pay is only sent by someone allowed to change it.
 */
export function toPayload(form: EmployeeForm, options: { org: boolean; salary?: boolean; manager?: boolean }): EmployeeInput {
  const orNull = (value: string) => value.trim() || null;
  const salary = form.base_salary.trim() === "" ? null : Number(form.base_salary);

  return {
    name: form.name.trim() || joinName(form.first_name, form.last_name),
    first_name: orNull(form.first_name),
    last_name: orNull(form.last_name),
    name_km: orNull(form.name_km),
    nationality: orNull(form.nationality),
    national_id_number: orNull(form.national_id_number),
    passport_number: orNull(form.passport_number),
    nssf_number: orNull(form.nssf_number),
    tax_id: orNull(form.tax_id),
    // The bank account decides where pay goes, so it is pay too.
    ...(options.salary
      ? {
          bank_name: orNull(form.bank_name),
          bank_account_number: orNull(form.bank_account_number),
          base_salary: salary,
          salary_currency: salary === null ? null : (form.salary_currency as SalaryCurrency),
        }
      : {}),
    employee_code: orNull(form.employee_code),
    email: orNull(form.email),
    phone: orNull(form.phone),
    ...(form.branch_id ? { branch_id: Number(form.branch_id) } : {}),
    ...(options.org
      ? {
          department_id: form.department_id ? Number(form.department_id) : null,
          team_id: form.team_id ? Number(form.team_id) : null,
        }
      : {}),
    // Like department/team: only when the picker was there to choose from.
    ...(options.manager ? { manager_employee_id: form.manager_employee_id ? Number(form.manager_employee_id) : null } : {}),
    job_title: orNull(form.job_title),
    employment_type: orNull(form.employment_type),
    employment_status: form.employment_status,
    hire_date: orNull(form.hire_date),
    sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
    // Only meaningful for someone who has left.
    termination_date: hasLeft(form.employment_status) ? orNull(form.termination_date) : null,
    gender: orNull(form.gender),
    date_of_birth: orNull(form.date_of_birth),
    address: orNull(form.address),
    notes: orNull(form.notes),
  };
}

const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  wide,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmployeeFormFields({
  idPrefix,
  form,
  onChange,
  branches,
  departments = [],
  teams = [],
  managers,
  selfId,
  currentManager,
  emailHint,
  emailDisabled,
  emailRequired,
  codeRequired,
  codeDisabled,
  codeHint,
  salary = "none",
}: {
  idPrefix: string;
  form: EmployeeForm;
  onChange: (patch: Partial<EmployeeForm>) => void;
  branches: Branch[];
  departments?: Department[];
  teams?: Team[];
  // People who can be picked as line manager; leave out to hide the picker.
  managers?: { id: number; name: string }[];
  // The employee being edited, so they can't be their own manager.
  selfId?: number;
  currentManager?: { id: number; name: string } | null;
  emailHint?: string;
  emailDisabled?: boolean;
  emailRequired?: boolean;
  // The employee code is their sign-in when they use an employee ID login.
  codeRequired?: boolean;
  // Locked when this ID is what they sign in with.
  codeDisabled?: boolean;
  codeHint?: string;
  salary?: SalaryAccess;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const t = useT();
  const lang = useLang();

  /**
   * Typing a first or last name keeps the full name in step — until someone
   * edits the full name by hand (e.g. "Dara Sok" written "Sok Dara"), after
   * which it's left alone.
   */
  function changeNamePart(patch: { first_name?: string; last_name?: string }) {
    const before = joinName(form.first_name, form.last_name);
    const after = joinName(patch.first_name ?? form.first_name, patch.last_name ?? form.last_name);
    const following = form.name.trim() === "" || form.name.trim() === before;
    onChange({ ...patch, ...(following ? { name: after } : {}) });
  }

  // Anyone but the person themselves; their current manager stays listed even
  // if they work in a branch the viewer can't otherwise see.
  const managerOptions = [
    ...(managers ?? []).filter((m) => m.id !== selfId),
    ...(currentManager && !(managers ?? []).some((m) => m.id === currentManager.id) ? [currentManager] : []),
  ].map((m) => ({ value: String(m.id), label: m.name }));

  // Inactive ones can't be newly chosen, but stay visible if the employee is already in one.
  const departmentOptions = departments.filter((d) => d.status === "active" || String(d.id) === form.department_id);
  // With a department picked, offer only its teams (plus teams not tied to any department).
  const teamOptions = teams.filter(
    (t) =>
      (t.status === "active" || String(t.id) === form.team_id) &&
      (!form.department_id || t.department_id === null || String(t.department_id) === form.department_id),
  );

  function changeTeam(teamId: string) {
    const team = teams.find((t) => String(t.id) === teamId);
    // A team sits inside one department, so choosing it also fills that in.
    onChange({ team_id: teamId, ...(team?.department_id != null ? { department_id: String(team.department_id) } : {}) });
  }

  function changeDepartment(departmentId: string) {
    const team = teams.find((t) => String(t.id) === form.team_id);
    // A team belongs to one department — drop it if it no longer fits.
    const keepTeam = !team || !departmentId || team.department_id === null || String(team.department_id) === departmentId;
    onChange({ department_id: departmentId, ...(keepTeam ? {} : { team_id: "" }) });
  }

  return (
    <div className="flex flex-col gap-5">
      <Section title={t("employees.form.basic")}>
        <Field label={t("employees.form.firstName")} htmlFor={id("first")}>
          <Input
            id={id("first")}
            autoComplete="given-name"
            value={form.first_name}
            onChange={(e) => changeNamePart({ first_name: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.lastName")} htmlFor={id("last")}>
          <Input
            id={id("last")}
            autoComplete="family-name"
            value={form.last_name}
            onChange={(e) => changeNamePart({ last_name: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.fullName")} htmlFor={id("name")} hint={t("employees.form.fullNameHint")}>
          <Input id={id("name")} required value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label={t("employees.form.nameKm")} htmlFor={id("name-km")}>
          <Input
            id={id("name-km")}
            lang="km"
            placeholder="ឈ្មោះជាភាសាខ្មែរ"
            value={form.name_km}
            onChange={(e) => onChange({ name_km: e.target.value })}
          />
        </Field>
        <Field
          label={codeRequired ? t("employees.form.employeeId") : t("employees.form.employeeCode")}
          htmlFor={id("code")}
          hint={codeHint}
        >
          <Input
            id={id("code")}
            required={codeRequired}
            disabled={codeDisabled}
            placeholder="E-001"
            value={form.employee_code}
            onChange={(e) => onChange({ employee_code: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.phone")} htmlFor={id("phone")}>
          <Input id={id("phone")} type="tel" value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </Field>
        <Field label={t("employees.form.email")} htmlFor={id("email")} hint={emailHint} wide>
          <Input
            id={id("email")}
            type="email"
            required={emailRequired}
            disabled={emailDisabled}
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
      </Section>

      <Section title={t("employees.form.work")}>
        <Field label={t("common.field.branch")} htmlFor={id("branch")}>
          <select
            id={id("branch")}
            required
            value={form.branch_id}
            onChange={(e) => onChange({ branch_id: e.target.value })}
            className={SELECT_CLASS}
          >
            {form.branch_id === "" && (
              <option value="" disabled>
                {t("employees.form.select")}
              </option>
            )}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
        {departments.length > 0 && (
          <Field label={t("employees.form.department")} htmlFor={id("department")}>
            <select
              id={id("department")}
              value={form.department_id}
              onChange={(e) => changeDepartment(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t("employees.form.none")}</option>
              {departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {teams.length > 0 && (
          <Field label={t("employees.form.team")} htmlFor={id("team")}>
            <select
              id={id("team")}
              value={form.team_id}
              onChange={(e) => changeTeam(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t("employees.form.none")}</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t("employees.form.jobTitle")} htmlFor={id("job")}>
          <Input id={id("job")} value={form.job_title} onChange={(e) => onChange({ job_title: e.target.value })} />
        </Field>
        {managers && (
          <Field
            label={t("employees.form.manager")}
            htmlFor={id("manager")}
            hint={t("employees.form.managerHint")}
          >
            <SearchableSelect
              id={id("manager")}
              options={managerOptions}
              value={form.manager_employee_id}
              onChange={(value) => onChange({ manager_employee_id: value })}
              placeholder={t("employees.form.noManager")}
              className="h-9 w-full rounded-md"
            />
          </Field>
        )}
        <Field
          label={t("common.order.label")}
          htmlFor={id("order")}
          hint={t("common.order.hint", { example: t("employees.form.orderExample") })}
        >
          <Input
            id={id("order")}
            type="number"
            inputMode="numeric"
            min={0}
            max={99999}
            step={1}
            placeholder={t("common.order.placeholder")}
            value={form.sort_order}
            onChange={(e) => onChange({ sort_order: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.employmentType")} htmlFor={id("type")}>
          <select
            id={id("type")}
            value={form.employment_type}
            onChange={(e) => onChange({ employment_type: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t("employees.form.notSet")}</option>
            {optionsIn(lang, "type", EMPLOYMENT_TYPES).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("employees.form.hireDate")} htmlFor={id("hire")}>
          <Input
            id={id("hire")}
            type="date"
            value={form.hire_date}
            onChange={(e) => onChange({ hire_date: e.target.value })}
          />
        </Field>
        <Field
          label={t("common.field.status")}
          htmlFor={id("status")}
          hint={t("employees.form.statusHint")}
          wide={!hasLeft(form.employment_status)}
        >
          <SearchableSelect
            id={id("status")}
            options={optionsIn(lang, "status", EMPLOYMENT_STATUSES)}
            value={form.employment_status}
            onChange={(value) => onChange({ employment_status: value })}
            clearable={false}
            className="h-9 w-full rounded-md"
          />
        </Field>
        {hasLeft(form.employment_status) && (
          <Field label={t("employees.form.lastDay")} htmlFor={id("term")}>
            <Input
              id={id("term")}
              type="date"
              value={form.termination_date}
              onChange={(e) => onChange({ termination_date: e.target.value })}
            />
          </Field>
        )}
      </Section>

      <Section title={t("employees.form.personal")}>
        <Field label={t("employees.form.gender")} htmlFor={id("gender")}>
          <select
            id={id("gender")}
            value={form.gender}
            onChange={(e) => onChange({ gender: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t("employees.form.notSet")}</option>
            {optionsIn(lang, "gender", GENDERS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("employees.form.dateOfBirth")} htmlFor={id("dob")}>
          <Input
            id={id("dob")}
            type="date"
            value={form.date_of_birth}
            onChange={(e) => onChange({ date_of_birth: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.address")} htmlFor={id("address")} wide>
          <textarea
            id={id("address")}
            rows={2}
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
        <Field
          label={t("common.field.notes")}
          htmlFor={id("notes")}
          hint={t("employees.form.notesHint")}
          wide
        >
          <textarea
            id={id("notes")}
            rows={2}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
      </Section>

      <Section title={t("employees.form.identity")}>
        <Field label={t("employees.form.nationality")} htmlFor={id("nationality")} wide>
          <Input
            id={id("nationality")}
            placeholder={t("employees.form.nationalityPlaceholder")}
            value={form.nationality}
            onChange={(e) => onChange({ nationality: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.nationalId")} htmlFor={id("national-id")}>
          <Input
            id={id("national-id")}
            value={form.national_id_number}
            onChange={(e) => onChange({ national_id_number: e.target.value })}
          />
        </Field>
        <Field label={t("employees.form.passport")} htmlFor={id("passport")} hint={t("employees.form.passportHint")}>
          <Input id={id("passport")} value={form.passport_number} onChange={(e) => onChange({ passport_number: e.target.value })} />
        </Field>
      </Section>

      <Section title={t("employees.form.compliance")}>
        <Field label={t("employees.form.nssf")} htmlFor={id("nssf")} hint={t("employees.form.nssfHint")}>
          <Input id={id("nssf")} value={form.nssf_number} onChange={(e) => onChange({ nssf_number: e.target.value })} />
        </Field>
        <Field label={t("employees.form.taxId")} htmlFor={id("tax")}>
          <Input id={id("tax")} value={form.tax_id} onChange={(e) => onChange({ tax_id: e.target.value })} />
        </Field>
      </Section>

      {salary !== "none" && (
        <Section title={t("employees.form.salary")}>
          <Field
            label={t("employees.form.baseSalary")}
            htmlFor={id("salary")}
            hint={salary === "view" ? t("employees.form.salaryViewHint") : t("employees.form.salaryEditHint")}
          >
            <Input
              id={id("salary")}
              type="number"
              min={0}
              step={form.salary_currency === "KHR" ? 1000 : 0.01}
              disabled={salary === "view"}
              value={form.base_salary}
              onChange={(e) => onChange({ base_salary: e.target.value })}
            />
          </Field>
          <Field label={t("common.field.currency")} htmlFor={id("currency")}>
            <select
              id={id("currency")}
              disabled={salary === "view"}
              value={form.salary_currency}
              onChange={(e) => onChange({ salary_currency: e.target.value })}
              className={SELECT_CLASS}
            >
              {SALARY_CURRENCIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          {/* Where pay goes, so only people who may set pay can change it. */}
          <Field label={t("employees.form.bank")} htmlFor={id("bank")}>
            <Input
              id={id("bank")}
              list={id("bank-list")}
              placeholder="ABA Bank"
              disabled={salary === "view"}
              value={form.bank_name}
              onChange={(e) => onChange({ bank_name: e.target.value })}
            />
            <datalist id={id("bank-list")}>
              {CAMBODIAN_BANKS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
          </Field>
          <Field label={t("employees.form.bankAccount")} htmlFor={id("account")}>
            <Input
              id={id("account")}
              inputMode="numeric"
              disabled={salary === "view"}
              value={form.bank_account_number}
              onChange={(e) => onChange({ bank_account_number: e.target.value })}
            />
          </Field>
        </Section>
      )}
    </div>
  );
}
