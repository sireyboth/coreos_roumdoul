"use client";

import { useEffect, useState } from "react";
import { Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { ComponentDialog } from "@/components/dashboard/payroll/component-dialog";
import { PayGroupsCard } from "@/components/dashboard/payroll/pay-groups";
import { PayrollGuideButton } from "@/components/dashboard/payroll/payroll-guide";
import { KIND_LABELS, ruleSummary } from "@/components/dashboard/payroll/shared";
import { api, type PayComponent, type PayGroup, type PayrollPolicy, type PayrollSettings } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function PolicyCard({ policy, onSaved }: { policy: PayrollPolicy; onSaved: (p: PayrollPolicy) => void }) {
  const [form, setForm] = useState(policy);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<PayrollPolicy>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      onSaved(await api.payroll.updatePolicy({ ...form, fallback_exchange_rate: form.fallback_exchange_rate || null }));
      notifySuccess("Payroll settings saved");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>How pay is worked out</CardTitle>
        <CardDescription>Day and hour rates, missing scans and rounding, for every pay group that doesn&apos;t set its own. Changes apply the next time a pay run is calculated.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-basis">Daily rate</Label>
            <select id="pol-basis" className={SELECT_CLASS} value={form.rate_basis} onChange={(e) => set({ rate_basis: e.target.value as PayrollPolicy["rate_basis"] })}>
              <option value="fixed">Monthly salary ÷ a fixed number of days</option>
              <option value="calendar">Monthly salary ÷ days in the month</option>
              <option value="scheduled">Monthly salary ÷ the person&apos;s scheduled work days</option>
            </select>
          </div>
          {form.rate_basis === "fixed" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-days">Days in a month</Label>
              <Input id="pol-days" type="number" min={1} max={31} value={form.rate_basis_days} onChange={(e) => set({ rate_basis_days: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">26 is the most common in Cambodia.</p>
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-hours">Hours in a work day</Label>
            <Input id="pol-hours" type="number" min={1} max={24} step="0.5" value={form.hours_per_day} onChange={(e) => set({ hours_per_day: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Hourly rate = daily rate ÷ these hours (used for overtime and lateness).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-missing">A day with a missing scan</Label>
            <select id="pol-missing" className={SELECT_CLASS} value={form.missing_scan_policy} onChange={(e) => set({ missing_scan_policy: e.target.value as PayrollPolicy["missing_scan_policy"] })}>
              <option value="review">Must be fixed before approving (recommended)</option>
              <option value="present">Counts as worked</option>
              <option value="absent">Counts as absent</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-rate">Fallback exchange rate (KHR per USD)</Label>
            <Input
              id="pol-rate"
              type="number"
              min={1000}
              max={10000}
              placeholder="e.g. 4100"
              value={form.fallback_exchange_rate ?? ""}
              onChange={(e) => set({ fallback_exchange_rate: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Tax and NSSF on dollar salaries use the official monthly rate; this is used only when it isn&apos;t published yet.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-round">Round riel net pay to</Label>
            <select id="pol-round" className={SELECT_CLASS} value={form.khr_rounding} onChange={(e) => set({ khr_rounding: Number(e.target.value) })}>
              <option value={1}>The exact riel</option>
              <option value={100}>Nearest 100 ៛</option>
              <option value={500}>Nearest 500 ៛</option>
              <option value={1000}>Nearest 1,000 ៛</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.daily_paid_holidays} onChange={(e) => set({ daily_paid_holidays: e.target.checked })} />
            Pay daily-paid staff for public holidays
          </label>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PayrollSettingsPage() {
  const confirm = useConfirm();
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [groups, setGroups] = useState<PayGroup[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [editing, setEditing] = useState<{ component: PayComponent | null } | null>(null);

  useEffect(() => {
    api.payroll.settings().then(setSettings).catch(notifyError);
    api.payroll.groups().then(setGroups).catch(notifyError);
  }, [reloads]);

  async function applyPreset(key: string, name: string) {
    const ok = await confirm({
      title: `Apply “${name}”?`,
      description: "Sets the daily rate, lateness, early leave, absence and overtime rules to this preset. Your allowances and amounts stay as they are.",
      confirmLabel: "Apply preset",
    });
    if (!ok) return;
    try {
      setSettings(await api.payroll.applyPreset(key));
      notifySuccess("Preset applied", name);
    } catch (err) {
      notifyError(err);
    }
  }

  async function remove(c: PayComponent) {
    const ok = await confirm({ title: `Delete “${c.name}”?`, description: "It disappears from future pay runs. Approved payslips keep it.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await api.payroll.removeComponent(c.id);
      setReloads((n) => n + 1);
    } catch (err) {
      notifyError(err);
    }
  }

  const columns: DataTableColumn<PayComponent>[] = [
    {
      id: "name",
      header: "Component",
      primary: true,
      cell: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">{c.code}{c.is_system ? " · built-in" : ""}</span>
        </div>
      ),
      sortValue: (c) => c.sort_order,
      searchValue: (c) => `${c.name} ${c.code}`,
    },
    { id: "kind", header: "Type", cell: (c) => <Badge variant={c.kind === "earning" ? "success" : "secondary"}>{KIND_LABELS[c.kind]}</Badge>, sortValue: (c) => c.kind },
    { id: "rule", header: "Rule", fullWidthOnMobile: true, cell: (c) => <span className="text-muted-foreground">{ruleSummary(c)}</span> },
    {
      id: "status",
      header: "Status",
      cell: (c) => <Badge variant={c.is_active ? "success" : "secondary"}>{c.is_active ? "Active" : "Off"}</Badge>,
      sortValue: (c) => (c.is_active ? 0 : 1),
    },
    {
      id: "actions",
      header: "",
      hideOnMobile: true,
      cell: (c) =>
        !c.is_system && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              remove(c);
            }}
          >
            Delete
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Payroll settings"
        description="Your company's pay rules. Every rule can be tried on a real employee before you save it."
        action={
          <div className="flex flex-wrap gap-2">
            <PayrollGuideButton topic="groups" />
            <Button onClick={() => setEditing({ component: null })}>
              <Plus className="size-4" />
              Add component
            </Button>
          </div>
        }
      />

      <Alert variant="info" title="Tax on salary and NSSF are set by law">
        Their rates are kept up to date by the platform and can&apos;t be changed here. Each employee&apos;s dependents and NSSF enrolment are on their Pay tab.
      </Alert>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> Start from a preset
            </CardTitle>
            <CardDescription>Sets sensible rules in one click. You can fine-tune everything afterwards.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {settings.presets.map((p) => (
              <div key={p.key} className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                <Button variant="outline" size="sm" className="self-start" onClick={() => applyPreset(p.key, p.name)}>
                  Apply
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {settings && groups && <PayGroupsCard groups={groups} components={settings.components} policy={settings.policy} onChanged={() => setReloads((n) => n + 1)} />}

      {settings && <PolicyCard key={JSON.stringify(settings.policy)} policy={settings.policy} onSaved={(policy) => setSettings((s) => (s ? { ...s, policy } : s))} />}

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Pay components</h2>
        <p className="text-sm text-muted-foreground">Every line a payslip can have. Click one to change its rule.</p>
      </div>
      <DataTable
        data={settings?.components ?? null}
        getRowId={(c) => c.id}
        columns={columns}
        onRowClick={(c) => setEditing({ component: c })}
        searchPlaceholder="Search components…"
        emptyState={{ icon: SlidersHorizontal, title: "No components", description: "Add allowances and deductions your company uses." }}
      />

      {editing && (
        <ComponentDialog
          key={editing.component?.id ?? "new"}
          component={editing.component}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => setReloads((n) => n + 1)}
        />
      )}
    </div>
  );
}
