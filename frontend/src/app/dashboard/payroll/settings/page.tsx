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
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { ComponentDialog } from "@/components/dashboard/payroll/component-dialog";
import { PayGroupsCard } from "@/components/dashboard/payroll/pay-groups";
import { PayrollGuideButton } from "@/components/dashboard/payroll/payroll-guide";
import { ruleSummary } from "@/components/dashboard/payroll/shared";
import { api, type PayComponent, type PayGroup, type PayrollPolicy, type PayrollSettings } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useLang, useT } from "@/lib/i18n";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

function PolicyCard({ policy, onSaved }: { policy: PayrollPolicy; onSaved: (p: PayrollPolicy) => void }) {
  const t = useT();
  const [form, setForm] = useState(policy);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<PayrollPolicy>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      onSaved(await api.payroll.updatePolicy({ ...form, fallback_exchange_rate: form.fallback_exchange_rate || null }));
      notifySuccess(t("payroll.settings.policy.saved"));
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("payroll.settings.policy.title")}</CardTitle>
        <CardDescription>{t("payroll.settings.policy.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-basis">{t("payroll.settings.policy.dailyRate")}</Label>
            <select id="pol-basis" className={SELECT_CLASS} value={form.rate_basis} onChange={(e) => set({ rate_basis: e.target.value as PayrollPolicy["rate_basis"] })}>
              <option value="fixed">{t("payroll.settings.policy.basisFixed")}</option>
              <option value="calendar">{t("payroll.settings.policy.basisCalendar")}</option>
              <option value="scheduled">{t("payroll.settings.policy.basisScheduled")}</option>
            </select>
          </div>
          {form.rate_basis === "fixed" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-days">{t("payroll.settings.policy.days")}</Label>
              <Input id="pol-days" type="number" min={1} max={31} value={form.rate_basis_days} onChange={(e) => set({ rate_basis_days: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">{t("payroll.settings.policy.daysHint")}</p>
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-hours">{t("payroll.settings.policy.hours")}</Label>
            <Input id="pol-hours" type="number" min={1} max={24} step="0.5" value={form.hours_per_day} onChange={(e) => set({ hours_per_day: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">{t("payroll.settings.policy.hoursHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-missing">{t("payroll.settings.policy.missing")}</Label>
            <select id="pol-missing" className={SELECT_CLASS} value={form.missing_scan_policy} onChange={(e) => set({ missing_scan_policy: e.target.value as PayrollPolicy["missing_scan_policy"] })}>
              <option value="review">{t("payroll.settings.policy.missingReview")}</option>
              <option value="present">{t("payroll.settings.policy.missingPresent")}</option>
              <option value="absent">{t("payroll.settings.policy.missingAbsent")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-rate">{t("payroll.settings.policy.rate")}</Label>
            <Input
              id="pol-rate"
              type="number"
              min={1000}
              max={10000}
              placeholder={t("payroll.settings.policy.ratePlaceholder")}
              value={form.fallback_exchange_rate ?? ""}
              onChange={(e) => set({ fallback_exchange_rate: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">{t("payroll.settings.policy.rateHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-round">{t("payroll.settings.policy.rounding")}</Label>
            <select id="pol-round" className={SELECT_CLASS} value={form.khr_rounding} onChange={(e) => set({ khr_rounding: Number(e.target.value) })}>
              <option value={1}>{t("payroll.settings.policy.roundExact")}</option>
              <option value={100}>{t("payroll.settings.policy.round100")}</option>
              <option value={500}>{t("payroll.settings.policy.round500")}</option>
              <option value={1000}>{t("payroll.settings.policy.round1000")}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.daily_paid_holidays} onChange={(e) => set({ daily_paid_holidays: e.target.checked })} />
            {t("payroll.settings.policy.holidays")}
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enforce_overtime_minimums} onChange={(e) => set({ enforce_overtime_minimums: e.target.checked })} />
              {t("payroll.settings.policy.overtimeMinimums")}
            </label>
            {!form.enforce_overtime_minimums && (
              <Alert variant="warning">{t("payroll.settings.policy.overtimeWarning")}</Alert>
            )}
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? t("common.message.saving") : t("payroll.settings.policy.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PayrollSettingsPage() {
  const confirm = useConfirm();
  const t = useT();
  const lang = useLang();
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
      title: t("payroll.settings.applyTitle", { name }),
      description: t("payroll.settings.applyText"),
      confirmLabel: t("payroll.settings.applyConfirm"),
    });
    if (!ok) return;
    try {
      setSettings(await api.payroll.applyPreset(key));
      notifySuccess(t("payroll.settings.applied"), name);
    } catch (err) {
      notifyError(err);
    }
  }

  async function remove(c: PayComponent) {
    const ok = await confirm({
      title: t("payroll.settings.deleteTitle", { name: c.name }),
      description: t("payroll.settings.deleteText"),
      confirmLabel: t("common.action.delete"),
      destructive: true,
    });
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
      header: t("payroll.settings.colComponent"),
      primary: true,
      cell: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">{c.code}{c.is_system ? ` · ${t("payroll.settings.builtIn")}` : ""}</span>
        </div>
      ),
      sortValue: (c) => c.sort_order,
      searchValue: (c) => `${c.name} ${c.code}`,
    },
    { id: "kind", header: t("common.field.type"), cell: (c) => <Badge variant={c.kind === "earning" ? "success" : "secondary"}>{t(`payroll.shared.kind.${c.kind}`)}</Badge>, sortValue: (c) => c.kind },
    { id: "rule", header: t("payroll.settings.colRule"), fullWidthOnMobile: true, cell: (c) => <span className="text-muted-foreground">{ruleSummary(c, lang)}</span> },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (c) => <Badge variant={c.is_active ? "success" : "secondary"}>{c.is_active ? t("common.status.active") : t("payroll.settings.off")}</Badge>,
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
            {t("common.action.delete")}
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("payroll.settings.title")}
        description={t("payroll.settings.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <PayrollGuideButton topic="groups" />
            <Button onClick={() => setEditing({ component: null })}>
              <Plus className="size-4" />
              {t("payroll.settings.addComponent")}
            </Button>
          </div>
        }
      />

      <Alert variant="info" title={t("payroll.settings.lawTitle")}>
        {t("payroll.settings.lawText")}
      </Alert>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> {t("payroll.settings.presetTitle")}
            </CardTitle>
            <CardDescription>{t("payroll.settings.presetText")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {settings.presets.map((p) => (
              <div key={p.key} className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                <Button variant="outline" size="sm" className="self-start" onClick={() => applyPreset(p.key, p.name)}>
                  {t("payroll.settings.apply")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {settings && groups && <PayGroupsCard groups={groups} components={settings.components} policy={settings.policy} onChanged={() => setReloads((n) => n + 1)} />}

      {settings && <PolicyCard key={JSON.stringify(settings.policy)} policy={settings.policy} onSaved={(policy) => setSettings((s) => (s ? { ...s, policy } : s))} />}

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("payroll.settings.componentsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("payroll.settings.componentsText")}</p>
      </div>
      <DataTable
        data={settings?.components ?? null}
        getRowId={(c) => c.id}
        columns={columns}
        onRowClick={(c) => setEditing({ component: c })}
        searchPlaceholder={t("payroll.settings.search")}
        emptyState={{ icon: SlidersHorizontal, title: t("payroll.settings.emptyTitle"), description: t("payroll.settings.emptyText") }}
      />

      {editing && (
        <ComponentDialog
          key={editing.component?.id ?? "new"}
          component={editing.component}
          enforceOvertimeMinimums={settings?.policy.enforce_overtime_minimums ?? true}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={() => setReloads((n) => n + 1)}
        />
      )}
    </div>
  );
}
