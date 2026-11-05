"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, Employee } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

/**
 * The "Password" tab on an employee's profile: an admin sets a new password
 * for someone who forgot theirs. The server signs them out everywhere and
 * refuses your own account (that's done from Profile) and a company admin's
 * unless you are one.
 */
export function ResetPasswordPanel({ employee }: { employee: Employee }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Checked here too so the mismatch shows before a round trip; the server checks again.
  const mismatch = confirmation.length > 0 && password !== confirmation;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setError(null);
    setDone(false);
    setSaving(true);

    try {
      await api.employees.resetPassword(employee.id, { password, password_confirmation: confirmation });
      notifySuccess(t("employees.profilePage.passwordDone"));
      setPassword("");
      setConfirmation("");
      setVisible(false);
      setDone(true);
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  const inputType = visible ? "text" : "password";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("employees.profilePage.passwordTitle")}</CardTitle>
        <CardDescription>{t("employees.profilePage.passwordHint", { name: employee.name })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
          <Alert variant="warning">{t("employees.profilePage.passwordSignOut", { name: employee.name })}</Alert>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-password">{t("access.profilePage.newPassword")}</Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={inputType}
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? t("employees.profilePage.passwordHide") : t("employees.profilePage.passwordShow")}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("employees.profilePage.passwordMin")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-password-confirm">{t("access.profilePage.confirmPassword")}</Label>
            <Input
              id="reset-password-confirm"
              type={inputType}
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={mismatch}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            {mismatch && <p className="text-xs text-destructive">{t("employees.profilePage.passwordMismatch")}</p>}
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}
          {done && (
            <Alert variant="success" title={t("employees.profilePage.passwordDone")}>
              {t("employees.profilePage.passwordDoneHint", { name: employee.name })}
            </Alert>
          )}

          <Button type="submit" disabled={saving || mismatch || password.length < 8} className="self-start">
            <KeyRound className="size-4" />
            {saving ? t("employees.profilePage.passwordSaving") : t("employees.profilePage.passwordSave")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
