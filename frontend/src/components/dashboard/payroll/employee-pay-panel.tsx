"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, TrendingUp, Trash2, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api, ApiError, type EmployeePay, type EmployeePayProfile, type PayCurrency, type PayGroupOption, type SalaryReason } from "@/lib/api";
import { translateNow, useLang, useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { SALARY_REASONS, dateLabel, money } from "./shared";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

const today = () => new Date().toLocaleDateString("en-CA");

function SalaryDialog({ employeeId, current, onOpenChange, onSaved }: { employeeId: number; current: EmployeePay["salaries"][number] | undefined; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
  const lang = useLang();
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
      notifySuccess(translateNow("payrollSetup.employeePay.salaryDialog.saved"), translateNow("payrollSetup.employeePay.shared.fromDate", { value: money(amount, currency), date: dateLabel(from, lang) }));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("payrollSetup.employeePay.shared.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{current ? t("payrollSetup.employeePay.salaryDialog.changeTitle") : t("payrollSetup.employeePay.salaryDialog.setTitle")}</DialogTitle>
            <DialogDescription>{t("payrollSetup.employeePay.salaryDialog.text")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-amount">{t("common.field.amount")}</Label>
              <Input id="sal-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-currency">{t("common.field.currency")}</Label>
              <select id="sal-currency" className={SELECT_CLASS} value={currency} onChange={(e) => setCurrency(e.target.value as PayCurrency)}>
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-type">{t("payrollSetup.employeePay.salaryDialog.paid")}</Label>
              <select id="sal-type" className={SELECT_CLASS} value={payType} onChange={(e) => setPayType(e.target.value as "monthly" | "daily")}>
                <option value="monthly">{t("payrollSetup.employeePay.salaryDialog.perMonth")}</option>
                <option value="daily">{t("payrollSetup.employeePay.salaryDialog.perDayWorked")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-from">{t("common.field.from")}</Label>
              <Input id="sal-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-reason">{t("common.field.reason")}</Label>
              <select id="sal-reason" className={SELECT_CLASS} value={reason} onChange={(e) => setReason(e.target.value as SalaryReason)}>
                {SALARY_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sal-note">{t("payrollSetup.employeePay.shared.note")}</Label>
              <Input id="sal-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder={t("payrollSetup.employeePay.shared.optional")} />
            </div>
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !(Number(amount) > 0) || !from}>
              {saving ? t("payrollSetup.employeePay.shared.saving") : t("payrollSetup.employeePay.salaryDialog.saveSalary")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ employeeId, components, onOpenChange, onSaved }: { employeeId: number; components: EmployeePay["item_components"]; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
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
      notifySuccess(translateNow("payrollSetup.employeePay.itemDialog.added"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("payrollSetup.employeePay.shared.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("payrollSetup.employeePay.itemDialog.title")}</DialogTitle>
            <DialogDescription>{t("payrollSetup.employeePay.itemDialog.text")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-comp">{t("payrollSetup.employeePay.itemDialog.item")}</Label>
              <select id="item-comp" className={SELECT_CLASS} value={componentId} onChange={(e) => setComponentId(e.target.value)}>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {t(`payroll.shared.kind.${c.kind}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-amount">{t("payrollSetup.employeePay.itemDialog.amountMonth")}</Label>
              <Input id="item-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-from">{t("common.field.from")}</Label>
              <Input id="item-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-to">{t("payrollSetup.employeePay.itemDialog.until")}</Label>
              <Input id="item-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("payrollSetup.employeePay.itemDialog.untilHint")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-note">{t("payrollSetup.employeePay.shared.note")}</Label>
            <Input id="item-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder={t("payrollSetup.employeePay.itemDialog.notePlaceholder")} />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !componentId || !(Number(amount) > 0)}>
              {saving ? t("payrollSetup.employeePay.shared.saving") : t("common.action.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileCard({ employeeId, profile, canEdit }: { employeeId: number; profile: EmployeePayProfile; canEdit: boolean }) {
  const t = useT();
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EmployeePayProfile>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      setForm(await api.employeePay.updateProfile(employeeId, form));
      notifySuccess(translateNow("payrollSetup.employeePay.profile.saved"));
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("payrollSetup.employeePay.profile.title")}</CardTitle>
        <CardDescription>{t("payrollSetup.employeePay.profile.text")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset disabled={!canEdit} className="contents">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.tax_resident} onChange={(e) => set({ tax_resident: e.target.checked })} />
              {t("payrollSetup.employeePay.profile.taxResident")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nssf_enrolled} onChange={(e) => set({ nssf_enrolled: e.target.checked })} />
              {t("payrollSetup.employeePay.profile.nssfEnrolled")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.spouse_dependent} disabled={!form.tax_resident} onChange={(e) => set({ spouse_dependent: e.target.checked })} />
              {t("payrollSetup.employeePay.profile.spouse")}
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pp-children">{t("payrollSetup.employeePay.profile.children")}</Label>
              <Input id="pp-children" type="number" min={0} max={20} disabled={!form.tax_resident} value={form.child_dependents} onChange={(e) => set({ child_dependents: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pp-method">{t("payrollSetup.employeePay.profile.paidBy")}</Label>
              <select id="pp-method" className={SELECT_CLASS} value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value as "bank" | "cash" })}>
                <option value="bank">{t("payrollSetup.employeePay.profile.bank")}</option>
                <option value="cash">{t("payrollSetup.employeePay.profile.cash")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pp-holder">{t("payrollSetup.employeePay.profile.holder")}</Label>
              <Input
                id="pp-holder"
                value={form.bank_account_name ?? ""}
                onChange={(e) => set({ bank_account_name: e.target.value || null })}
                maxLength={255}
                placeholder={t("payrollSetup.employeePay.profile.holderPlaceholder")}
              />
            </div>
          </fieldset>
          {!form.tax_resident && <p className="text-xs text-muted-foreground sm:col-span-2">{t("payrollSetup.employeePay.profile.nonResident")}</p>}
          {canEdit && (
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("payrollSetup.employeePay.shared.saving") : t("common.action.save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function PayGroupDialog({ employeeId, pay, onOpenChange, onSaved }: { employeeId: number; pay: EmployeePay; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const t = useT();
  const lang = useLang();
  const [groups, setGroups] = useState<PayGroupOption[] | null>(null);
  const [groupId, setGroupId] = useState("");
  // The first day after anything already paid.
  const earliest = pay.paid_through ? new Date(new Date(pay.paid_through + "T00:00:00").getTime() + 86400000).toLocaleDateString("en-CA") : undefined;
  const [from, setFrom] = useState(() => (earliest && earliest > today() ? earliest : today()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.payroll
      .groupOptions()
      .then((list) => {
        setGroups(list);
        setGroupId(String(list.find((g) => g.id !== pay.pay_group?.id)?.id ?? ""));
      })
      .catch((err) => {
        notifyError(err);
        setGroups([]);
      });
  }, [pay.pay_group?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.employeePay.setPayGroup(employeeId, { pay_group_id: Number(groupId), effective_from: from });
      notifySuccess(
        translateNow("payrollSetup.employeePay.groupDialog.changed"),
        translateNow("payrollSetup.employeePay.shared.fromDate", { value: groups?.find((g) => String(g.id) === groupId)?.name ?? "", date: dateLabel(from, lang) }),
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("payrollSetup.employeePay.shared.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("payrollSetup.employeePay.groupDialog.title")}</DialogTitle>
            <DialogDescription>{t("payrollSetup.employeePay.groupDialog.text")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg-group">{t("payrollSetup.employeePay.groupDialog.group")}</Label>
            <select id="pg-group" className={SELECT_CLASS} value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={groups === null}>
              {groups?.map((g) => (
                <option key={g.id} value={g.id} disabled={g.id === pay.pay_group?.id}>
                  {g.name} — {t(`payroll.shared.schedule.${g.schedule}`)}
                  {g.id === pay.pay_group?.id ? t("payrollSetup.employeePay.groupDialog.nowSuffix") : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg-from">{t("common.field.from")}</Label>
            <Input id="pg-from" type="date" min={earliest} value={from} onChange={(e) => setFrom(e.target.value)} required />
            <p className="text-xs text-muted-foreground">{t("payrollSetup.employeePay.groupDialog.fromHint")}</p>
            {pay.paid_through && <p className="text-xs text-muted-foreground">{t("payrollSetup.employeePay.groupDialog.paidThrough", { date: dateLabel(pay.paid_through, lang) })}</p>}
            {from > today() && (
              <p className="text-xs text-warning">{t("payrollSetup.employeePay.groupDialog.future", { group: pay.pay_group?.name ?? t("payrollSetup.employeePay.groupDialog.currentGroup") })}</p>
            )}
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !groupId || !from}>
              {saving ? t("payrollSetup.employeePay.shared.saving") : t("payrollSetup.employeePay.groupDialog.changeGroup")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The Pay tab: pay group, salary history, tax and NSSF details, and recurring allowances and deductions. */
export function EmployeePayPanel({ employeeId, canEdit }: { employeeId: number; canEdit: boolean }) {
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const [pay, setPay] = useState<EmployeePay | null>(null);
  const [reloads, setReloads] = useState(0);
  const [dialog, setDialog] = useState<"salary" | "item" | "group" | null>(null);
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
    const ok = await confirm({
      title: t("payrollSetup.employeePay.salaryCard.removeTitle"),
      description: t("payrollSetup.employeePay.salaryCard.removeText", { amount: money(latest.amount, latest.currency), date: dateLabel(latest.effective_from, lang) }),
      confirmLabel: t("common.action.remove"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.employeePay.removeSalary(employeeId, latest.id);
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  const latestGroup = pay.pay_groups[0];

  async function removeGroupChange() {
    if (!latestGroup) return;
    const ok = await confirm({
      title: t("payrollSetup.employeePay.groupCard.undoTitle"),
      description: t("payrollSetup.employeePay.groupCard.undoText", {
        group: latestGroup.pay_group?.name ?? t("payrollSetup.employeePay.groupCard.theGroup"),
        date: dateLabel(latestGroup.effective_from, lang),
      }),
      confirmLabel: t("payrollSetup.employeePay.groupCard.undo"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.employeePay.removePayGroup(employeeId, latestGroup.id);
      reload();
    } catch (err) {
      notifyError(err);
    }
  }

  async function removeItem(id: number, name: string) {
    const ok = await confirm({
      title: t("payrollSetup.employeePay.itemsCard.removeTitle", { name }),
      description: t("payrollSetup.employeePay.itemsCard.removeText"),
      confirmLabel: t("common.action.remove"),
      destructive: true,
    });
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
            <CardTitle>{t("payrollSetup.employeePay.groupCard.title")}</CardTitle>
            <CardDescription>{t("payrollSetup.employeePay.groupCard.text")}</CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setDialog("group")}>
              <Users className="size-4" />
              {t("payrollSetup.employeePay.groupDialog.changeGroup")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-medium">{pay.pay_group?.name ?? "—"}</span>
            {pay.pay_group && <span className="text-muted-foreground"> · {t(`payroll.shared.schedule.${pay.pay_group.schedule}`)}</span>}
            {pay.paid_through && <span className="text-muted-foreground"> · {t("payrollSetup.employeePay.groupCard.paidThrough", { date: dateLabel(pay.paid_through, lang) })}</span>}
          </p>
          {pay.pay_groups.length === 0 && <p className="text-xs text-muted-foreground">{t("payrollSetup.employeePay.groupCard.neverMoved")}</p>}
          {pay.pay_groups.length > 0 && (
            <ol className="flex flex-col divide-y divide-border">
              {pay.pay_groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {g.pay_group?.name ?? t("payrollSetup.employeePay.groupCard.group")}
                    {g.effective_from > todayStr && (
                      <Badge variant="info" className="ml-2">
                        {t("payrollSetup.employeePay.shared.upcoming")}
                      </Badge>
                    )}
                    {g.created_by && <span className="text-xs text-muted-foreground"> · {g.created_by.name}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dateLabel(g.effective_from, lang)} – {g.effective_to ? dateLabel(g.effective_to, lang) : t("payrollSetup.employeePay.shared.now")}
                    </span>
                    {canEdit && g.id === latestGroup?.id && (
                      <Button variant="ghost" size="icon" aria-label={t("payrollSetup.employeePay.groupCard.undoChange")} onClick={removeGroupChange}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("payrollSetup.employeePay.salaryCard.title")}</CardTitle>
            <CardDescription>{t("payrollSetup.employeePay.salaryCard.text")}</CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setDialog("salary")}>
              <TrendingUp className="size-4" />
              {pay.salaries.length ? t("payrollSetup.employeePay.salaryDialog.changeTitle") : t("payrollSetup.employeePay.salaryDialog.setTitle")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {current ? (
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">{t("payrollSetup.employeePay.salaryCard.current")}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {money(current.amount, current.currency)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {current.pay_type === "daily" ? t("payrollSetup.employeePay.salaryCard.perDay") : t("payrollSetup.employeePay.salaryCard.perMonth")}
                </span>
              </p>
            </div>
          ) : (
            <Alert variant="info">{t("payrollSetup.employeePay.salaryCard.none")}</Alert>
          )}
          {pay.salaries.length > 0 && (
            <ol className="flex flex-col divide-y divide-border">
              {pay.salaries.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">
                      {money(s.amount, s.currency)} {s.pay_type === "daily" ? t("payrollSetup.employeePay.salaryCard.slashDay") : t("payrollSetup.employeePay.salaryCard.slashMonth")}
                      {s.effective_from > todayStr && (
                        <Badge variant="info" className="ml-2">
                          {t("payrollSetup.employeePay.shared.upcoming")}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const reason = SALARY_REASONS.find((r) => r.value === s.reason);
                        return reason ? t(reason.labelKey) : s.reason;
                      })()}
                      {s.note ? ` · ${s.note}` : ""}
                      {s.created_by ? ` · ${s.created_by.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dateLabel(s.effective_from, lang)} – {s.effective_to ? dateLabel(s.effective_to, lang) : t("payrollSetup.employeePay.shared.now")}
                    </span>
                    {canEdit && s.id === latest?.id && (
                      <Button variant="ghost" size="icon" aria-label={t("payrollSetup.employeePay.salaryCard.removeThis")} onClick={removeSalary}>
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
            <CardTitle>{t("payrollSetup.employeePay.itemsCard.title")}</CardTitle>
            <CardDescription>{t("payrollSetup.employeePay.itemsCard.text")}</CardDescription>
          </div>
          {canEdit && pay.item_components.some((c) => c.is_active) && (
            <Button size="sm" variant="outline" onClick={() => setDialog("item")}>
              <Plus className="size-4" />
              {t("common.action.add")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {pay.item_components.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("payrollSetup.employeePay.itemsCard.noTypesBefore")}{" "}
              <Link href="/dashboard/payroll/settings" className="text-primary underline-offset-4 hover:underline">
                {t("payrollSetup.employeePay.itemsCard.settingsLink")}
              </Link>{" "}
              {t("payrollSetup.employeePay.itemsCard.noTypesAfter")}
            </p>
          )}
          {pay.item_components.length > 0 && pay.items.length === 0 && <p className="text-sm text-muted-foreground">{t("payrollSetup.employeePay.itemsCard.none")}</p>}
          {pay.items.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {pay.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.component?.name ?? t("payrollSetup.employeePay.itemsCard.item")}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        · {t("payrollSetup.employeePay.itemsCard.aMonth", { amount: Number(item.amount).toLocaleString("en-US", { maximumFractionDigits: 2 }) })}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.component ? t(`payroll.shared.kind.${item.component.kind}`) : ""} · {dateLabel(item.effective_from, lang)} –{" "}
                      {item.effective_to ? dateLabel(item.effective_to, lang) : t("payrollSetup.employeePay.itemsCard.ongoing")}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("common.action.remove")}
                      onClick={() => removeItem(item.id, item.component?.name ?? t("payrollSetup.employeePay.itemsCard.thisItem"))}
                    >
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
      {dialog === "group" && <PayGroupDialog employeeId={employeeId} pay={pay} onOpenChange={(o) => !o && setDialog(null)} onSaved={reload} />}
      {dialog === "item" && <ItemDialog employeeId={employeeId} components={pay.item_components} onOpenChange={(o) => !o && setDialog(null)} onSaved={reload} />}
    </div>
  );
}
