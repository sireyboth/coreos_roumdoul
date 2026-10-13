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
import { RUN_STATUS, currentMonth, money, monthLabel, previousMonth } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, type PayRun } from "@/lib/api";
import { notifyError } from "@/lib/notify";

/** Net pay per currency on one line: "$12,400.00 · 3,200,000 ៛". */
function netTotals(run: PayRun): string {
  const totals = Object.entries(run.totals ?? {});
  return totals.length ? totals.map(([currency, t]) => money(t.net, currency)).join(" · ") : "—";
}

function NewRunDialog({ open, onOpenChange, existing }: { open: boolean; onOpenChange: (o: boolean) => void; existing: string[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(previousMonth);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const taken = existing.includes(month);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const run = await api.payroll.createRun(month);
      router.push(`/dashboard/payroll/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the pay run.");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New pay run</DialogTitle>
            <DialogDescription>
              Works out everyone&apos;s pay for the month from their salary, attendance and your payroll rules. You can review and recalculate before approving.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-month">Month</Label>
            <Input id="run-month" type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} required />
            {taken && <p className="text-xs text-destructive">There is already a pay run for {monthLabel(month)}.</p>}
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !month || taken}>
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
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.payroll.runs().then(setRuns).catch((err) => {
      notifyError(err);
      setRuns([]);
    });
  }, []);

  const columns: DataTableColumn<PayRun>[] = [
    { id: "month", header: "Month", primary: true, cell: (r) => <span className="font-medium">{monthLabel(r.month)}</span>, sortValue: (r) => r.month, searchValue: (r) => monthLabel(r.month) },
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
        description="One run per month: calculate, review every payslip, then approve and pay."
        action={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New pay run
            </Button>
          )
        }
      />
      <DataTable
        data={runs}
        getRowId={(r) => r.id}
        columns={columns}
        onRowClick={(r) => router.push(`/dashboard/payroll/runs/${r.id}`)}
        searchPlaceholder="Search months…"
        emptyState={{
          icon: Wallet,
          title: "No pay runs yet",
          description: "Set up salaries on each employee's Pay tab and check Payroll Settings, then start your first pay run.",
        }}
      />
      {creating && <NewRunDialog open onOpenChange={setCreating} existing={(runs ?? []).map((r) => r.month)} />}
    </div>
  );
}
