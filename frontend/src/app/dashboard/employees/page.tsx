"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, Users } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Employee } from "@/lib/api";

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
      onOpenChange(false);
      onSaved();
    } catch (err) {
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
          {error && <p className="text-sm text-destructive">{error}</p>}
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

export default function EmployeesPage() {
  const { me } = useMe();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFor, setLoginFor] = useState<Employee | null>(null);
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
      setName("");
      setJobTitle("");
      setLoginEmail("");
      setLoginPassword("");
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canManageBranches = me?.permissions.includes("branches.manage") ?? false;

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader
          title="Employees"
          description="The canonical record every module builds on."
          action={
            canManage &&
            (branches.length > 0 ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button>
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
                    {error && <p className="text-sm text-destructive">{error}</p>}
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

        {employees === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {employees?.length === 0 && (
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add your first employee to start building your team directory."
          />
        )}

        {employees && employees.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell className="text-muted-foreground">{employee.branch?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{employee.job_title ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={employee.employment_status === "active" ? "default" : "secondary"}>
                      {employee.employment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {employee.has_login ? (
                      <Badge variant="outline">Has login</Badge>
                    ) : canManage ? (
                      <Button variant="outline" size="sm" onClick={() => setLoginFor(employee)}>
                        <KeyRound className="size-3.5" />
                        Create login
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">No login</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

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
