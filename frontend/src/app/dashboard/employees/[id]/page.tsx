"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange, Download, Eye, IdCard, KeyRound, Trash2, User, UserX, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LoginLink } from "@/components/dashboard/login-link";
import { AttendanceExportDialog } from "@/components/dashboard/attendance-export-dialog";
import { CardPreviewDialog } from "@/components/dashboard/card-preview-dialog";
import { CreateLoginDialog } from "@/components/dashboard/create-login-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  EmployeeFormFields,
  formFromEmployee,
  type SalaryAccess,
  formatSalary,
  labelIn,
  statusVariant,
  toPayload,
  type EmployeeForm,
} from "@/components/dashboard/employee-form";
import { PhotoPicker } from "@/components/dashboard/photo-picker";
import { EmployeeScheduleAssignments } from "@/components/dashboard/employee-schedule-assignments";
import { EmployeePayPanel } from "@/components/dashboard/payroll/employee-pay-panel";
import { RosterView } from "@/components/dashboard/roster-view";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Department, Employee, photoSrc, Team } from "@/lib/api";
import { withBusy } from "@/lib/busy";
import { saveBlob } from "@/lib/download";
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Tab = "profile" | "schedule" | "pay";

function dateLabel(value: string | null | undefined, lang: Lang): string {
  if (!value) return "—";
  return new Date(value.slice(0, 10) + "T00:00:00").toLocaleDateString(dateLocale(lang), { year: "numeric", month: "short", day: "numeric" });
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
  const t = useT();
  const lang = useLang();

  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canRoster = me?.permissions.includes("schedules.view") ?? false;
  const salaryAccess: SalaryAccess = me?.permissions.includes("salary.manage")
    ? "edit"
    : me?.permissions.includes("salary.view")
      ? "view"
      : "none";
  const canExportAttendance = (me?.permissions.includes("attendance.manage") ?? false) && Boolean(me?.modules.attendance);
  const canPrintCard = (me?.permissions.includes("employees.view") ?? false) && Boolean(me?.modules.id_cards);
  // Salary history, tax profile and allowances live with payroll.
  const canPay = salaryAccess !== "none" && Boolean(me?.modules.payroll);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Empty when the role can't see them (the pickers then don't show at all).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  // Who can be picked as line manager; null until loaded (the picker waits for it).
  const [managers, setManagers] = useState<{ id: number; name: string }[] | null>(null);
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" ? ((["schedule", "pay"] as const).find((t) => t === new URLSearchParams(window.location.search).get("tab")) ?? "profile") : "profile",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // "view" opens an in-page preview modal; "download" saves it straight
  // away. Tracked separately so only the button actually clicked shows
  // "Preparing…".
  const [cardAction, setCardAction] = useState<"view" | "download" | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false);

  async function handleCard(action: "view" | "download") {
    if (!employee) return;
    setCardAction(action);
    try {
      const blob = await withBusy(() => api.employees.card(employee.id));
      if (action === "view") {
        setCardBlob(blob);
        setCardPreviewOpen(true);
      } else {
        saveBlob(blob, `employee-card-${employee.employee_code ?? employee.id}.pdf`);
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setCardAction(null);
    }
  }

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
    api.employees.all().then((list) => setManagers(list.map((e) => ({ id: e.id, name: e.name })))).catch(() => setManagers(null));
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
      const payload = toPayload(form, { org: departments.length > 0 || teams.length > 0, manager: managers !== null, salary: salaryAccess === "edit" });
      // With an email login the email is their sign-in — it's changed from Users, not here.
      // (For an employee-ID login the email is only a contact detail, so it stays editable.)
      if (emailIsSignIn) delete payload.email;
      // Same for the ID they sign in with.
      if (idIsSignIn) delete payload.employee_code;

      const updated = await api.employees.update(employee.id, payload);
      setEmployee(updated);
      setForm(formFromEmployee(updated));
      notifySuccess(t("employees.profilePage.updated"));
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(blob: Blob) {
    setPhotoBusy(true);
    try {
      const res = await api.employees.uploadPhoto(id, blob);
      setEmployee((current) => (current ? { ...current, photo_url: res.photo_url } : current));
      notifySuccess(t("employees.profilePage.photoUpdated"));
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
      notifySuccess(t("employees.profilePage.photoRemoved"));
    } catch (err) {
      notifyError(err);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleDelete() {
    if (!employee) return;

    const ok = await confirm({
      title: t("employees.shared.deleteTitle", { name: employee.name }),
      description: t("employees.shared.deleteWarning"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.employees.remove(employee.id);
      notifySuccess(t("employees.shared.deleted", { name: employee.name }));
      refresh();
      router.push("/dashboard/employees");
    } catch (err) {
      notifyError(err);
    }
  }

  const back = (
    <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("employees.shared.backToList")}
    </Link>
  );

  if (missing) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {back}
        <EmptyState
          icon={UserX}
          title={t("employees.profilePage.notFound")}
          description={t("employees.profilePage.notFoundHint")}
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


  const tabs = [
    { id: "profile" as const, label: t("employees.profilePage.tabProfile"), icon: User, visible: true },
    { id: "schedule" as const, label: t("employees.profilePage.tabSchedule"), icon: CalendarRange, visible: canRoster },
    { id: "pay" as const, label: t("employees.profilePage.tabPay"), icon: Wallet, visible: canPay },
  ].filter((tab) => tab.visible);
  const activeTab: Tab = tab === "schedule" && canRoster ? "schedule" : tab === "pay" && canPay ? "pay" : "profile";

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
                  {employee.name_km && (
                    <p lang="km" className="-mt-1 text-sm text-muted-foreground">
                      {employee.name_km}
                    </p>
                  )}
                  {employee.job_title && <p className="text-sm text-muted-foreground">{employee.job_title}</p>}
                  <Badge variant={statusVariant(employee.employment_status)}>{labelIn(lang, "status", employee.employment_status)}</Badge>
                </div>

                <dl className="w-full divide-y divide-border border-t border-border pt-1">
                  <Fact label={t("common.field.branch")}>{employee.branch?.name ?? "—"}</Fact>
                  {employee.department && <Fact label={t("common.field.department")}>{employee.department.name}</Fact>}
                  {employee.team && <Fact label={t("common.field.team")}>{employee.team.name}</Fact>}
                  {employee.employee_code && <Fact label={t("employees.profilePage.code")}>{employee.employee_code}</Fact>}
                  <Fact label={t("common.field.phone")}>{employee.phone ?? "—"}</Fact>
                  <Fact label={t("common.field.email")}>{employee.email ?? "—"}</Fact>
                  <Fact label={t("employees.shared.hired")}>{dateLabel(employee.hire_date, lang)}</Fact>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("employees.shared.signIn")}</CardTitle>
                <CardDescription>
                  {employee.has_login ? t("employees.profilePage.canSignIn") : t("employees.profilePage.cantSignIn")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {employee.has_login ? (
                  <div className="flex flex-col gap-3">
                    <Badge variant="success" className="self-start">
                      {t("employees.shared.hasLogin")}
                    </Badge>
                    {employee.login && (
                      <dl className="divide-y divide-border text-sm">
                        <Fact label={t("employees.profilePage.signsInWith")}>
                          {employee.login.method === "email" ? t("common.field.email") : t("employees.shared.employeeId")}
                        </Fact>
                        <Fact label={employee.login.method === "email" ? t("common.field.email") : t("employees.shared.employeeId")}>{employee.login.identifier ?? "—"}</Fact>
                      </dl>
                    )}
                    {employee.login?.method === "employee_id" && (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">{t("employees.profilePage.shareLink")}</p>
                        <LoginLink />
                      </div>
                    )}
                  </div>
                ) : canManage ? (
                  <Button variant="outline" onClick={() => setLoginOpen(true)}>
                    <KeyRound className="size-4" />
                    {t("employees.shared.createLogin")}
                  </Button>
                ) : (
                  <Badge variant="secondary">{t("employees.shared.noLogin")}</Badge>
                )}
              </CardContent>
            </Card>

            {canExportAttendance && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("employees.profilePage.attendanceTitle")}</CardTitle>
                  <CardDescription>{t("employees.profilePage.attendanceHint", { name: employee.name })}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => setExportOpen(true)}>
                    <Download className="size-4" />
                    {t("employees.profilePage.exportAttendance")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {canPrintCard && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("employees.profilePage.cardTitle")}</CardTitle>
                  <CardDescription>{t("employees.profilePage.cardHint", { name: employee.name })}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" onClick={() => handleCard("view")} disabled={cardAction !== null}>
                    <Eye className="size-4" />
                    {cardAction === "view" ? t("employees.shared.preparing") : t("common.action.view")}
                  </Button>
                  <Button variant="outline" onClick={() => handleCard("download")} disabled={cardAction !== null}>
                    <IdCard className="size-4" />
                    {cardAction === "download" ? t("employees.shared.preparing") : t("common.action.download")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {canManage && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="size-4" />
                {t("employees.profilePage.deleteEmployee")}
              </Button>
            )}
          </div>

          {/* Right: details and roster */}
          <div className="flex min-w-0 flex-col gap-6">
            {tabs.length > 1 && (
              <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === item.id}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                      activeTab === item.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
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
                      managers={managers ?? undefined}
                      selfId={employee?.id}
                      currentManager={employee?.manager}
                      emailDisabled={emailIsSignIn}
                      emailHint={emailIsSignIn ? t("employees.profilePage.emailIsSignIn") : undefined}
                      codeDisabled={idIsSignIn}
                      codeHint={idIsSignIn ? t("employees.profilePage.idIsSignIn") : undefined}
                      salary={salaryAccess}
                    />
                  </CardContent>
                </Card>
                <p className="-mt-2 text-xs text-muted-foreground">
                  {t("employees.profilePage.branchMoveHint")}
                </p>
                {error && <Alert variant="destructive">{error}</Alert>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(formFromEmployee(employee))} disabled={saving}>
                    {t("employees.profilePage.reset")}
                  </Button>
                  <Button type="submit" disabled={saving || !form.name.trim()}>
                    {saving ? t("employees.profilePage.saving") : t("employees.profilePage.saveChanges")}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === "profile" && !canManage && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("employees.profilePage.details")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border">
                    <Fact label={t("employees.profilePage.employmentType")}>
                      {employee.employment_type ? labelIn(lang, "type", employee.employment_type) : "—"}
                    </Fact>
                    <Fact label={t("employees.shared.jobTitle")}>{employee.job_title ?? "—"}</Fact>
                    <Fact label={t("employees.shared.hired")}>{dateLabel(employee.hire_date, lang)}</Fact>
                    {/* Only present when the API sent it, i.e. the viewer has salary.view. */}
                    {employee.base_salary !== undefined && (
                      <Fact label={t("employees.profilePage.baseSalary")}>{formatSalary(employee.base_salary, employee.salary_currency)}</Fact>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {activeTab === "pay" && <EmployeePayPanel employeeId={employee.id} canEdit={salaryAccess === "edit"} />}

            {activeTab === "schedule" && (
              <div className="flex flex-col gap-6">
                {/* Their regular hours over time; the roster below is for one-off days. */}
                <EmployeeScheduleAssignments employee={employee} canManage={me?.permissions.includes("schedules.manage") ?? false} />
                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">{t("employees.profilePage.oneOffChanges")}</h2>
                  <RosterView employee={employee} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AttendanceExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        employee={{ id: employee.id, name: employee.name }}
      />
      <CreateLoginDialog
        key={loginOpen ? "open" : "closed"}
        employee={loginOpen ? employee : null}
        onOpenChange={setLoginOpen}
        onSaved={reload}
      />
      <CardPreviewDialog
        blob={cardBlob}
        filename={`employee-card-${employee.employee_code ?? employee.id}.pdf`}
        open={cardPreviewOpen}
        onOpenChange={setCardPreviewOpen}
      />
    </div>
  );
}
