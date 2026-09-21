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
import { SignInMethodPicker, type SignInMethod } from "@/components/dashboard/sign-in-method";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch, Department, Team } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

export default function NewEmployeePage() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const canManage = me?.permissions.includes("employees.manage") ?? false;
  const canManageBranches = me?.permissions.includes("branches.manage") ?? false;

  const [branches, setBranches] = useState<Branch[] | null>(null);
  // Empty when the role can't see them (the pickers then don't show at all).
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState<EmployeeForm>(() => emptyEmployeeForm());
  const [loginPassword, setLoginPassword] = useState("");
  // One way to sign in, never both.
  const [method, setMethod] = useState<SignInMethod>("email");
  // Kept here until Save — the employee doesn't exist yet to upload it to.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        ...toPayload(form, { org: departments.length > 0 || teams.length > 0 }),
        name: form.name.trim(),
        branch_id: Number(form.branch_id),
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
        "Employee added",
        !loginPassword
          ? undefined
          : method === "email"
            ? `${form.email} can now sign in.`
            : `They sign in with company code ${me?.company?.slug} and employee ID ${form.employee_code}.`,
      );
      if (photoFailed) toast.warning("The photo couldn't be uploaded", { description: "You can add it again from their page." });
      router.push(`/dashboard/employees/${created.id}`);
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Employees
        </Link>

        <PageHeader title="Add an employee" description="Only the name and branch are required. You can fill in the rest later." />

        <PlanLimitAlert resource="employees" />

        {branches !== null && branches.length === 0 && (
          <Alert variant="warning">
            You need a branch before adding employees.{" "}
            {canManageBranches ? (
              <Link href="/dashboard/branches" className="font-medium underline">
                Create one first
              </Link>
            ) : (
              "Ask a company admin to create one."
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Photo</CardTitle>
              <CardDescription>Optional — shown across the app.</CardDescription>
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
                  emailRequired={loginPassword !== "" && method === "email"}
                  codeRequired={loginPassword !== "" && method === "employee_id"}
                  codeHint={loginPassword !== "" && method === "employee_id" ? "This is what they'll sign in with." : undefined}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sign-in</CardTitle>
                <CardDescription>
                  Optional. Give this employee a login so they can sign in and check in. Choose <strong>one</strong> way for them
                  to sign in. You can also do this later.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <SignInMethodPicker value={method} onChange={setMethod} />

                <div className="flex max-w-sm flex-col gap-2">
                  <Label htmlFor="login_password">Temporary password</Label>
                  <Input
                    id="login_password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to add the employee without a login.</p>
                </div>

                {loginPassword !== "" && (
                  <Alert variant="info">
                    {method === "email" ? (
                      <>They&apos;ll sign in with the <strong>email</strong> above and this password.</>
                    ) : (
                      <>
                        They&apos;ll sign in with company code <strong>{me?.company?.slug}</strong>, employee ID{" "}
                        <strong>{form.employee_code || "(fill in the Employee ID above)"}</strong> and this password. No email
                        needed.
                      </>
                    )}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {error && <Alert variant="destructive">{error}</Alert>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" render={<Link href="/dashboard/employees" />} nativeButton={false}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || atEmployeeLimit || !form.branch_id || !form.name.trim()}>
                {saving ? "Adding…" : "Add employee"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
