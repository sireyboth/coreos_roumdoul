"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branch, Department, Employee, EmployeeInput, Team } from "@/lib/api";

export const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
];

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

export const labelFor = (options: { value: string; label: string }[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label ?? value ?? "—";

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
  job_title: string;
  employment_type: string;
  employment_status: string;
  hire_date: string;
  termination_date: string;
  gender: string;
  date_of_birth: string;
  address: string;
  notes: string;
};

export function emptyEmployeeForm(branchId = ""): EmployeeForm {
  return {
    name: "",
    employee_code: "",
    email: "",
    phone: "",
    branch_id: branchId,
    department_id: "",
    team_id: "",
    job_title: "",
    employment_type: "",
    employment_status: "active",
    hire_date: "",
    termination_date: "",
    gender: "",
    date_of_birth: "",
    address: "",
    notes: "",
  };
}

export function formFromEmployee(employee: Employee): EmployeeForm {
  return {
    name: employee.name,
    employee_code: employee.employee_code ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    // The API sends the branch as a nested object, not a branch_id field.
    branch_id: employee.branch?.id != null ? String(employee.branch.id) : "",
    department_id: employee.department?.id != null ? String(employee.department.id) : "",
    team_id: employee.team?.id != null ? String(employee.team.id) : "",
    job_title: employee.job_title ?? "",
    employment_type: employee.employment_type ?? "",
    employment_status: employee.employment_status,
    hire_date: employee.hire_date?.slice(0, 10) ?? "",
    termination_date: employee.termination_date?.slice(0, 10) ?? "",
    gender: employee.gender ?? "",
    date_of_birth: employee.date_of_birth?.slice(0, 10) ?? "",
    address: employee.address ?? "",
    notes: employee.notes ?? "",
  };
}

/**
 * `org` says whether the department/team pickers were available. Only then
 * are they sent — otherwise a person who can't see departments would wipe an
 * employee's department just by editing their phone number.
 */
export function toPayload(form: EmployeeForm, options: { org: boolean }): EmployeeInput {
  const orNull = (value: string) => value.trim() || null;

  return {
    name: form.name.trim(),
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
    job_title: orNull(form.job_title),
    employment_type: orNull(form.employment_type),
    employment_status: form.employment_status,
    hire_date: orNull(form.hire_date),
    // Only meaningful for someone who has left.
    termination_date: form.employment_status === "terminated" ? orNull(form.termination_date) : null,
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
  emailHint,
  emailDisabled,
  emailRequired,
  codeRequired,
  codeDisabled,
  codeHint,
}: {
  idPrefix: string;
  form: EmployeeForm;
  onChange: (patch: Partial<EmployeeForm>) => void;
  branches: Branch[];
  departments?: Department[];
  teams?: Team[];
  emailHint?: string;
  emailDisabled?: boolean;
  emailRequired?: boolean;
  // The employee code is their sign-in when they use an employee ID login.
  codeRequired?: boolean;
  // Locked when this ID is what they sign in with.
  codeDisabled?: boolean;
  codeHint?: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

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
      <Section title="Basic info">
        <Field label="Full name" htmlFor={id("name")} wide>
          <Input id={id("name")} required value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field
          label={codeRequired ? "Employee ID" : "Employee code (optional)"}
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
        <Field label="Phone (optional)" htmlFor={id("phone")}>
          <Input id={id("phone")} type="tel" value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </Field>
        <Field label="Email (optional)" htmlFor={id("email")} hint={emailHint} wide>
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

      <Section title="Work">
        <Field label="Branch" htmlFor={id("branch")}>
          <select
            id={id("branch")}
            required
            value={form.branch_id}
            onChange={(e) => onChange({ branch_id: e.target.value })}
            className={SELECT_CLASS}
          >
            {form.branch_id === "" && (
              <option value="" disabled>
                Select…
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
          <Field label="Department (optional)" htmlFor={id("department")}>
            <select
              id={id("department")}
              value={form.department_id}
              onChange={(e) => changeDepartment(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">None</option>
              {departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {teams.length > 0 && (
          <Field label="Team (optional)" htmlFor={id("team")}>
            <select
              id={id("team")}
              value={form.team_id}
              onChange={(e) => changeTeam(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">None</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Job title (optional)" htmlFor={id("job")}>
          <Input id={id("job")} value={form.job_title} onChange={(e) => onChange({ job_title: e.target.value })} />
        </Field>
        <Field label="Employment type" htmlFor={id("type")}>
          <select
            id={id("type")}
            value={form.employment_type}
            onChange={(e) => onChange({ employment_type: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Not set</option>
            {EMPLOYMENT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hire date" htmlFor={id("hire")}>
          <Input
            id={id("hire")}
            type="date"
            value={form.hire_date}
            onChange={(e) => onChange({ hire_date: e.target.value })}
          />
        </Field>
        <Field
          label="Status"
          htmlFor={id("status")}
          hint="Suspended and terminated employees can't check in."
          wide={form.employment_status !== "terminated"}
        >
          <select
            id={id("status")}
            value={form.employment_status}
            onChange={(e) => onChange({ employment_status: e.target.value })}
            className={SELECT_CLASS}
          >
            {EMPLOYMENT_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {form.employment_status === "terminated" && (
          <Field label="Last working day" htmlFor={id("term")}>
            <Input
              id={id("term")}
              type="date"
              value={form.termination_date}
              onChange={(e) => onChange({ termination_date: e.target.value })}
            />
          </Field>
        )}
      </Section>

      <Section title="Personal">
        <Field label="Gender" htmlFor={id("gender")}>
          <select
            id={id("gender")}
            value={form.gender}
            onChange={(e) => onChange({ gender: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">Not set</option>
            {GENDERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date of birth" htmlFor={id("dob")}>
          <Input
            id={id("dob")}
            type="date"
            value={form.date_of_birth}
            onChange={(e) => onChange({ date_of_birth: e.target.value })}
          />
        </Field>
        <Field label="Address" htmlFor={id("address")} wide>
          <textarea
            id={id("address")}
            rows={2}
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
        <Field
          label="Notes"
          htmlFor={id("notes")}
          hint="Personal details are only visible to people who can manage employees."
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
    </div>
  );
}
