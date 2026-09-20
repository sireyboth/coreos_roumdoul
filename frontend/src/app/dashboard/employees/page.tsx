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

const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

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
  const [name, setName] = useState(employee?.name ?? "");
  const [jobTitle, setJobTitle] = useState(employee?.job_title ?? "");
  const [branchId, setBranchId] = useState(employee?.branch_id != null ? String(employee.branch_id) : "");
  const [status, setStatus] = useState(employee?.employment_status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setError(null);
    setSaving(true);

    try {
      await api.employees.update(employee.id, {
        name,
        job_title: jobTitle || null,
        ...(branchId ? { branch_id: Number(branchId) } : {}),
        employment_status: status,
      });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {employee?.name}</DialogTitle>
          <DialogDescription>
            Moving someone to another branch also moves where they&apos;re allowed to check in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-branch">Branch</Label>
            <select
              id="edit-branch"
              required
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {branchId === "" && (
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
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-job-title">Job title (optional)</Label>
            <Input id="edit-job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-status">Status</Label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
            >
              {EMPLOYMENT_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Suspended and terminated employees can&apos;t check in.
            </p>
          </div>
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
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFor, setLoginFor] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.employees.list().then((res) => setEmployees(res.data)).catch(() => setEmployees([]));
    api.branches.list().then((res) => {
      setBranches(res.data);
      setBranchId((current) => current || String(res.data[0]?.id ?? ""));
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
        name,
        job_title: jobTitle || null,
        branch_id: Number(branchId),
        ...(loginPassword ? { email: loginEmail, password: loginPassword } : {}),
      });
      notifySuccess("Employee added", loginPassword ? `${loginEmail} can now sign in.` : undefined);
      refresh();
      setName("");
      setJobTitle("");
      setLoginEmail("");
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
      cell: (employee) => <span className="font-medium">{employee.name}</span>,
      sortValue: (employee) => employee.name,
      searchValue: (employee) => employee.name,
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
      id: "status",
      header: "Status",
      cell: (employee) => (
        <Badge variant={employee.employment_status === "active" ? "success" : "secondary"}>
          {employee.employment_status}
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
      options: [
        { value: "active", label: "Active" },
        { value: "on_leave", label: "On leave" },
        { value: "suspended", label: "Suspended" },
        { value: "terminated", label: "Terminated" },
      ],
      getValue: (employee) => employee.employment_status,
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add an employee</DialogTitle>
                    <DialogDescription>Every employee belongs to a branch.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="branch">Branch</Label>
                      <select
                        id="branch"
                        required
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                      >
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="job_title">Job title (optional)</Label>
                      <Input id="job_title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Login (optional)</p>
                      <p className="text-xs text-muted-foreground">
                        Fill both in so this employee can sign in and check in. You can also add it later.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="login_email">Email</Label>
                        <Input
                          id="login_email"
                          type="email"
                          required={loginPassword !== ""}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="login_password">Temporary password</Label>
                        <Input
                          id="login_password"
                          type="password"
                          minLength={8}
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
          searchPlaceholder="Search by name, branch or job title…"
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
