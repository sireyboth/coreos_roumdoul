"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmployeeFormFields,
  emptyEmployeeForm,
  toPayload,
  type EmployeeForm,
} from "@/components/dashboard/employee-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { PhotoPicker } from "@/components/dashboard/photo-picker";
import { PlanLimitAlert } from "@/components/dashboard/plan-limit-alert";
import { LoginLink } from "@/components/dashboard/login-link";
import { SignInMethodPicker, type SignInMethod } from "@/components/dashboard/sign-in-method";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Department, Team, type PayGroupOption } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

export default function NewEmployeePage() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const t = useT();
  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canManageBranches = me?.permissions.includes("branches.manage") ?? false;
  // A new employee's pay can only be set by someone allowed to change pay.
  const canEditSalary = me?.permissions.includes("salary.manage") ?? false;

  const [branches, setBranches] = useState<Branch[] | null>(null);
  // Empty when the role can't see them (the pickers then don't show at all).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  // Who can be picked as line manager; null until loaded (the picker waits for it).
  const [managers, setManagers] = useState<{ id: number; name: string }[] | null>(null);
  const [form, setForm] = useState<EmployeeForm>(() => emptyEmployeeForm());
  const [loginPassword, setLoginPassword] = useState("");
  // One way to sign in, never both.
  const [method, setMethod] = useState<SignInMethod>("email");
  // Kept here until Save — the employee doesn't exist yet to upload it to.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  // Pay groups to choose from — only with payroll on and the right to set pay; empty hides the picker.
  const [payGroups, setPayGroups] = useState<PayGroupOption[]>([]);
  const [payGroupId, setPayGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canEditSalary) return;
    api.payroll
      .groupOptions()
      .then((list) => {
        setPayGroups(list);
        setPayGroupId(String(list.find((g) => g.is_default)?.id ?? ""));
      })
      .catch(() => setPayGroups([]));
  }, [canEditSalary]);

  // People who can't add employees have no business on this page.
  useEffect(() => {
    if (me && !canManage) router.replace("/dashboard/employees");
  }, [me, canManage, router]);

  useEffect(() => {
    api.branches
      .list()
      .then((res) => {
        setBranches(res.data);
        setForm((f) => (f.branch_id ? f : { ...f, branch_id: String(res.data[0]?.id ?? "") }));
      })
      .catch(() => setBranches([]));
    api.departments.list(200).then((res) => setDepartments(res.data)).catch(() => setDepartments([]));
    api.teams.list(200).then((res) => setTeams(res.data)).catch(() => setTeams([]));
    api.employees.all().then((list) => setManagers(list.map((e) => ({ id: e.id, name: e.name })))).catch(() => setManagers(null));
  }, []);

  // Free the preview image when it's replaced or the page is left.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  const atEmployeeLimit = me?.plan?.max_employees != null && (me.usage?.employees ?? 0) >= me.plan.max_employees;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const created = await api.employees.create({
        ...toPayload(form, { org: departments.length > 0 || teams.length > 0, manager: managers !== null, salary: canEditSalary }),
        name: form.name.trim(),
        branch_id: Number(form.branch_id),
        // The default group needs no row: anyone never put in a group is in it.
        ...(payGroupId && !payGroups.find((g) => String(g.id) === payGroupId)?.is_default ? { pay_group_id: Number(payGroupId) } : {}),
        // Whichever way was chosen (their email, or their employee ID) is their sign-in.
        ...(loginPassword ? { password: loginPassword, login_method: method } : {}),
      });

      // The employee exists now; a failed photo must not lose them.
      let photoFailed = false;
      if (photo) {
        try {
          await api.employees.uploadPhoto(created.id, photo.blob);
        } catch {
          photoFailed = true;
        }
      }

      refresh();
      notifySuccess(
        t("employees.newPage.added"),
        !loginPassword
          ? undefined
          : method === "email"
            ? t("employees.newPage.addedEmail", { email: form.email })
            : t("employees.newPage.addedId", { code: form.employee_code }),
      );
      if (photoFailed) toast.warning(t("employees.newPage.photoFailed"), { description: t("employees.newPage.photoFailedHint") });
      router.push(`/dashboard/employees/${created.id}`);
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("employees.shared.backToList")}
        </Link>

        <PageHeader title={t("employees.newPage.title")} description={t("employees.newPage.description")} />

        <PlanLimitAlert resource="employees" />

        {branches !== null && branches.length === 0 && (
          <Alert variant="warning">
            {t("employees.shared.needBranch")}{" "}
            {canManageBranches ? (
              <Link href="/dashboard/branches" className="font-medium underline">
                {t("employees.shared.createBranch")}
              </Link>
            ) : (
              t("employees.shared.askAdmin")
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t("employees.newPage.photo")}</CardTitle>
              <CardDescription>{t("employees.newPage.photoHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PhotoPicker
                name={form.name}
                src={photo?.url ?? null}
                canEdit
                onPick={(blob) => setPhoto({ blob, url: URL.createObjectURL(blob) })}
                onRemove={() => setPhoto(null)}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardContent>
                <EmployeeFormFields
                  idPrefix="new"
                  form={form}
                  onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  branches={branches ?? []}
                  departments={departments}
                  teams={teams}
                  managers={managers ?? undefined}
                  emailRequired={loginPassword !== "" && method === "email"}
                  codeRequired={loginPassword !== "" && method === "employee_id"}
                  codeHint={loginPassword !== "" && method === "employee_id" ? t("employees.newPage.codeHint") : undefined}
                  salary={canEditSalary ? "edit" : "none"}
                />
              </CardContent>
            </Card>

            {payGroups.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("employees.newPage.payGroup")}</CardTitle>
                  <CardDescription>{t("employees.newPage.payGroupHint")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex max-w-sm flex-col gap-2">
                    <Label htmlFor="new-pay-group">{t("employees.newPage.payGroup")}</Label>
                    <select
                      id="new-pay-group"
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none"
                      value={payGroupId}
                      onChange={(e) => setPayGroupId(e.target.value)}
                    >
                      {payGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} — {t(`payroll.shared.schedule.${g.schedule}`)}
                          {g.is_default ? t("employees.newPage.defaultGroup") : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{t("employees.shared.signIn")}</CardTitle>
                <CardDescription>
                  {t("employees.newPage.signInHintBefore")}
                  <strong>{t("employees.newPage.signInHintOne")}</strong>
                  {t("employees.newPage.signInHintAfter")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <SignInMethodPicker value={method} onChange={setMethod} />

                <div className="flex max-w-sm flex-col gap-2">
                  <Label htmlFor="login_password">{t("employees.newPage.tempPassword")}</Label>
                  <Input
                    id="login_password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("employees.newPage.passwordHint")}</p>
                </div>

                {loginPassword !== "" && (
                  <Alert variant="info">
                    {method === "email" ? (
                      <>
                        {t("employees.newPage.emailInfoBefore")}
                        <strong>{t("employees.newPage.emailInfoStrong")}</strong>
                        {t("employees.newPage.emailInfoAfter")}
                      </>
                    ) : (
                      <>
                        {t("employees.newPage.idInfoBefore")}
                        <strong>{form.employee_code || t("employees.newPage.idMissing")}</strong>
                        {t("employees.newPage.idInfoAfter")}
                        <div className="mt-2">
                          <LoginLink />
                        </div>
                      </>
                    )}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {error && <Alert variant="destructive">{error}</Alert>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" render={<Link href="/dashboard/employees" />} nativeButton={false}>
                {t("common.action.cancel")}
              </Button>
              <Button type="submit" disabled={saving || atEmployeeLimit || !form.branch_id || !form.name.trim()}>
                {saving ? t("common.message.adding") : t("employees.shared.addEmployee")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
