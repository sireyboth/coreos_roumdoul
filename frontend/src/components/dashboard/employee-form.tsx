"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branch, Employee, EmployeeInput } from "@/lib/api";

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
    branch_id: employee.branch_id != null ? String(employee.branch_id) : "",
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

export function toPayload(form: EmployeeForm): EmployeeInput {
  const orNull = (value: string) => value.trim() || null;

  return {
    name: form.name.trim(),
    employee_code: orNull(form.employee_code),
    email: orNull(form.email),
    phone: orNull(form.phone),
    ...(form.branch_id ? { branch_id: Number(form.branch_id) } : {}),
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
  emailHint,
  emailDisabled,
  emailRequired,
}: {
  idPrefix: string;
  form: EmployeeForm;
  onChange: (patch: Partial<EmployeeForm>) => void;
  branches: Branch[];
  emailHint?: string;
  emailDisabled?: boolean;
  emailRequired?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Basic info">
        <Field label="Full name" htmlFor={id("name")} wide>
          <Input id={id("name")} required value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Employee code (optional)" htmlFor={id("code")}>
          <Input
            id={id("code")}
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
