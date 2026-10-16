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
import { RUN_STATUS, SCHEDULE_LABELS, money, scheduleSummary, today } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, type PayGroup, type PayPeriodOption, type PayRun, type PaySchedule } from "@/lib/api";
import { notifyError } from "@/lib/notify";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/** How much of a monthly salary one period of each schedule pays. */
const SHARE_HINT: Record<PaySchedule, string> = {
  monthly: "the full monthly salary.",
  semi_monthly: "half of the monthly salary.",
  weekly: "12/52 of the monthly salary (a year's pay over 52 weeks).",
  biweekly: "12/26 of the monthly salary (a year's pay over 26 fortnights).",
  custom: "the share of each month the dates cover (e.g. 10 Sep – 5 Oct ≈ 0.86 of a month).",
};

/** Net pay per currency on one line: "$12,400.00 · 3,200,000 ៛". */
function netTotals(run: PayRun): string {
  const totals = Object.entries(run.totals ?? {});
  return totals.length ? totals.map(([currency, t]) => money(t.net, currency)).join(" · ") : "—";
}

function NewRunDialog({ groups, onOpenChange }: { groups: PayGroup[]; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
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
      setError(err instanceof ApiError ? err.message : "Couldn't start the pay run.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New pay run</DialogTitle>
            <DialogDescription>
              Works out the pay of everyone in a pay group for one period, from their salary, attendance and the group&apos;s rules. You can review and recalculate before approving.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-group">Pay group</Label>
            <select id="run-group" className={SELECT_CLASS} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {SCHEDULE_LABELS[g.schedule]}
                </option>
              ))}
            </select>
            {group && (
              <p className="text-xs text-muted-foreground">
                {scheduleSummary(group)} · {group.employees_count ?? 0} {(group.employees_count ?? 0) === 1 ? "person" : "people"} in this group now
              </p>
            )}
            {group && (group.employees_count ?? 0) === 0 && (
              <Alert variant="warning">
                Nobody is in {group.name} yet, so this run would have no payslips. Put employees in it first: open each employee → Pay tab → Change group.
              </Alert>
            )}
          </div>

          {custom ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run-start">From</Label>
                <Input id="run-start" type="date" value={start} max={today()} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="run-end">To</Label>
                <Input id="run-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="run-period">Period</Label>
              <select id="run-period" className={SELECT_CLASS} value={start} onChange={(e) => setStart(e.target.value)} disabled={periods === null}>
                {periods === null && <option>Loading…</option>}
                {periods?.map((p) => (
                  <option key={p.start} value={p.start} disabled={!!p.run}>
                    {p.label}
                    {p.run ? ` — ${RUN_STATUS[p.run.status].label.toLowerCase()}` : p.end >= today() ? " — not over yet" : ""}
                  </option>
                ))}
              </select>
              {chosen && chosen.end >= today() && <p className="text-xs text-warning">This period isn&apos;t over yet: the numbers are a preview until it is.</p>}
            </div>
          )}

          {group && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <b className="text-foreground">What this run pays:</b> {SHARE_HINT[group.schedule]} Daily-paid staff get the days they worked. Absence, unpaid leave, lateness and overtime come from
              attendance inside the period
              {group.schedule === "monthly" && (group.cutoff_days?.[0] ?? 31) >= 31 ? "." : ". Tax and NSSF are not included for this kind of period yet."}
            </p>
          )}

          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !group || !start || (custom && !end)}>
              {saving ? "Calculating…" : "Calculate pay"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PayRunsPage() {
  const router = useRouter();
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
      header: "Period",
      primary: true,
      cell: (r) => <span className="font-medium">{r.period_label}</span>,
      sortValue: (r) => r.period_end,
      searchValue: (r) => `${r.period_label} ${r.pay_group?.name ?? ""}`,
    },
    { id: "group", header: "Pay group", cell: (r) => <span>{r.pay_group?.name ?? "—"}</span>, sortValue: (r) => r.pay_group?.name ?? "" },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Badge variant={RUN_STATUS[r.status].variant}>{RUN_STATUS[r.status].label}</Badge>,
      sortValue: (r) => r.status,
    },
    {
      id: "employees",
      header: "Employees",
      cell: (r) => <span className="tabular-nums">{Object.values(r.totals ?? {}).reduce((n, t) => n + t.employees, 0)}</span>,
    },
    { id: "net", header: "Net pay", cell: (r) => <span className="tabular-nums">{netTotals(r)}</span> },
    {
      id: "by",
      header: "Approved",
      hideOnMobile: true,
      cell: (r) => <span className="text-muted-foreground">{r.approved_by ? `${r.approved_by.name} · ${new Date(r.approved_at!).toLocaleDateString()}` : "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Pay runs"
        description="One run per pay group and period: calculate, review every payslip, then approve and pay."
        action={
          <div className="flex flex-wrap gap-2">
            <PayrollGuideButton topic="run" />
            {canManage && (
              <Button onClick={() => setCreating(true)} disabled={groups.length === 0}>
                <Plus className="size-4" />
                New pay run
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
          <Label htmlFor="runs-group">Pay group</Label>
          <select id="runs-group" className={SELECT_CLASS} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">All groups</option>
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
        searchPlaceholder="Search periods…"
        emptyState={{
          icon: Wallet,
          title: "No pay runs yet",
          description: "Set up salaries on each employee's Pay tab and check Payroll Settings (pay groups and rules), then start your first pay run.",
        }}
      />
      {creating && <NewRunDialog groups={groups} onOpenChange={setCreating} />}
    </div>
  );
}
