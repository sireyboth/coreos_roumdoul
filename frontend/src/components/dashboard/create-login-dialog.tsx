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
import { SignInMethodPicker, type SignInMethod } from "@/components/dashboard/sign-in-method";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Employee } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

export function CreateLoginDialog({
  employee,
  onOpenChange,
  onSaved,
}: {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { me } = useMe();
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
        "Login created",
        method === "email"
          ? `${employee.name} can now sign in with ${email}.`
          : `${employee.name} signs in with company code ${me?.company?.slug} and employee ID ${code}.`,
      );
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
          <DialogDescription>Choose one way for them to sign in, and give them a temporary password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <SignInMethodPicker value={method} onChange={setMethod} name="create-login-method" />

          {method === "email" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-code">Employee ID</Label>
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
                  ? "This is their existing employee ID. Change it on their profile first if it's wrong."
                  : "They don't have an employee ID yet — this one will be saved on their profile."}
              </p>
              <p className="text-xs text-muted-foreground">
                They&apos;ll also need the company code <strong>{me?.company?.slug}</strong> to sign in.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Temporary password</Label>
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
