"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Employee } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";
import { PlanLimitAlert } from "@/components/dashboard/plan-limit-alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  EmployeeFormFields,
  emptyEmployeeForm,
  formFromEmployee,
  labelFor,
  toPayload,
  type EmployeeForm,
} from "@/components/dashboard/employee-form";

function CreateLoginDialog({
  employee,
  onOpenChange,
  onSaved,
}: {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(employee?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setError(null);
    setSaving(true);

    try {
      await api.employees.createLogin(employee.id, { email, password });
      notifySuccess("Login created", `${employee.name} can now sign in and check in.`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={employee !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a login for {employee?.name}</DialogTitle>
          <DialogDescription>
            They&apos;ll use this email and temporary password to sign in and check in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Temporary password</Label>
            <Input
              id="login-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create login"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditEmployeeDialog({
  employee,
  branches,
  onOpenChange,
  onSaved,
}: {
  employee: Employee | null;
  branches: Branch[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EmployeeForm>(() => (employee ? formFromEmployee(employee) : emptyEmployeeForm()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setError(null);
    setSaving(true);

    try {
      const payload = toPayload(form);
      // With a login the email is their sign-in — it's changed from Users, not here.
      if (employee.has_login) delete payload.email;

      await api.employees.update(employee.id, payload);
      notifySuccess("Employee updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={employee !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {employee?.name}</DialogTitle>
          <DialogDescription>
            Moving someone to another branch also moves where they&apos;re allowed to check in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <EmployeeFormFields
            idPrefix="edit"
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            branches={branches}
            emailDisabled={employee?.has_login}
            emailHint={employee?.has_login ? "This is their sign-in email — change it from Users." : undefined}
          />
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const { me, refresh } = useMe();
  const confirm = useConfirm();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(() => emptyEmployeeForm());
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFor, setLoginFor] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.employees.list().then((res) => setEmployees(res.data)).catch(() => setEmployees([]));
    api.branches.list().then((res) => {
      setBranches(res.data);
      setForm((f) => (f.branch_id ? f : { ...f, branch_id: String(res.data[0]?.id ?? "") }));
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.employees.create({
        ...toPayload(form),
        name: form.name.trim(),
        branch_id: Number(form.branch_id),
        // The email above doubles as their sign-in when a password is set.
        ...(loginPassword ? { password: loginPassword } : {}),
      });
      notifySuccess("Employee added", loginPassword ? `${form.email} can now sign in.` : undefined);
      refresh();
      setForm(emptyEmployeeForm(form.branch_id));
      setLoginPassword("");
      setOpen(false);
      load();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(employee: Employee) {
    const ok = await confirm({
      title: `Delete ${employee.name}?`,
      description:
        "Their upcoming schedule is cleared and their login is deactivated. Past attendance keeps its history. If they've only left, set their status to Terminated instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.employees.remove(employee.id);
      notifySuccess(`${employee.name} deleted`);
      refresh();
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const atEmployeeLimit = me?.plan?.max_employees != null && (me.usage?.employees ?? 0) >= me.plan.max_employees;

  const columns: DataTableColumn<Employee>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (employee) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{employee.name}</span>
          {(employee.employee_code || employee.email) && (
            <span className="text-xs text-muted-foreground">
              {[employee.employee_code, employee.email].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      ),
      sortValue: (employee) => employee.name,
      searchValue: (employee) => [employee.name, employee.employee_code, employee.email].filter(Boolean).join(" "),
    },
    {
      id: "branch",
      header: "Branch",
      cell: (employee) => <span className="text-muted-foreground">{employee.branch?.name ?? "—"}</span>,
      sortValue: (employee) => employee.branch?.name,
      searchValue: (employee) => employee.branch?.name,
    },
    {
      id: "job_title",
      header: "Job title",
      cell: (employee) => <span className="text-muted-foreground">{employee.job_title ?? "—"}</span>,
      sortValue: (employee) => employee.job_title,
      searchValue: (employee) => employee.job_title,
    },
    {
      id: "phone",
      header: "Phone",
      hideOnMobile: true,
      cell: (employee) => <span className="text-muted-foreground">{employee.phone ?? "—"}</span>,
      searchValue: (employee) => employee.phone,
    },
    {
      id: "type",
      header: "Type",
      cell: (employee) =>
        employee.employment_type ? (
          <Badge variant="info">{labelFor(EMPLOYMENT_TYPES, employee.employment_type)}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (employee) => employee.employment_type,
    },
    {
      id: "hired",
      header: "Hired",
      cell: (employee) => (
        <span className="text-muted-foreground">
          {employee.hire_date
            ? new Date(employee.hire_date.slice(0, 10) + "T00:00:00").toLocaleDateString([], {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>
      ),
      sortValue: (employee) => employee.hire_date,
    },
    {
      id: "status",
      header: "Status",
      cell: (employee) => (
        <Badge
          variant={
            employee.employment_status === "active"
              ? "success"
              : employee.employment_status === "on_leave"
                ? "warning"
                : employee.employment_status === "terminated"
                  ? "destructive"
                  : "secondary"
          }
        >
          {labelFor(EMPLOYMENT_STATUSES, employee.employment_status)}
        </Badge>
      ),
      sortValue: (employee) => employee.employment_status,
    },
    {
      id: "login",
      header: "Login",
      sortValue: (employee) => (employee.has_login ? 1 : 0),
      cell: (employee) =>
        employee.has_login ? (
          <Badge variant="outline">Has login</Badge>
        ) : canManage ? (
          <Button variant="outline" size="sm" onClick={() => setLoginFor(employee)}>
            <KeyRound className="size-3.5" />
            Create login
          </Button>
        ) : (
          <span className="text-muted-foreground">No login</span>
        ),
    },
  ];

  const filters: DataTableFilter<Employee>[] = [
    {
      type: "select",
      id: "status",
      label: "Status",
      options: EMPLOYMENT_STATUSES,
      getValue: (employee) => employee.employment_status,
    },
    {
      type: "select",
      id: "type",
      label: "Type",
      options: EMPLOYMENT_TYPES,
      getValue: (employee) => employee.employment_type,
    },
    {
      type: "select",
      id: "branch",
      label: "Branch",
      options: branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
      getValue: (employee) => (employee.branch ? String(employee.branch.id) : null),
    },
    {
      type: "select",
      id: "login",
      label: "Login",
      options: [
        { value: "yes", label: "Has login" },
        { value: "no", label: "No login yet" },
      ],
      getValue: (employee) => (employee.has_login ? "yes" : "no"),
    },
  ];
  const canManageBranches = me?.permissions.includes("branches.manage") ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Employees"
          description="The canonical record every module builds on."
          action={
            canManage &&
            (branches.length > 0 ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button disabled={atEmployeeLimit}>
                      <Plus className="size-4" />
                      Add employee
                    </Button>
                  }
                />
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add an employee</DialogTitle>
                    <DialogDescription>Every employee belongs to a branch. Only the name is required.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-5">
                    <EmployeeFormFields
                      idPrefix="new"
                      form={form}
                      onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                      branches={branches}
                      emailRequired={loginPassword !== ""}
                    />
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-sm font-medium">Sign-in (optional)</p>
                      <p className="text-xs text-muted-foreground">
                        Set a temporary password so this employee can sign in and check in with the email above. You
                        can also do this later.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="login_password">Temporary password</Label>
                        <Input
                          id="login_password"
                          type="password"
                          minLength={8}
                          autoComplete="new-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    {error && <Alert variant="destructive">{error}</Alert>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Adding…" : "Add employee"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : undefined)
          }
        />

        {canManage && branches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You need a branch before adding employees.{" "}
            {canManageBranches ? (
              <Link href="/dashboard/branches" className="font-medium text-primary hover:underline">
                Create one first →
              </Link>
            ) : (
              "Ask a company admin to create one."
            )}
          </p>
        )}

        <PlanLimitAlert resource="employees" />

        <DataTable
          data={employees}
          getRowId={(employee) => employee.id}
          columns={columns}
          filters={filters}
          searchPlaceholder="Search by name, code, email, phone, branch or job title…"
          initialSort={{ columnId: "name", direction: "asc" }}
          emptyState={{
            icon: Users,
            title: "No employees yet",
            description: "Add your first employee to start building your team directory.",
          }}
          rowActions={
            canManage
              ? (employee) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditingEmployee(employee)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(employee)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </>
                )
              : undefined
          }
        />
      </div>

      <EditEmployeeDialog
        key={`edit-${editingEmployee?.id ?? "none"}`}
        employee={editingEmployee}
        branches={branches}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingEmployee(null);
        }}
        onSaved={load}
      />

      <CreateLoginDialog
        key={loginFor?.id ?? "none"}
        employee={loginFor}
        onOpenChange={(isOpen) => {
          if (!isOpen) setLoginFor(null);
        }}
        onSaved={load}
      />
    </div>
  );
}
