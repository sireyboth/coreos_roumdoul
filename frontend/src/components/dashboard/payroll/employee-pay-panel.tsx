"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, TrendingUp, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api, ApiError, type EmployeePay, type EmployeePayProfile, type PayCurrency, type SalaryReason } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { KIND_LABELS, SALARY_REASONS, dateLabel, money } from "./shared";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

const today = () => new Date().toLocaleDateString("en-CA");

function SalaryDialog({ employeeId, current, onOpenChange, onSaved }: { employeeId: number; current: EmployeePay["salaries"][number] | undefined; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(current ? String(Number(current.amount)) : "");
  const [currency, setCurrency] = useState<PayCurrency>(current?.currency ?? "USD");
  const [payType, setPayType] = useState<"monthly" | "daily">(current?.pay_type ?? "monthly");
  const [from, setFrom] = useState(today);
  const [reason, setReason] = useState<SalaryReason>(current ? "annual_increase" : "hired");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.employeePay.addSalary(employeeId, { amount: Number(amount), currency, pay_type: payType, effective_from: from, reason, note: note.trim() || null });
      notifySuccess("Salary saved", `${money(amount, currency)} from ${dateLabel(from)}`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{current ? "Change salary" : "Set salary"}</DialogTitle>
            <DialogDescription>
              Takes effect from the date you choose. Earlier months keep the salary they had; a future date is applied automatically when it arrives.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-amount">Amount</Label>
              <Input id="sal-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-currency">Currency</Label>
              <select id="sal-currency" className={SELECT_CLASS} value={currency} onChange={(e) => setCurrency(e.target.value as PayCurrency)}>
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-type">Paid</Label>
              <select id="sal-type" className={SELECT_CLASS} value={payType} onChange={(e) => setPayType(e.target.value as "monthly" | "daily")}>
                <option value="monthly">Per month</option>
                <option value="daily">Per day worked</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-from">From</Label>
              <Input id="sal-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-reason">Reason</Label>
              <select id="sal-reason" className={SELECT_CLASS} value={reason} onChange={(e) => setReason(e.target.value as SalaryReason)}>
                {SALARY_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-note">Note</Label>
              <Input id="sal-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Optional" />
            </div>
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !(Number(amount) > 0) || !from}>
              {saving ? "Saving…" : "Save salary"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ employeeId, components, onOpenChange, onSaved }: { employeeId: number; components: EmployeePay["item_components"]; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const active = components.filter((c) => c.is_active);
  const [componentId, setComponentId] = useState(String(active[0]?.id ?? ""));
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.employeePay.addItem(employeeId, { pay_component_id: Number(componentId), amount: Number(amount), effective_from: from, effective_to: to || null, note: note.trim() || null });
      notifySuccess("Item added");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add allowance or deduction</DialogTitle>
            <DialogDescription>A fixed amount every month, in their salary currency, for as long as you choose.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-comp">Item</Label>
              <select id="item-comp" className={SELECT_CLASS} value={componentId} onChange={(e) => setComponentId(e.target.value)}>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {KIND_LABELS[c.kind]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-amount">Amount a month</Label>
              <Input id="item-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-from">From</Label>
              <Input id="item-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-to">Until</Label>
              <Input id="item-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              <p className="text-xs text-muted-foreground">Empty = every month from now on.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-note">Note</Label>
            <Input id="item-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Optional — shown on the payslip" />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !componentId || !(Number(amount) > 0)}>
              {saving ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileCard({ employeeId, profile, canEdit }: { employeeId: number; profile: EmployeePayProfile; canEdit: boolean }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EmployeePayProfile>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      setForm(await api.employeePay.updateProfile(employeeId, form));
      notifySuccess("Tax and payment details saved");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax, NSSF and payment</CardTitle>
        <CardDescription>Dependents lower tax on salary. Bank and account number are on the Profile tab.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset disabled={!canEdit} className="contents">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.tax_resident} onChange={(e) => set({ tax_resident: e.target.checked })} />
              Tax resident of Cambodia
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nssf_enrolled} onChange={(e) => set({ nssf_enrolled: e.target.checked })} />
              Enrolled in NSSF
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.spouse_dependent} disabled={!form.tax_resident} onChange={(e) => set({ spouse_dependent: e.target.checked })} />
              Spouse doesn&apos;t work (dependent)
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pp-children">Dependent children</Label>
              <Input id="pp-children" type="number" min={0} max={20} disabled={!form.tax_resident} value={form.child_dependents} onChange={(e) => set({ child_dependents: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pp-method">Paid by</Label>
              <select id="pp-method" className={SELECT_CLASS} value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value as "bank" | "cash" })}>
                <option value="bank">Bank transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pp-holder">Account holder name</Label>
              <Input id="pp-holder" value={form.bank_account_name ?? ""} onChange={(e) => set({ bank_account_name: e.target.value || null })} maxLength={255} placeholder="As on the bank account" />
            </div>
          </fieldset>
          {!form.tax_resident && <p className="text-xs text-muted-foreground sm:col-span-2">Non-residents pay a flat rate with no dependent allowances.</p>}
          {canEdit && (
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/** The Pay tab: salary history, tax and NSSF details, and recurring allowances and deductions. */
export function EmployeePayPanel({ employeeId, canEdit }: { employeeId: number; canEdit: boolean }) {
  const confirm = useConfirm();
  const [pay, setPay] = useState<EmployeePay | null>(null);
  const [reloads, setReloads] = useState(0);
  const [dialog, setDialog] = useState<"salary" | "item" | null>(null);
  const reload = () => setReloads((n) => n + 1);

  useEffect(() => {
    api.employeePay.get(employeeId).then(setPay).catch(notifyError);
  }, [employeeId, reloads]);

  if (!pay) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const todayStr = today();
  const current = pay.salaries.find((s) => s.effective_from <= todayStr && (!s.effective_to || s.effective_to >= todayStr)) ?? pay.salaries[0];
  const latest = pay.salaries[0];

  async function removeSalary() {
    if (!latest) return;
    const ok = await confirm({ title: "Remove the latest salary?", description: `${money(latest.amount, latest.currency)} from ${dateLabel(latest.effective_from)}. The salary before it applies again.`, confirmLabel: "Remove", destructive: true });
    if (!ok) return;
    try {
      await api.employeePay.removeSalary(employeeId, latest.id);
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  async function removeItem(id: number, name: string) {
    const ok = await confirm({ title: `Remove ${name}?`, description: "It stops appearing on future payslips. Approved payslips keep it.", confirmLabel: "Remove", destructive: true });
    if (!ok) return;
    try {
      await api.employeePay.removeItem(employeeId, id);
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Salary</CardTitle>
            <CardDescription>Every change is kept, so each month is paid at the salary it had.</CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setDialog("salary")}>
              <TrendingUp className="size-4" />
              {pay.salaries.length ? "Change salary" : "Set salary"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {current ? (
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">Current salary</p>
              <p className="text-2xl font-semibold tabular-nums">
                {money(current.amount, current.currency)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{current.pay_type === "daily" ? "per day" : "per month"}</span>
              </p>
            </div>
          ) : (
            <Alert variant="info">No salary yet — this person is left out of pay runs until one is set.</Alert>
          )}
          {pay.salaries.length > 0 && (
            <ol className="flex flex-col divide-y divide-border">
              {pay.salaries.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">
                      {money(s.amount, s.currency)} {s.pay_type === "daily" ? "/ day" : "/ month"}
                      {s.effective_from > todayStr && <Badge variant="info" className="ml-2">Upcoming</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SALARY_REASONS.find((r) => r.value === s.reason)?.label ?? s.reason}
                      {s.note ? ` · ${s.note}` : ""}
                      {s.created_by ? ` · ${s.created_by.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dateLabel(s.effective_from)} – {s.effective_to ? dateLabel(s.effective_to) : "now"}
                    </span>
                    {canEdit && s.id === latest?.id && (
                      <Button variant="ghost" size="icon" aria-label="Remove this salary" onClick={removeSalary}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Allowances and deductions</CardTitle>
            <CardDescription>Fixed amounts every month: transport, phone, a loan repayment…</CardDescription>
          </div>
          {canEdit && pay.item_components.some((c) => c.is_active) && (
            <Button size="sm" variant="outline" onClick={() => setDialog("item")}>
              <Plus className="size-4" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {pay.item_components.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No allowance or deduction types yet. Create them in{" "}
              <Link href="/dashboard/payroll/settings" className="text-primary underline-offset-4 hover:underline">
                Payroll Settings
              </Link>{" "}
              (amount set on each employee).
            </p>
          )}
          {pay.item_components.length > 0 && pay.items.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
          {pay.items.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {pay.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.component?.name ?? "Item"}{" "}
                      <span className="tabular-nums text-muted-foreground">· {Number(item.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} a month</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.component ? KIND_LABELS[item.component.kind] : ""} · {dateLabel(item.effective_from)} – {item.effective_to ? dateLabel(item.effective_to) : "ongoing"}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => removeItem(item.id, item.component?.name ?? "this item")}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ProfileCard key={JSON.stringify(pay.profile)} employeeId={employeeId} profile={pay.profile} canEdit={canEdit} />

      {dialog === "salary" && <SalaryDialog employeeId={employeeId} current={current} onOpenChange={(o) => !o && setDialog(null)} onSaved={reload} />}
      {dialog === "item" && <ItemDialog employeeId={employeeId} components={pay.item_components} onOpenChange={(o) => !o && setDialog(null)} onSaved={reload} />}
    </div>
  );
}
