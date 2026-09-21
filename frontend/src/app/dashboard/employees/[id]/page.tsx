"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange, KeyRound, Trash2, User, UserX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CreateLoginDialog } from "@/components/dashboard/create-login-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  EmployeeFormFields,
  formFromEmployee,
  labelFor,
  toPayload,
  type EmployeeForm,
} from "@/components/dashboard/employee-form";
import { PhotoPicker } from "@/components/dashboard/photo-picker";
import { RosterView } from "@/components/dashboard/roster-view";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Department, Employee, photoSrc, Team } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Tab = "profile" | "schedule";

function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value.slice(0, 10) + "T00:00:00").toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

export default function EmployeePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { me, refresh } = useMe();
  const router = useRouter();
  const confirm = useConfirm();

  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canRoster = me?.permissions.includes("schedules.view") ?? false;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Empty when the role can't see them (the pickers then don't show at all).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "schedule" ? "schedule" : "profile",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.employees
      .get(id)
      .then((e) => {
        if (cancelled) return;
        setEmployee(e);
        setForm(formFromEmployee(e));
      })
      .catch(() => !cancelled && setMissing(true));

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    api.branches.list().then((res) => setBranches(res.data)).catch(() => setBranches([]));
    api.departments.list(200).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
    api.teams.list(200).then((res) => setTeams(res.data)).catch(() => setTeams([]));
  }, []);

  function reload() {
    api.employees
      .get(id)
      .then((e) => {
        setEmployee(e);
        setForm(formFromEmployee(e));
      })
      .catch(() => {});
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || !form) return;
    setError(null);
    setSaving(true);

    try {
      const payload = toPayload(form, { org: departments.length > 0 || teams.length > 0 });
      // With an email login the email is their sign-in — it's changed from Users, not here.
      // (For an employee-ID login the email is only a contact detail, so it stays editable.)
      if (emailIsSignIn) delete payload.email;
      // Same for the ID they sign in with.
      if (idIsSignIn) delete payload.employee_code;

      const updated = await api.employees.update(employee.id, payload);
      setEmployee(updated);
      setForm(formFromEmployee(updated));
      notifySuccess("Employee updated");
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(blob: Blob) {
    setPhotoBusy(true);
    try {
      const res = await api.employees.uploadPhoto(id, blob);
      setEmployee((current) => (current ? { ...current, photo_url: res.photo_url } : current));
      notifySuccess("Photo updated");
    } catch (err) {
      notifyError(err);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoBusy(true);
    try {
      await api.employees.removePhoto(id);
      setEmployee((current) => (current ? { ...current, photo_url: null } : current));
      notifySuccess("Photo removed");
    } catch (err) {
      notifyError(err);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleDelete() {
    if (!employee) return;

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
      router.push("/dashboard/employees");
    } catch (err) {
      notifyError(err);
    }
  }

  const back = (
    <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      Employees
    </Link>
  );

  if (missing) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {back}
        <EmptyState
          icon={UserX}
          title="Employee not found"
          description="They may have been deleted, or you don't have access to their branch."
        />
      </div>
    );
  }

  if (!employee || !form) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {back}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const idIsSignIn = employee.login?.method === "employee_id";
  // has_login without details means an older response — assume the safe case (email).
  const emailIsSignIn = employee.has_login && !idIsSignIn;

  const statusVariant =
    employee.employment_status === "active"
      ? "success"
      : employee.employment_status === "on_leave"
        ? "warning"
        : employee.employment_status === "terminated"
          ? "destructive"
          : "secondary";

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User, visible: true },
    { id: "schedule" as const, label: "Schedule", icon: CalendarRange, visible: canRoster },
  ].filter((t) => t.visible);
  const activeTab: Tab = tab === "schedule" && canRoster ? "schedule" : "profile";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        {back}

        <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left: who they are */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-4">
            <Card>
              <CardContent className="flex flex-col items-center gap-4">
                <PhotoPicker
                  name={employee.name}
                  src={photoSrc(employee.photo_url)}
                  canEdit={canManage}
                  busy={photoBusy}
                  onPick={handlePhoto}
                  onRemove={handleRemovePhoto}
                />
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <h1 className="text-xl font-semibold tracking-tight">{employee.name}</h1>
                  {employee.job_title && <p className="text-sm text-muted-foreground">{employee.job_title}</p>}
                  <Badge variant={statusVariant}>{labelFor(EMPLOYMENT_STATUSES, employee.employment_status)}</Badge>
                </div>

                <dl className="w-full divide-y divide-border border-t border-border pt-1">
                  <Fact label="Branch">{employee.branch?.name ?? "—"}</Fact>
                  {employee.department && <Fact label="Department">{employee.department.name}</Fact>}
                  {employee.team && <Fact label="Team">{employee.team.name}</Fact>}
                  {employee.employee_code && <Fact label="Code">{employee.employee_code}</Fact>}
                  <Fact label="Phone">{employee.phone ?? "—"}</Fact>
                  <Fact label="Email">{employee.email ?? "—"}</Fact>
                  <Fact label="Hired">{dateLabel(employee.hire_date)}</Fact>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sign-in</CardTitle>
                <CardDescription>
                  {employee.has_login ? "Can sign in and check in." : "Can't sign in or check in yet."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {employee.has_login ? (
                  <div className="flex flex-col gap-3">
                    <Badge variant="success" className="self-start">
                      Has login
                    </Badge>
                    {employee.login && (
                      <dl className="divide-y divide-border text-sm">
                        <Fact label="Signs in with">{employee.login.method === "email" ? "Email" : "Employee ID"}</Fact>
                        {employee.login.method === "employee_id" && <Fact label="Company code">{employee.login.company_code}</Fact>}
                        <Fact label={employee.login.method === "email" ? "Email" : "Employee ID"}>{employee.login.identifier ?? "—"}</Fact>
                      </dl>
                    )}
                  </div>
                ) : canManage ? (
                  <Button variant="outline" onClick={() => setLoginOpen(true)}>
                    <KeyRound className="size-4" />
                    Create login
                  </Button>
                ) : (
                  <Badge variant="secondary">No login</Badge>
                )}
              </CardContent>
            </Card>

            {canManage && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="size-4" />
                Delete employee
              </Button>
            )}
          </div>

          {/* Right: details and roster */}
          <div className="flex min-w-0 flex-col gap-6">
            {tabs.length > 1 && (
              <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                      activeTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <t.icon className="size-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "profile" && canManage && (
              <form onSubmit={handleSave} className="flex flex-col gap-6">
                <Card>
                  <CardContent>
                    <EmployeeFormFields
                      idPrefix="edit"
                      form={form}
                      onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
                      branches={branches}
                      departments={departments}
                      teams={teams}
                      emailDisabled={emailIsSignIn}
                      emailHint={emailIsSignIn ? "This is their sign-in email — change it from Users." : undefined}
                      codeDisabled={idIsSignIn}
                      codeHint={idIsSignIn ? "This is their sign-in ID, so it can't be changed here." : undefined}
                    />
                  </CardContent>
                </Card>
                <p className="-mt-2 text-xs text-muted-foreground">
                  Moving someone to another branch also moves where they&apos;re allowed to check in.
                </p>
                {error && <Alert variant="destructive">{error}</Alert>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(formFromEmployee(employee))} disabled={saving}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={saving || !form.name.trim()}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === "profile" && !canManage && (
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border">
                    <Fact label="Employment type">{employee.employment_type ? labelFor(EMPLOYMENT_TYPES, employee.employment_type) : "—"}</Fact>
                    <Fact label="Job title">{employee.job_title ?? "—"}</Fact>
                    <Fact label="Hired">{dateLabel(employee.hire_date)}</Fact>
                  </dl>
                </CardContent>
              </Card>
            )}

            {activeTab === "schedule" && <RosterView employee={employee} />}
          </div>
        </div>
      </div>

      <CreateLoginDialog
        key={loginOpen ? "open" : "closed"}
        employee={loginOpen ? employee : null}
        onOpenChange={setLoginOpen}
        onSaved={reload}
      />
    </div>
  );
}
