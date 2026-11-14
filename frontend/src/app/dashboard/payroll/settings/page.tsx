"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/dashboard/layout/page-header";
import { ComponentDialog } from "@/components/dashboard/payroll/component-dialog";
import { PayGroupsCard } from "@/components/dashboard/payroll/pay-groups";
import { PayrollGuideButton, type GuideTopic } from "@/components/dashboard/payroll/payroll-guide";
import { PolicyForm } from "@/components/dashboard/payroll/policy-form";
import { PillTabs, type PillTab } from "@/components/dashboard/shared/pill-tabs";
import { ruleSummary } from "@/components/dashboard/payroll/shared";
import { api, type PayComponent, type PayGroup, type PayrollSettings } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Icon colours for the preset cards, in order. */
const PRESET_TONES = ["from-amber-400 to-orange-500", "from-sky-500 to-indigo-500", "from-emerald-500 to-teal-500", "from-rose-500 to-pink-500"];

type Tab = "start" | "groups" | "rules" | "components";

/** Which guide topic the Guide button opens on, per tab. */
const GUIDE_TOPIC: Record<Tab, GuideTopic> = { start: "start", groups: "groups", rules: "salary", components: "salary" };

export default function PayrollSettingsPage() {
  const confirm = useConfirm();
  const t = useT();
  const lang = useLang();
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [groups, setGroups] = useState<PayGroup[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [editing, setEditing] = useState<{ component: PayComponent | null } | null>(null);
  const [tab, setTab] = useState<Tab>("start");
  // A failed load shows a message instead of a loading skeleton that never ends.
  const [loadFailed, setLoadFailed] = useState(false);

  const tabs: PillTab<Tab>[] = [
    { id: "start", label: t("payroll.settings.tabs.start"), icon: Sparkles },
    { id: "groups", label: t("payroll.settings.tabs.groups"), icon: Users },
    { id: "rules", label: t("payroll.settings.tabs.rules"), icon: Calculator },
    { id: "components", label: t("payroll.settings.tabs.components"), icon: SlidersHorizontal },
  ];

  useEffect(() => {
    const failed = (err: unknown) => {
      notifyError(err);
      setLoadFailed(true);
    };
    api.payroll.settings().then(setSettings).catch(failed);
    api.payroll.groups().then(setGroups).catch(failed);
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
        action={<PayrollGuideButton topic={GUIDE_TOPIC[tab]} />}
      />

      {/* One tab per job, so each screen answers one question. */}
      <PillTabs tabs={tabs} value={tab} onChange={setTab} />

      {!settings || (tab === "groups" && !groups) ? (
        loadFailed ? (
          <Alert variant="destructive">{t("common.message.loadFailed")}</Alert>
        ) : (
          <Skeleton className="h-64 w-full rounded-xl" />
        )
      ) : tab === "rules" ? null : tab === "start" ? (
        <div className="flex flex-col gap-4">
          <Alert variant="info" title={t("payroll.settings.lawTitle")}>
            {t("payroll.settings.lawText")}
          </Alert>
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-amber-500" /> {t("payroll.settings.presetTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("payroll.settings.presetText")}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {settings.presets.map((p, i) => (
              <Card key={p.key} className="justify-between gap-4 px-5 py-5">
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm", PRESET_TONES[i % PRESET_TONES.length])}>
                    <Sparkles className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                </div>
                <Button variant="outline" className="self-start" onClick={() => applyPreset(p.key, p.name)}>
                  {t("payroll.settings.apply")}
                </Button>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("payroll.settings.nextStepBefore")}{" "}
            <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setTab("groups")}>
              {t("payroll.settings.tabs.groups")}
            </button>{" "}
            {t("payroll.settings.nextStepAfter")}
          </p>
        </div>
      ) : tab === "groups" && groups ? (
        <PayGroupsCard groups={groups} components={settings.components} policy={settings.policy} onChanged={() => setReloads((n) => n + 1)} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("payroll.settings.componentsTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("payroll.settings.componentsText")}</p>
            </div>
            <Button onClick={() => setEditing({ component: null })}>
              <Plus className="size-4" />
              {t("payroll.settings.addComponent")}
            </Button>
          </div>
          <DataTable
            data={settings.components}
            getRowId={(c) => c.id}
            columns={columns}
            onRowClick={(c) => setEditing({ component: c })}
            searchPlaceholder={t("payroll.settings.search")}
            emptyState={{ icon: SlidersHorizontal, title: t("payroll.settings.emptyTitle"), description: t("payroll.settings.emptyText") }}
          />
        </div>
      )}

      {/* Pay rules stays mounted while hidden, so unsaved edits survive a look at another tab. */}
      {settings && (
        <div hidden={tab !== "rules"}>
          <PolicyForm
            key={JSON.stringify(settings.policy)}
            policy={settings.policy}
            onSaved={(policy) => setSettings((s) => (s ? { ...s, policy } : s))}
            onEditOvertime={(() => {
              const overtime = settings.components.find((c) => c.code === "OVERTIME");
              return overtime ? () => setEditing({ component: overtime }) : undefined;
            })()}
          />
        </div>
      )}

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
