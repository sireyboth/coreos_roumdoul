"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api, ApiError, type PayComponent, type PayComponentRule, type PayGroup, type PayrollPolicy, type PaySchedule } from "@/lib/api";
import { translateNow, useLang, useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { TemplateFields } from "./component-dialog";
import { SCHEDULE_LABELS, ruleSummary, scheduleSummary, today } from "./shared";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

const RATE_BASES: PayrollPolicy["rate_basis"][] = ["fixed", "calendar", "scheduled"];

const MISSING_POLICIES: PayrollPolicy["missing_scan_policy"][] = ["review", "present", "absent"];

/** How a group uses one company component: as the company does, switched off, or with its own rule. */
type RuleChoice = "company" | "off" | "on" | "own";

type Form = {
  name: string;
  schedule: PaySchedule;
  cutoff_days: number[];
  anchor_date: string;
  auto_calculate: boolean;
  is_default: boolean;
  rate_basis: PayrollPolicy["rate_basis"] | "";
  rate_basis_days: string;
  hours_per_day: string;
  missing_scan_policy: PayrollPolicy["missing_scan_policy"] | "";
  daily_paid_holidays: "" | "yes" | "no";
  rules: Record<number, { choice: RuleChoice; params: Record<string, unknown> | null }>;
};

function initialForm(group: PayGroup | null, components: PayComponent[]): Form {
  const rules: Form["rules"] = {};
  for (const c of components) {
    const rule = group?.component_rules?.[String(c.id)];
    const choice: RuleChoice = !rule ? "company" : rule.params ? "own" : rule.is_active === false ? "off" : rule.is_active ? "on" : "company";
    rules[c.id] = { choice, params: rule?.params ?? c.params };
  }
  return {
    name: group?.name ?? "",
    schedule: group?.schedule ?? "monthly",
    cutoff_days: group?.cutoff_days ?? [31],
    anchor_date: group?.anchor_date ?? today(),
    auto_calculate: group?.auto_calculate ?? false,
    is_default: group?.is_default ?? false,
    rate_basis: group?.rate_basis ?? "",
    rate_basis_days: group?.rate_basis_days != null ? String(group.rate_basis_days) : "",
    hours_per_day: group?.hours_per_day != null ? String(group.hours_per_day) : "",
    missing_scan_policy: group?.missing_scan_policy ?? "",
    daily_paid_holidays: group?.daily_paid_holidays == null ? "" : group.daily_paid_holidays ? "yes" : "no",
    rules,
  };
}

function DayInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d === 31 ? t("payrollSetup.payGroups.dialog.lastDay") : t("payrollSetup.payGroups.dialog.day", { n: d })}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PayGroupDialog({
  group,
  components,
  policy,
  onOpenChange,
  onSaved,
}: {
  group: PayGroup | null;
  components: PayComponent[];
  policy: PayrollPolicy;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const rulable = components.filter((c) => c.method !== "base");
  const [form, setForm] = useState(() => initialForm(group, rulable));
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setRule = (id: number, patch: Partial<Form["rules"][number]>) => setForm((f) => ({ ...f, rules: { ...f.rules, [id]: { ...f.rules[id], ...patch } } }));
  const hasRuns = (group?.pay_runs_count ?? 0) > 0;

  function setSchedule(schedule: PaySchedule) {
    set({ schedule, cutoff_days: schedule === "semi_monthly" ? [15, 31] : schedule === "monthly" ? [form.cutoff_days[0] ?? 31] : form.cutoff_days });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const componentRules: Record<string, PayComponentRule> = {};
    for (const c of rulable) {
      const r = form.rules[c.id];
      if (r.choice === "off") componentRules[c.id] = { is_active: false };
      if (r.choice === "on") componentRules[c.id] = { is_active: true };
      if (r.choice === "own") componentRules[c.id] = { is_active: true, ...(c.method === "template" && r.params ? { params: r.params } : {}) };
    }
    const data: Partial<PayGroup> = {
      name: form.name.trim(),
      schedule: form.schedule,
      cutoff_days: form.schedule === "monthly" || form.schedule === "semi_monthly" ? form.cutoff_days : null,
      anchor_date: form.schedule === "weekly" || form.schedule === "biweekly" ? form.anchor_date : null,
      auto_calculate: form.schedule !== "custom" && form.auto_calculate,
      is_default: form.is_default,
      rate_basis: form.rate_basis || null,
      rate_basis_days: form.rate_basis === "fixed" && form.rate_basis_days ? Number(form.rate_basis_days) : null,
      hours_per_day: form.hours_per_day ? Number(form.hours_per_day) : null,
      missing_scan_policy: form.missing_scan_policy || null,
      daily_paid_holidays: form.daily_paid_holidays === "" ? null : form.daily_paid_holidays === "yes",
      component_rules: componentRules,
    };
    try {
      if (group) await api.payroll.updateGroup(group.id, data);
      else await api.payroll.createGroup(data);
      notifySuccess(translateNow(group ? "payrollSetup.payGroups.save.saved" : "payrollSetup.payGroups.save.added"), data.name);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("payrollSetup.payGroups.save.failed"));
    } finally {
      setSaving(false);
    }
  }

  const preview = { schedule: form.schedule, cutoff_days: form.cutoff_days, anchor_date: form.anchor_date };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{group ? t("payrollSetup.payGroups.dialog.editTitle", { name: group.name }) : t("payrollSetup.payGroups.dialog.addTitle")}</DialogTitle>
            <DialogDescription>{t("payrollSetup.payGroups.dialog.text")}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-name">{t("common.field.name")}</Label>
              <Input id="pg-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} placeholder={t("payrollSetup.payGroups.dialog.namePlaceholder")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-schedule">{t("payrollSetup.payGroups.dialog.paid")}</Label>
              <select id="pg-schedule" className={SELECT_CLASS} value={form.schedule} onChange={(e) => setSchedule(e.target.value as PaySchedule)}>
                {(Object.keys(SCHEDULE_LABELS) as PaySchedule[]).map((s) => (
                  <option key={s} value={s}>
                    {t(`payroll.shared.schedule.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.schedule === "monthly" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DayInput id="pg-cut" label={t("payrollSetup.payGroups.dialog.periodEnds")} value={form.cutoff_days[0] ?? 31} onChange={(n) => set({ cutoff_days: [n] })} />
              <p className="self-end pb-2 text-sm text-muted-foreground">{t("payrollSetup.payGroups.dialog.monthlyHint", { summary: scheduleSummary(preview, lang) })}</p>
            </div>
          )}
          {form.schedule === "semi_monthly" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DayInput id="pg-cut1" label={t("payrollSetup.payGroups.dialog.firstEnds")} value={form.cutoff_days[0] ?? 15} onChange={(n) => set({ cutoff_days: [n, form.cutoff_days[1] ?? 31] })} />
              <DayInput id="pg-cut2" label={t("payrollSetup.payGroups.dialog.secondEnds")} value={form.cutoff_days[1] ?? 31} onChange={(n) => set({ cutoff_days: [form.cutoff_days[0] ?? 15, n] })} />
            </div>
          )}
          {(form.schedule === "weekly" || form.schedule === "biweekly") && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-anchor">{t("payrollSetup.payGroups.dialog.anchor")}</Label>
                <Input id="pg-anchor" type="date" value={form.anchor_date} onChange={(e) => set({ anchor_date: e.target.value })} required />
              </div>
              <p className="self-end pb-2 text-sm text-muted-foreground">
                {t("payrollSetup.payGroups.dialog.weeklyHint", { summary: scheduleSummary(preview, lang), n: form.schedule === "weekly" ? 7 : 14 })}
              </p>
            </div>
          )}
          {form.schedule === "custom" && <p className="text-sm text-muted-foreground">{t("payrollSetup.payGroups.dialog.customHint")}</p>}
          {hasRuns && <p className="text-xs text-muted-foreground">{t("payrollSetup.payGroups.dialog.hasRuns")}</p>}

          <Alert variant="info" title={t("payrollSetup.payGroups.dialog.shareTitle")}>
            {t("payrollSetup.payGroups.dialog.shareText")}
          </Alert>

          <div className="flex flex-col gap-2">
            {form.schedule !== "custom" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.auto_calculate} onChange={(e) => set({ auto_calculate: e.target.checked })} />
                {t("payrollSetup.payGroups.dialog.autoCalculate")}
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} disabled={group?.is_default} onChange={(e) => set({ is_default: e.target.checked })} />
              {t("payrollSetup.payGroups.dialog.isDefault")}
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">{t("payrollSetup.payGroups.own.title")}</p>
              <p className="text-xs text-muted-foreground">{t("payrollSetup.payGroups.own.hint")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-basis">{t("payrollSetup.payGroups.own.dailyRate")}</Label>
                <select id="pg-basis" className={SELECT_CLASS} value={form.rate_basis} onChange={(e) => set({ rate_basis: e.target.value as Form["rate_basis"] })}>
                  <option value="">{t("payrollSetup.payGroups.own.companySetting", { value: t(`payrollSetup.payGroups.rateBasis.${policy.rate_basis}`).toLowerCase() })}</option>
                  {RATE_BASES.map((b) => (
                    <option key={b} value={b}>
                      {t(`payrollSetup.payGroups.rateBasis.${b}`)}
                    </option>
                  ))}
                </select>
              </div>
              {form.rate_basis === "fixed" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pg-days">{t("payrollSetup.payGroups.own.daysInMonth")}</Label>
                  <Input id="pg-days" type="number" min={1} max={31} placeholder={String(policy.rate_basis_days)} value={form.rate_basis_days} onChange={(e) => set({ rate_basis_days: e.target.value })} />
                </div>
              ) : (
                <div />
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-hours">{t("payrollSetup.payGroups.own.hoursPerDay")}</Label>
                <Input
                  id="pg-hours"
                  type="number"
                  min={1}
                  max={24}
                  step="0.5"
                  placeholder={t("payrollSetup.payGroups.own.companySetting", { value: policy.hours_per_day })}
                  value={form.hours_per_day}
                  onChange={(e) => set({ hours_per_day: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-missing">{t("payrollSetup.payGroups.own.missingScan")}</Label>
                <select id="pg-missing" className={SELECT_CLASS} value={form.missing_scan_policy} onChange={(e) => set({ missing_scan_policy: e.target.value as Form["missing_scan_policy"] })}>
                  <option value="">{t("payrollSetup.payGroups.own.companySetting", { value: t(`payrollSetup.payGroups.missing.${policy.missing_scan_policy}`).toLowerCase() })}</option>
                  {MISSING_POLICIES.map((m) => (
                    <option key={m} value={m}>
                      {t(`payrollSetup.payGroups.missing.${m}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-holidays">{t("payrollSetup.payGroups.own.holidays")}</Label>
                <select id="pg-holidays" className={SELECT_CLASS} value={form.daily_paid_holidays} onChange={(e) => set({ daily_paid_holidays: e.target.value as Form["daily_paid_holidays"] })}>
                  <option value="">
                    {t("payrollSetup.payGroups.own.companySetting", { value: policy.daily_paid_holidays ? t("payrollSetup.payGroups.own.paidLower") : t("payrollSetup.payGroups.own.notPaidLower") })}
                  </option>
                  <option value="yes">{t("payrollSetup.payGroups.own.paid")}</option>
                  <option value="no">{t("payrollSetup.payGroups.own.notPaid")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">{t("payrollSetup.payGroups.rules.title")}</p>
              <p className="text-xs text-muted-foreground">{t("payrollSetup.payGroups.rules.hint")}</p>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {rulable.map((c) => {
                const r = form.rules[c.id];
                const own = r.choice === "own" && c.method === "template";
                return (
                  <div key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {own
                            ? ruleSummary({ ...c, params: r.params }, lang)
                            : r.choice === "off"
                              ? t("payrollSetup.payGroups.rules.notUsed")
                              : `${c.is_active || r.choice === "on" ? "" : t("payrollSetup.payGroups.rules.offForCompany")}${ruleSummary(c, lang)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          aria-label={t("payrollSetup.payGroups.rules.inGroup", { name: c.name })}
                          className={`${SELECT_CLASS} sm:w-44`}
                          value={r.choice}
                          onChange={(e) => {
                            const choice = e.target.value as RuleChoice;
                            setRule(c.id, { choice });
                            setExpanded(choice === "own" && c.method === "template" ? c.id : null);
                          }}
                        >
                          <option value="company">{t("payrollSetup.payGroups.rules.company")}</option>
                          <option value="off">{t("payrollSetup.payGroups.rules.off")}</option>
                          {!c.is_active && <option value="on">{t("payrollSetup.payGroups.rules.on")}</option>}
                          {c.method === "template" && <option value="own">{t("payrollSetup.payGroups.rules.own")}</option>}
                        </select>
                        {own && expanded !== c.id && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(c.id)}>
                            {t("common.action.edit")}
                          </Button>
                        )}
                      </div>
                    </div>
                    {own && expanded === c.id && c.template && (
                      <div className="rounded-md bg-muted/40 p-3">
                        <TemplateFields template={c.template} params={r.params ?? {}} onChange={(params) => setRule(c.id, { params })} enforceOvertimeMinimums={policy.enforce_overtime_minimums} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? t("payrollSetup.payGroups.save.saving") : group ? t("common.action.save") : t("payrollSetup.payGroups.save.addGroup")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The company's pay groups, on the payroll settings page. */
export function PayGroupsCard({ groups, components, policy, onChanged }: { groups: PayGroup[]; components: PayComponent[]; policy: PayrollPolicy; onChanged: () => void }) {
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ group: PayGroup | null } | null>(null);

  async function remove(g: PayGroup) {
    const ok = await confirm({
      title: t("payrollSetup.payGroups.card.deleteTitle", { name: g.name }),
      description: t("payrollSetup.payGroups.card.deleteText"),
      confirmLabel: t("common.action.delete"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.payroll.removeGroup(g.id);
      onChanged();
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> {t("payrollSetup.payGroups.card.title")}
          </CardTitle>
          <CardDescription>{t("payrollSetup.payGroups.card.text")}</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing({ group: null })}>
          <Plus className="size-4" />
          {t("payrollSetup.payGroups.save.addGroup")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {groups.map((g) => {
          const own = [g.rate_basis, g.hours_per_day, g.missing_scan_policy, g.daily_paid_holidays].filter((v) => v !== null).length + Object.keys(g.component_rules ?? {}).length;
          return (
            <div key={g.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="flex min-w-0 flex-col items-start text-left" onClick={() => setEditing({ group: g })}>
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {g.name}
                  {g.is_default && <Badge variant="info">{t("payrollSetup.payGroups.card.default")}</Badge>}
                  {g.auto_calculate && <Badge variant="secondary">{t("payrollSetup.payGroups.card.automatic")}</Badge>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t(`payroll.shared.schedule.${g.schedule}`)} · {scheduleSummary(g, lang)}
                  {g.current_period ? t("payrollSetup.payGroups.card.now", { period: g.current_period.label }) : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t((g.employees_count ?? 0) === 1 ? "payrollSetup.payGroups.card.personOne" : "payrollSetup.payGroups.card.personOther", { n: g.employees_count ?? 0 })}
                  {own > 0 ? t(own === 1 ? "payrollSetup.payGroups.card.ownOne" : "payrollSetup.payGroups.card.ownOther", { n: own }) : t("payrollSetup.payGroups.card.companyRules")}
                </span>
              </button>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ group: g })}>
                  {t("common.action.edit")}
                </Button>
                {!g.is_default && g.pay_runs_count === 0 && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(g)}>
                    {t("common.action.delete")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      {editing && (
        <PayGroupDialog key={editing.group?.id ?? "new"} group={editing.group} components={components} policy={policy} onOpenChange={(o) => !o && setEditing(null)} onSaved={onChanged} />
      )}
    </Card>
  );
}
