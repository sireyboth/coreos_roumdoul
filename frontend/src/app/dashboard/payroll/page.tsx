"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { GettingStartedCard, PayrollGuideButton } from "@/components/dashboard/payroll/payroll-guide";
import { RUN_STATUS, money, scheduleSummary, today } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, type PayGroup, type PayPeriodOption, type PayRun } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import { dateLocale, useLang, useT } from "@/lib/i18n";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";


/** Net pay per currency on one line: "$12,400.00 · 3,200,000 ៛". */
function netTotals(run: PayRun): string {
  const totals = Object.entries(run.totals ?? {});
  return totals.length ? totals.map(([currency, t]) => money(t.net, currency)).join(" · ") : "—";
}

function NewRunDialog({ groups, onOpenChange }: { groups: PayGroup[]; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const [groupId, setGroupId] = useState(() => String(groups.find((g) => g.is_default)?.id ?? groups[0]?.id ?? ""));
  const group = groups.find((g) => String(g.id) === groupId) ?? null;
  // The periods loaded for one group; a custom group picks dates instead.
  const [loaded, setLoaded] = useState<{ groupId: number; list: PayPeriodOption[] } | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const custom = group?.schedule === "custom";
  const periods = custom ? [] : loaded && loaded.groupId === group?.id ? loaded.list : null;

  useEffect(() => {
    if (!group || group.schedule === "custom") return;
    let cancelled = false;
    api.payroll
      .groupPeriods(group.id)
      .then((list) => {
        if (cancelled) return;
        setLoaded({ groupId: group.id, list });
        // The newest period that is over and has no run yet; else the newest without a run.
        const open = list.filter((p) => !p.run);
        setStart((open.find((p) => p.end < today()) ?? open[0])?.start ?? "");
      })
      .catch((err) => {
        notifyError(err);
        if (!cancelled) setLoaded({ groupId: group.id, list: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [group]);

  const chosen = periods?.find((p) => p.start === start) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!group) return;
    setSaving(true);
    setError(null);
    try {
      const run = await api.payroll.createRun({ pay_group_id: group.id, period_start: start, period_end: custom ? end : null });
      router.push(`/dashboard/payroll/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("payroll.runs.dialog.failed"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("payroll.runs.newRun")}</DialogTitle>
            <DialogDescription>{t("payroll.runs.dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-group">{t("payroll.runs.payGroup")}</Label>
            <select id="run-group" className={SELECT_CLASS} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {t(`payroll.shared.schedule.${g.schedule}`)}
                </option>
              ))}
            </select>
            {group && (
              <p className="text-xs text-muted-foreground">
                {t((group.employees_count ?? 0) === 1 ? "payroll.runs.dialog.peopleOne" : "payroll.runs.dialog.peopleOther", {
                  summary: scheduleSummary(group, lang),
                  n: group.employees_count ?? 0,
                })}
              </p>
            )}
            {group && (group.employees_count ?? 0) === 0 && (
              <Alert variant="warning">{t("payroll.runs.dialog.emptyGroup", { group: group.name })}</Alert>
            )}
          </div>

          {custom ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run-start">{t("common.field.from")}</Label>
                <Input id="run-start" type="date" value={start} max={today()} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run-end">{t("common.field.to")}</Label>
                <Input id="run-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="run-period">{t("payroll.runs.dialog.period")}</Label>
              <select id="run-period" className={SELECT_CLASS} value={start} onChange={(e) => setStart(e.target.value)} disabled={periods === null}>
                {periods === null && <option>{t("common.message.loading")}</option>}
                {periods?.map((p) => (
                  <option key={p.start} value={p.start} disabled={!!p.run}>
                    {p.label}
                    {p.run ? ` — ${t(RUN_STATUS[p.run.status].labelKey).toLowerCase()}` : p.end >= today() ? ` — ${t("payroll.runs.dialog.notOver")}` : ""}
                  </option>
                ))}
              </select>
              {chosen && chosen.end >= today() && <p className="text-xs text-warning">{t("payroll.runs.dialog.notOverWarning")}</p>}
            </div>
          )}

          {group && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <b className="text-foreground">{t("payroll.runs.dialog.whatItPays")}</b> {t(`payroll.runs.share.${group.schedule}`)} {t("payroll.runs.dialog.dailyPaid")}
              {group.schedule === "monthly" && (group.cutoff_days?.[0] ?? 31) >= 31 ? "" : ` ${t("payroll.runs.dialog.noTax")}`}
            </p>
          )}

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving || !group || !start || (custom && !end)}>
              {saving ? t("payroll.runs.dialog.calculating") : t("payroll.runs.dialog.calculate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PayRunsPage() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const { me } = useMe();
  const canManage = me?.permissions.includes("payroll.manage") ?? false;
  const [runs, setRuns] = useState<PayRun[] | null>(null);
  const [groups, setGroups] = useState<PayGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.payroll.runs().then(setRuns).catch((err) => {
      notifyError(err);
      setRuns([]);
    });
    api.payroll.groups().then(setGroups).catch(() => setGroups([]));
  }, []);

  const shown = runs && groupFilter ? runs.filter((r) => String(r.pay_group?.id) === groupFilter) : runs;

  const columns: DataTableColumn<PayRun>[] = [
    {
      id: "period",
      header: t("payroll.runs.colPeriod"),
      primary: true,
      cell: (r) => <span className="font-medium">{r.period_label}</span>,
      sortValue: (r) => r.period_end,
      searchValue: (r) => `${r.period_label} ${r.pay_group?.name ?? ""}`,
    },
    { id: "group", header: t("payroll.runs.payGroup"), cell: (r) => <span>{r.pay_group?.name ?? "—"}</span>, sortValue: (r) => r.pay_group?.name ?? "" },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (r) => <Badge variant={RUN_STATUS[r.status].variant}>{t(RUN_STATUS[r.status].labelKey)}</Badge>,
      sortValue: (r) => r.status,
    },
    {
      id: "employees",
      header: t("payroll.runs.colEmployees"),
      cell: (r) => <span className="tabular-nums">{Object.values(r.totals ?? {}).reduce((n, t) => n + t.employees, 0)}</span>,
    },
    { id: "net", header: t("payroll.runs.colNet"), cell: (r) => <span className="tabular-nums">{netTotals(r)}</span> },
    {
      id: "by",
      header: t("payroll.runs.colApproved"),
      hideOnMobile: true,
      cell: (r) => <span className="text-muted-foreground">{r.approved_by ? `${r.approved_by.name} · ${new Date(r.approved_at!).toLocaleDateString(dateLocale(lang))}` : "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("payroll.runs.title")}
        description={t("payroll.runs.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <PayrollGuideButton topic="run" />
            {canManage && (
              <Button onClick={() => setCreating(true)} disabled={groups.length === 0}>
                <Plus className="size-4" />
                {t("payroll.runs.newRun")}
              </Button>
            )}
          </div>
        }
      />
      {canManage && runs !== null && (
        <GettingStartedCard groupsCount={groups.length} hasRuns={runs.length > 0} hasApprovedRun={runs.some((r) => r.status === "approved" || r.status === "paid")} />
      )}
      {groups.length > 1 && (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="runs-group">{t("payroll.runs.payGroup")}</Label>
          <select id="runs-group" className={SELECT_CLASS} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">{t("payroll.runs.allGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <DataTable
        data={shown}
        getRowId={(r) => r.id}
        columns={columns}
        onRowClick={(r) => router.push(`/dashboard/payroll/runs/${r.id}`)}
        searchPlaceholder={t("payroll.runs.search")}
        emptyState={{
          icon: Wallet,
          title: t("payroll.runs.emptyTitle"),
          description: t("payroll.runs.emptyText"),
        }}
      />
      {creating && <NewRunDialog groups={groups} onOpenChange={setCreating} />}
    </div>
  );
}
