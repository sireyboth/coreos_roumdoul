"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginLink } from "@/components/dashboard/login-link";
import { SignInMethodPicker, type SignInMethod } from "@/components/dashboard/sign-in-method";
import { api, ApiError, Employee } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";

export function CreateLoginDialog({
  employee,
  onOpenChange,
  onSaved,
}: {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  // Start on whatever they already have on file: an email, else an ID, else email.
  const [method, setMethod] = useState<SignInMethod>(employee?.email ? "email" : employee?.employee_code ? "employee_id" : "email");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [code, setCode] = useState(employee?.employee_code ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // An ID they already have can't be swapped for a different one here.
  const codeLocked = Boolean(employee?.employee_code);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setError(null);
    setSaving(true);

    try {
      await api.employees.createLogin(
        employee.id,
        method === "email"
          ? { login_method: "email", email, password }
          : { login_method: "employee_id", employee_code: code, password },
      );
      notifySuccess(
        t("access.createLogin.created"),
        method === "email"
          ? t("access.createLogin.createdEmail", { name: employee.name, email })
          : t("access.createLogin.createdId", { name: employee.name, code }),
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={employee !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("access.createLogin.title", { name: employee?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("access.createLogin.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <SignInMethodPicker value={method} onChange={setMethod} name="create-login-method" />

          {method === "email" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">{t("common.field.email")}</Label>
              <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-code">{t("access.createLogin.employeeId")}</Label>
              <Input
                id="login-code"
                required
                placeholder="E-001"
                value={code}
                disabled={codeLocked}
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {codeLocked
                  ? t("access.createLogin.codeLocked")
                  : t("access.createLogin.codeNew")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("access.createLogin.shareLink")}
              </p>
              <LoginLink />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">{t("access.createLogin.tempPassword")}</Label>
            <Input
              id="login-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("access.createLogin.creating") : t("access.createLogin.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
