"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BadgeCheck, Banknote, Download, RefreshCw, Trash2, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PayslipDialog } from "@/components/dashboard/payroll/payslip-view";
import { RUN_STATUS, WarningList, money, monthLabel } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, type PayRunDetail, type PayslipRow } from "@/lib/api";
import { saveBlob } from "@/lib/download";
import { notifyError, notifySuccess } from "@/lib/notify";

/** What happens next, in one sentence, for each stage of the run. */
const NEXT_STEP: Record<PayRunDetail["status"], string> = {
  draft: "Calculating…",
  calculated: "Check each payslip. Fix attendance or rules and recalculate as often as needed, then approve.",
  approved: "Approved and frozen. Pay your staff, then mark the run as paid.",
  paid: "Paid. Any later fix goes into a future month as an adjustment.",
};

export default function PayRunPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const confirm = useConfirm();
  const { me } = useMe();
  const canManage = me?.permissions.includes("payroll.manage") ?? false;

  const [run, setRun] = useState<PayRunDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openSlip, setOpenSlip] = useState<number | null>(null);

  useEffect(() => {
    api.payroll.run(id).then(setRun).catch(notifyError);
  }, [id]);

  async function act(name: string, action: () => Promise<PayRunDetail>, success: string) {
    setBusy(name);
    try {
      setRun(await action());
      notifySuccess(success);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!run) return;
    const ok = await confirm({
      title: `Approve payroll for ${monthLabel(run.month)}?`,
      description: "Pay is recalculated one last time from the locked attendance, then frozen. It can't be changed afterwards — later fixes go into a future month as adjustments.",
      confirmLabel: "Approve",
    });
    if (ok) await act("approve", () => api.payroll.approve(run.id), "Payroll approved");
  }

  async function markPaid() {
    if (!run) return;
    const ok = await confirm({ title: "Mark as paid?", description: "Records that staff have been paid for this month.", confirmLabel: "Mark as paid" });
    if (ok) await act("paid", () => api.payroll.markPaid(run.id), "Marked as paid");
  }

  async function remove() {
    if (!run) return;
    const ok = await confirm({ title: "Delete this pay run?", description: "Its payslips are removed. You can start the month again at any time.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      await api.payroll.removeRun(run.id);
      router.push("/dashboard/payroll");
    } catch (err) {
      notifyError(err);
    }
  }

  async function exportCsv() {
    if (!run) return;
    setBusy("export");
    try {
      const { blob, filename } = await api.payroll.exportRun(run.id, run.month);
      saveBlob(blob, filename);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  const back = (
    <Link href="/dashboard/payroll" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      Pay runs
    </Link>
  );

  if (!run) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {back}
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const editable = run.status === "draft" || run.status === "calculated";
  const withProblems = run.payslips.filter((p) => p.warnings?.some((w) => w.blocking)).length;
  const blocked = withProblems > 0 || (run.warnings ?? []).some((w) => w.blocking);

  const columns: DataTableColumn<PayslipRow>[] = [
    {
      id: "employee",
      header: "Employee",
      primary: true,
      cell: (p) => (
        <div className="flex flex-col">
          <span className="font-medium">{p.employee?.name ?? "Removed employee"}</span>
          <span className="text-xs text-muted-foreground">{[p.employee?.employee_code, p.employee?.branch].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      ),
      searchValue: (p) => [p.employee?.name, p.employee?.employee_code, p.employee?.branch].filter(Boolean).join(" "),
      sortValue: (p) => p.employee?.name ?? "",
    },
    { id: "base", header: "Salary", hideOnMobile: true, cell: (p) => <span className="tabular-nums">{money(p.base_salary, p.currency)}{p.pay_type === "daily" ? " /day" : ""}</span> },
    { id: "gross", header: "Gross", cell: (p) => <span className="tabular-nums">{money(p.gross, p.currency)}</span>, sortValue: (p) => Number(p.gross) },
    { id: "deductions", header: "NSSF + tax", hideOnMobile: true, cell: (p) => <span className="tabular-nums text-muted-foreground">{money(Number(p.nssf_employee) + Number(p.tax), p.currency)}</span> },
    { id: "net", header: "Net pay", cell: (p) => <span className="font-semibold tabular-nums">{money(p.net, p.currency)}</span>, sortValue: (p) => Number(p.net) },
    {
      id: "check",
      header: "Check",
      cell: (p) =>
        p.warnings?.some((w) => w.blocking) ? (
          <Badge variant="warning">
            <AlertTriangle className="size-3" />
            Needs fixing
          </Badge>
        ) : p.warnings?.length ? (
          <Badge variant="info">Note</Badge>
        ) : (
          <Badge variant="success">OK</Badge>
        ),
      sortValue: (p) => (p.warnings?.some((w) => w.blocking) ? 0 : p.warnings?.length ? 1 : 2),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {back}
      <PageHeader
        title={`Payroll · ${monthLabel(run.month)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={RUN_STATUS[run.status].variant}>{RUN_STATUS[run.status].label}</Badge>
            {NEXT_STEP[run.status]}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={busy !== null || run.payslips.length === 0}>
              <Download className="size-4" />
              Export CSV
            </Button>
            {canManage && editable && (
              <>
                <Button variant="outline" onClick={() => act("calculate", () => api.payroll.calculate(run.id), "Recalculated")} disabled={busy !== null}>
                  <RefreshCw className={busy === "calculate" ? "size-4 animate-spin" : "size-4"} />
                  Recalculate
                </Button>
                <Button onClick={approve} disabled={busy !== null || blocked || run.payslips.length === 0}>
                  <BadgeCheck className="size-4" />
                  {busy === "approve" ? "Approving…" : "Approve"}
                </Button>
              </>
            )}
            {canManage && run.status === "approved" && (
              <Button onClick={markPaid} disabled={busy !== null}>
                <Banknote className="size-4" />
                Mark as paid
              </Button>
            )}
          </div>
        }
      />

      <WarningList warnings={run.warnings} />
      {withProblems > 0 && (
        <Alert variant="warning" title={`${withProblems} ${withProblems === 1 ? "payslip needs" : "payslips need"} fixing`}>
          Open the payslips marked “Needs fixing” to see why, fix the cause (usually attendance), then recalculate.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(run.totals ?? {}).flatMap(([currency, t]) => [
          <Card key={`${currency}-net`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">Net pay ({currency}) · {t.employees} {t.employees === 1 ? "person" : "people"}</p>
              <p className="text-2xl font-semibold tabular-nums">{money(t.net, currency)}</p>
            </CardContent>
          </Card>,
          <Card key={`${currency}-gross`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">Gross ({currency})</p>
              <p className="text-2xl font-semibold tabular-nums">{money(t.gross, currency)}</p>
            </CardContent>
          </Card>,
          <Card key={`${currency}-stat`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">NSSF + tax withheld ({currency})</p>
              <p className="text-2xl font-semibold tabular-nums">{money(t.nssf_employee + t.tax, currency)}</p>
            </CardContent>
          </Card>,
          <Card key={`${currency}-cost`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total cost to company ({currency})</p>
              <p className="text-2xl font-semibold tabular-nums">{money(t.employer_cost, currency)}</p>
            </CardContent>
          </Card>,
        ])}
      </div>

      <DataTable
        data={run.payslips}
        getRowId={(p) => p.id}
        columns={columns}
        onRowClick={(p) => setOpenSlip(p.id)}
        searchPlaceholder="Search employees…"
        emptyState={{ icon: Wallet, title: "No payslips", description: "Nobody has a salary for this month yet. Add salaries on each employee's Pay tab, then recalculate." }}
      />

      {canManage && editable && (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 className="size-4" />
            Delete pay run
          </Button>
        </div>
      )}

      <PayslipDialog payslipId={openSlip} onOpenChange={(o) => !o && setOpenSlip(null)} />
    </div>
  );
}
