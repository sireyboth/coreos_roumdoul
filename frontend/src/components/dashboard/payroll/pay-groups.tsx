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
import { notifyError, notifySuccess } from "@/lib/notify";
import { TemplateFields } from "./component-dialog";
import { SCHEDULE_LABELS, ruleSummary, scheduleSummary, today } from "./shared";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

const RATE_BASIS_LABELS: Record<PayrollPolicy["rate_basis"], string> = {
  fixed: "Monthly salary ÷ a fixed number of days",
  calendar: "Salary ÷ days in the period",
  scheduled: "Salary ÷ the person's scheduled work days",
};

const MISSING_LABELS: Record<PayrollPolicy["missing_scan_policy"], string> = {
  review: "Must be fixed before approving",
  present: "Counts as worked",
  absent: "Counts as absent",
};

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
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d === 31 ? "Last day of the month" : `Day ${d}`}
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
      notifySuccess(group ? "Pay group saved" : "Pay group added", data.name);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
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
            <DialogTitle>{group ? `Edit ${group.name}` : "Add pay group"}</DialogTitle>
            <DialogDescription>People paid on the same schedule by the same rules, e.g. office staff once a month, factory workers twice a month.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-name">Name</Label>
              <Input id="pg-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} placeholder="e.g. Factory workers" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pg-schedule">Paid</Label>
              <select id="pg-schedule" className={SELECT_CLASS} value={form.schedule} onChange={(e) => setSchedule(e.target.value as PaySchedule)}>
                {(Object.keys(SCHEDULE_LABELS) as PaySchedule[]).map((s) => (
                  <option key={s} value={s}>
                    {SCHEDULE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.schedule === "monthly" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DayInput id="pg-cut" label="Each period ends on" value={form.cutoff_days[0] ?? 31} onChange={(n) => set({ cutoff_days: [n] })} />
              <p className="self-end pb-2 text-sm text-muted-foreground">{scheduleSummary(preview)} — e.g. day 25 makes periods 26th → 25th.</p>
            </div>
          )}
          {form.schedule === "semi_monthly" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DayInput id="pg-cut1" label="First period ends on" value={form.cutoff_days[0] ?? 15} onChange={(n) => set({ cutoff_days: [n, form.cutoff_days[1] ?? 31] })} />
              <DayInput id="pg-cut2" label="Second period ends on" value={form.cutoff_days[1] ?? 31} onChange={(n) => set({ cutoff_days: [form.cutoff_days[0] ?? 15, n] })} />
            </div>
          )}
          {(form.schedule === "weekly" || form.schedule === "biweekly") && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-anchor">First day of any one period</Label>
                <Input id="pg-anchor" type="date" value={form.anchor_date} onChange={(e) => set({ anchor_date: e.target.value })} required />
              </div>
              <p className="self-end pb-2 text-sm text-muted-foreground">{scheduleSummary(preview)}. The rest follow every {form.schedule === "weekly" ? "7" : "14"} days.</p>
            </div>
          )}
          {form.schedule === "custom" && <p className="text-sm text-muted-foreground">HR picks the start and end of each run (at most 62 days). A monthly salary pays the share of each month the dates cover.</p>}
          {hasRuns && <p className="text-xs text-muted-foreground">This group already has pay runs: a new schedule applies from the period after its last run.</p>}

          <Alert variant="info" title="How a monthly salary is paid per period">
            Once a month: the full salary. Twice a month: half each period. Weekly: 12/52 of it; every 2 weeks: 12/26. Daily-paid staff are paid for the days they work. Tax and NSSF are only worked
            out for 1st → end-of-month periods for now.
          </Alert>

          <div className="flex flex-col gap-2">
            {form.schedule !== "custom" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.auto_calculate} onChange={(e) => set({ auto_calculate: e.target.checked })} />
                Prepare each period&apos;s pay run automatically when the period ends (someone still checks and approves it)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} disabled={group?.is_default} onChange={(e) => set({ is_default: e.target.checked })} />
              Default group — anyone not put in a group is paid with it
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">This group&apos;s own settings</p>
              <p className="text-xs text-muted-foreground">Leave as “Company setting” to use Payroll Settings.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-basis">Daily rate</Label>
                <select id="pg-basis" className={SELECT_CLASS} value={form.rate_basis} onChange={(e) => set({ rate_basis: e.target.value as Form["rate_basis"] })}>
                  <option value="">Company setting ({RATE_BASIS_LABELS[policy.rate_basis].toLowerCase()})</option>
                  {(Object.keys(RATE_BASIS_LABELS) as PayrollPolicy["rate_basis"][]).map((b) => (
                    <option key={b} value={b}>
                      {RATE_BASIS_LABELS[b]}
                    </option>
                  ))}
                </select>
              </div>
              {form.rate_basis === "fixed" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pg-days">Days in a month</Label>
                  <Input id="pg-days" type="number" min={1} max={31} placeholder={String(policy.rate_basis_days)} value={form.rate_basis_days} onChange={(e) => set({ rate_basis_days: e.target.value })} />
                </div>
              ) : (
                <div />
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-hours">Hours in a work day</Label>
                <Input id="pg-hours" type="number" min={1} max={24} step="0.5" placeholder={`Company setting (${policy.hours_per_day})`} value={form.hours_per_day} onChange={(e) => set({ hours_per_day: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-missing">A day with a missing scan</Label>
                <select id="pg-missing" className={SELECT_CLASS} value={form.missing_scan_policy} onChange={(e) => set({ missing_scan_policy: e.target.value as Form["missing_scan_policy"] })}>
                  <option value="">Company setting ({MISSING_LABELS[policy.missing_scan_policy].toLowerCase()})</option>
                  {(Object.keys(MISSING_LABELS) as PayrollPolicy["missing_scan_policy"][]).map((m) => (
                    <option key={m} value={m}>
                      {MISSING_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pg-holidays">Daily-paid staff on public holidays</Label>
                <select id="pg-holidays" className={SELECT_CLASS} value={form.daily_paid_holidays} onChange={(e) => set({ daily_paid_holidays: e.target.value as Form["daily_paid_holidays"] })}>
                  <option value="">Company setting ({policy.daily_paid_holidays ? "paid" : "not paid"})</option>
                  <option value="yes">Paid</option>
                  <option value="no">Not paid</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Pay rules for this group</p>
              <p className="text-xs text-muted-foreground">Switch a component off, or give it this group&apos;s own rule. Nothing changes for other groups.</p>
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
                          {own ? ruleSummary({ ...c, params: r.params }) : r.choice === "off" ? "Not used in this group" : `${c.is_active || r.choice === "on" ? "" : "Off for the company · "}${ruleSummary(c)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          aria-label={`${c.name} in this group`}
                          className={`${SELECT_CLASS} sm:w-44`}
                          value={r.choice}
                          onChange={(e) => {
                            const choice = e.target.value as RuleChoice;
                            setRule(c.id, { choice });
                            setExpanded(choice === "own" && c.method === "template" ? c.id : null);
                          }}
                        >
                          <option value="company">As the company</option>
                          <option value="off">Off</option>
                          {!c.is_active && <option value="on">On</option>}
                          {c.method === "template" && <option value="own">Own rule</option>}
                        </select>
                        {own && expanded !== c.id && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(c.id)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                    {own && expanded === c.id && c.template && (
                      <div className="rounded-md bg-muted/40 p-3">
                        <TemplateFields template={c.template} params={r.params ?? {}} onChange={(params) => setRule(c.id, { params })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : group ? "Save" : "Add group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The company's pay groups, on the payroll settings page. */
export function PayGroupsCard({ groups, components, policy, onChanged }: { groups: PayGroup[]; components: PayComponent[]; policy: PayrollPolicy; onChanged: () => void }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ group: PayGroup | null } | null>(null);

  async function remove(g: PayGroup) {
    const ok = await confirm({ title: `Delete “${g.name}”?`, description: "Only a group nobody was ever in, with no pay runs, can be deleted.", confirmLabel: "Delete", destructive: true });
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
            <Users className="size-4" /> Pay groups
          </CardTitle>
          <CardDescription>Who is paid when, and by which rules. Put each employee in a group on their Pay tab; anyone not put in one is in the default group.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing({ group: null })}>
          <Plus className="size-4" />
          Add group
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
                  {g.is_default && <Badge variant="info">Default</Badge>}
                  {g.auto_calculate && <Badge variant="secondary">Automatic</Badge>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {SCHEDULE_LABELS[g.schedule]} · {scheduleSummary(g)}
                  {g.current_period ? ` · now ${g.current_period.label}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g.employees_count ?? 0} {(g.employees_count ?? 0) === 1 ? "person" : "people"}
                  {own > 0 ? ` · ${own} own ${own === 1 ? "setting" : "settings"}` : " · company rules"}
                </span>
              </button>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ group: g })}>
                  Edit
                </Button>
                {!g.is_default && g.pay_runs_count === 0 && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(g)}>
                    Delete
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
