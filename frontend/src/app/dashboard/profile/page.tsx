"use client";

import { useState } from "react";
import { IdCard, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { KbachCorner, surfaceCard } from "@/components/dashboard/kbach";
import { useMe } from "@/contexts/me-context";
import { api, ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Same look as the home page (components/dashboard/kbach): a hero card with the
// person's photo, name and role over the kbach flower, then the two forms on
// solid surface cards.

/** Who's signed in: photo, name, role at the business, and how they sign in. */
function ProfileHero() {
  const { me } = useMe();
  const t = useT();
  // Tight line-height suits big Latin headings but clips Khmer's stacked marks.
  const tight = useLang() === "km" ? undefined : "leading-tight";
  if (!me) return null;

  const name = me.user.name;
  const roles = me.roles.join(", ") || t("access.profilePage.noRole");
  const chip = "inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-surface-border bg-surface/85 px-3 text-[13px] font-medium";

  return (
    <section className={cn(surfaceCard, "p-5")}>
      <KbachCorner />
      <p className="text-[13px] font-semibold text-ink-muted">{t("access.profilePage.title")}</p>
      <div className="mt-3 flex items-center gap-4">
        <EmployeeAvatar name={name || "?"} className="size-16 text-lg ring-2 ring-surface" />
        <div className="min-w-0">
          <h1 className={cn("truncate text-2xl font-semibold tracking-tight", tight)}>{name}</h1>
          <p className="truncate text-sm text-ink-muted">
            {t("access.profilePage.roleAt", {
              roles,
              company: me.company?.name ?? "Business OS",
            })}
          </p>
        </div>
      </div>
      {(me.user.login_id || me.user.email) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {me.user.login_id && (
            <span className={chip} title={t("access.signInMethod.employeeId")}>
              <IdCard className="size-4 shrink-0" aria-label={t("access.signInMethod.employeeId")} />
              <span className="truncate tabular-nums">{me.user.login_id}</span>
            </span>
          )}
          {me.user.email && (
            <span className={chip} title={t("common.field.email")}>
              <Mail className="size-4 shrink-0" aria-label={t("common.field.email")} />
              <span className="truncate">{me.user.email}</span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/** A form on a solid surface card, with its title and a one-line hint. */
function FormCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className={cn(surfaceCard, "p-5")}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 mb-4 text-sm text-ink-muted">{hint}</p>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const { me, refresh } = useMe();
  const t = useT();

  const [name, setName] = useState(me?.user.name ?? "");
  const [email, setEmail] = useState(me?.user.email ?? "");
  const signsInById = Boolean(me?.user.login_id);
  // Replacing the sign-in email asks for the password, like changing the password does.
  const [emailPassword, setEmailPassword] = useState("");
  const emailChanged = Boolean(me?.user.email) && (email.trim() === "" ? null : email) !== me?.user.email;
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!me) return null;

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    setSavingProfile(true);

    try {
      await api.profile.update({
        name,
        email: email.trim() === "" ? null : email,
        ...(emailChanged ? { current_password: emailPassword } : {}),
      });
      notifySuccess(t("access.profilePage.updated"));
      setEmailPassword("");
      setProfileSaved(true);
      refresh();
    } catch (err) {
      notifyError(err);
      setProfileError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setSavingPassword(true);

    try {
      await api.profile.updatePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      notifySuccess(t("access.profilePage.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (err) {
      notifyError(err);
      setPasswordError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="p-4 text-ink sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <ProfileHero />

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <FormCard
            title={t("access.profilePage.accountTitle")}
            hint={signsInById ? t("access.profilePage.accountHintId") : t("access.profilePage.accountHint")}
          >
            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("common.field.name")}</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{signsInById ? t("access.profilePage.emailOptional") : t("common.field.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  // Someone who signs in with an employee ID has no email to lose.
                  required={!signsInById}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {signsInById && (
                  <p className="text-xs text-muted-foreground">
                    {/* The ID is shown in bold, wherever {id} falls in the sentence. */}
                    {t("access.profilePage.signsInWithId").split("{id}")[0]}
                    <strong>{me?.user.login_id}</strong>
                    {t("access.profilePage.signsInWithId").split("{id}")[1]}
                  </p>
                )}
              </div>
              {emailChanged && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email_password">{t("access.profilePage.currentPassword")}</Label>
                  <Input
                    id="email_password"
                    type="password"
                    required
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <p className="text-xs text-muted-foreground">{t("access.profilePage.emailPasswordHint")}</p>
                </div>
              )}
              {profileError && <Alert variant="destructive">{profileError}</Alert>}
              {profileSaved && <Badge variant="success">{t("common.message.saved")}</Badge>}
              <Button type="submit" disabled={savingProfile} className="self-start">
                {savingProfile ? t("common.message.saving") : t("common.action.saveChanges")}
              </Button>
            </form>
          </FormCard>

          <FormCard title={t("access.profilePage.passwordTitle")} hint={t("access.profilePage.passwordHint")}>
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current_password">{t("access.profilePage.currentPassword")}</Label>
                <Input
                  id="current_password"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new_password">{t("access.profilePage.newPassword")}</Label>
                <Input
                  id="new_password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm_password">{t("access.profilePage.confirmPassword")}</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {passwordError && <Alert variant="destructive">{passwordError}</Alert>}
              {passwordSaved && <Badge variant="success">{t("access.profilePage.passwordUpdated")}</Badge>}
              <Button type="submit" disabled={savingPassword} className="self-start">
                {savingPassword ? t("access.profilePage.updating") : t("access.profilePage.updatePassword")}
              </Button>
            </form>
          </FormCard>
        </div>
      </div>
    </div>
  );
}
