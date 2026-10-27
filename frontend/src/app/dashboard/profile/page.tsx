"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";

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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("access.profilePage.title")}
          description={t("access.profilePage.roleAt", { roles: me.roles.join(", ") || t("access.profilePage.noRole"), company: me.company?.name ?? "Business OS" })}
        />

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("access.profilePage.accountTitle")}</CardTitle>
            <CardDescription>
              {signsInById ? t("access.profilePage.accountHintId") : t("access.profilePage.accountHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
              {profileError &&<Alert variant="destructive">{profileError}</Alert>}
              {profileSaved && <Badge variant="success">{t("common.message.saved")}</Badge>}
              <Button type="submit" disabled={savingProfile} className="self-start">
                {savingProfile ? t("access.profilePage.saving") : t("access.profilePage.saveChanges")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("access.profilePage.passwordTitle")}</CardTitle>
            <CardDescription>{t("access.profilePage.passwordHint")}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
