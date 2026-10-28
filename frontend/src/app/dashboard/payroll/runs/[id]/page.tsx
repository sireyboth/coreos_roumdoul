"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, BadgeCheck, Banknote, Building2, ChartColumnBig, ChevronDown, Download, FileText, Landmark, RefreshCw, Sheet, Trash2, Undo2, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PayrollGuideButton } from "@/components/dashboard/payroll/payroll-guide";
import { PayslipDialog } from "@/components/dashboard/payroll/payslip-view";
import { BankExportDialog } from "@/components/dashboard/payroll/bank-export-dialog";
import { RUN_STATUS, WarningList, money } from "@/components/dashboard/payroll/shared";
import { useMe } from "@/contexts/me-context";
import { api, type PayRunDetail, type PayslipRow } from "@/lib/api";
import { withBusy } from "@/lib/busy";
import { saveBlob } from "@/lib/download";
import { printPayrollPdf } from "@/lib/payroll-pdf";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";


export default function PayRunPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const confirm = useConfirm();
  const t = useT();
  const { me } = useMe();
  const canManage = me?.permissions.includes("payroll.manage") ?? false;
  // Its own permission: HR can prepare runs while only a manager approves them.
  const canApprove = me?.permissions.includes("payroll.approve") ?? false;

  const [run, setRun] = useState<PayRunDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openSlip, setOpenSlip] = useState<number | null>(null);
  const [reopening, setReopening] = useState(false);
  const [bankExport, setBankExport] = useState(false);

  useEffect(() => {
    api.payroll.run(id).then(setRun).catch(notifyError);
  }, [id]);

  async function act(name: string, action: () => Promise<PayRunDetail>, success: string) {
    setBusy(name);
    try {
      setRun(await action());
      notifySuccess(success);
      return true;
    } catch (err) {
      notifyError(err);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!run) return;
    const ok = await confirm({
      title: t("payroll.run.approveTitle", { group: run.pay_group?.name ?? t("payroll.run.payroll"), period: run.period_label }),
      description: t("payroll.run.approveText"),
      confirmLabel: t("common.action.approve"),
    });
    if (ok) await act("approve", () => api.payroll.approve(run.id), t("payroll.run.approved"));
  }

  async function markPaid() {
    if (!run) return;
    const ok = await confirm({ title: t("payroll.run.paidTitle"), description: t("payroll.run.paidText"), confirmLabel: t("payroll.run.markPaid") });
    if (ok) await act("paid", () => api.payroll.markPaid(run.id), t("payroll.run.marked"));
  }

  async function reopen(reason: string) {
    if (!run) return false;
    const ok = await act("reopen", () => api.payroll.reopen(run.id, reason), t("payroll.run.reopened"));
    if (ok) setReopening(false);
    return ok;
  }

  async function remove() {
    if (!run) return;
    const ok = await confirm({ title: t("payroll.run.deleteTitle"), description: t("payroll.run.deleteText"), confirmLabel: t("common.action.delete"), destructive: true });
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
      const { blob, filename } = await withBusy(() => api.payroll.exportRun(run.id, run.filename));
      saveBlob(blob, filename);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  /** The printed report; "Save as PDF" in the print dialog makes the file. */
  async function exportPdf(includePayments: boolean) {
    if (!run) return;
    setBusy("export");
    try {
      const report = await withBusy(() => api.payroll.runReport(run.id));
      await printPayrollPdf({ company: me?.company?.name ?? "Business OS", generatedBy: me?.user.name, report, includePayments });
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  }

  const back = (
    <Link href="/dashboard/payroll" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("payroll.run.back")}
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
  const blocked = run.is_stale || withProblems > 0 || (run.warnings ?? []).some((w) => w.blocking);
  const staleNames = run.payslips.filter((p) => run.stale_employee_ids.includes(p.employee?.id ?? -1)).map((p) => p.employee?.name ?? t("payroll.run.someone"));

  /** Only the people whose inputs changed — or everyone, when something shared changed. */
  async function recalculateStale() {
    if (!run) return;
    if (run.stale_everyone || run.stale_employee_ids.length > 20) {
      await act("calculate", () => api.payroll.calculate(run.id), t("payroll.run.recalculated"));
      return;
    }
    await act(
      "calculate",
      async () => {
        let latest = run;
        for (const employeeId of run.stale_employee_ids) latest = await api.payroll.calculateEmployee(run.id, employeeId);
        return latest;
      },
      t("payroll.run.recalculated"),
    );
  }

  function recalculateOne(p: PayslipRow) {
    if (!run || !p.employee) return;
    const employeeId = p.employee.id;
    void act(`one-${p.id}`, () => api.payroll.calculateEmployee(run.id, employeeId), t("payroll.run.recalculatedOne", { name: p.employee.name }));
  }

  const columns: DataTableColumn<PayslipRow>[] = [
    {
      id: "employee",
      header: t("common.field.employee"),
      primary: true,
      cell: (p) => (
        <div className="flex flex-col">
          <span className="font-medium">{p.employee?.name ?? t("payroll.run.removedEmployee")}</span>
          <span className="text-xs text-muted-foreground">{[p.employee?.employee_code, p.employee?.branch].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      ),
      searchValue: (p) => [p.employee?.name, p.employee?.employee_code, p.employee?.branch].filter(Boolean).join(" "),
      sortValue: (p) => p.employee?.name ?? "",
    },
    { id: "base", header: t("payroll.run.colSalary"), hideOnMobile: true, cell: (p) => <span className="tabular-nums">{money(p.base_salary, p.currency)}{p.pay_type === "daily" ? t("payroll.run.perDay") : ""}</span> },
    { id: "gross", header: t("payroll.run.colGross"), cell: (p) => <span className="tabular-nums">{money(p.gross, p.currency)}</span>, sortValue: (p) => Number(p.gross) },
    { id: "deductions", header: t("payroll.run.colStatutory"), hideOnMobile: true, cell: (p) => <span className="tabular-nums text-muted-foreground">{money(Number(p.nssf_employee) + Number(p.tax), p.currency)}</span> },
    { id: "net", header: t("payroll.run.colNet"), cell: (p) => <span className="font-semibold tabular-nums">{money(p.net, p.currency)}</span>, sortValue: (p) => Number(p.net) },
    {
      id: "check",
      header: t("payroll.run.colCheck"),
      cell: (p) =>
        p.is_stale && !run.stale_everyone ? (
          canManage && editable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                recalculateOne(p);
              }}
              disabled={busy !== null}
            >
              <RefreshCw className={busy === `one-${p.id}` ? "size-3.5 animate-spin" : "size-3.5"} />
              {t("payroll.run.recalculate")}
            </Button>
          ) : (
            <Badge variant="warning">{t("payroll.run.changed")}</Badge>
          )
        ) : p.warnings?.some((w) => w.blocking) ? (
          <Badge variant="warning">
            <AlertTriangle className="size-3" />
            {t("payroll.run.needsFixing")}
          </Badge>
        ) : p.warnings?.length ? (
          <Badge variant="info">{t("payroll.run.note")}</Badge>
        ) : (
          <Badge variant="success">{t("payroll.run.ok")}</Badge>
        ),
      sortValue: (p) => (p.is_stale ? -1 : p.warnings?.some((w) => w.blocking) ? 0 : p.warnings?.length ? 1 : 2),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {back}
      <PageHeader
        title={`${run.pay_group?.name ?? t("payroll.run.payroll")} · ${run.period_label}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={RUN_STATUS[run.status].variant}>{t(RUN_STATUS[run.status].labelKey)}</Badge>
            {run.status === "calculated" && canManage && !canApprove
              ? t("payroll.run.nextPrepare")
              : run.status === "calculated" && canApprove && !canManage
                ? t("payroll.run.nextApprove")
                : t(`payroll.run.next.${run.status}`)}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <PayrollGuideButton topic={editable ? "run" : "locks"} />
            {run.payslips.length > 0 && (
              <Button variant="outline" render={<Link href={`/dashboard/payroll/runs/${run.id}/dashboard`} />} nativeButton={false}>
                <ChartColumnBig className="size-4" />
                {t("payroll.run.dashboard")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" disabled={busy !== null || run.payslips.length === 0} />}>
                <Download className="size-4" />
                {busy === "export" ? t("payroll.run.preparing") : t("common.action.export")}
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onClick={() => exportPdf(false)}>
                  <FileText className="size-4" />
                  <div className="flex flex-col">
                    <span>{t("payroll.run.pdfReport")}</span>
                    <span className="text-xs text-muted-foreground">{t("payroll.run.pdfReportHint")}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPdf(true)}>
                  <Landmark className="size-4" />
                  <div className="flex flex-col">
                    <span>{t("payroll.run.pdfPayments")}</span>
                    <span className="text-xs text-muted-foreground">{t("payroll.run.pdfPaymentsHint")}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBankExport(true)}>
                  <Building2 className="size-4" />
                  <div className="flex flex-col">
                    <span>{t("payroll.bankExport.menu")}</span>
                    <span className="text-xs text-muted-foreground">{t("payroll.bankExport.menuHint")}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCsv}>
                  <Sheet className="size-4" />
                  <div className="flex flex-col">
                    <span>{t("payroll.run.csv")}</span>
                    <span className="text-xs text-muted-foreground">{t("payroll.run.csvHint")}</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage && editable && (
              <Button variant="outline" onClick={() => act("calculate", () => api.payroll.calculate(run.id), t("payroll.run.recalculated"))} disabled={busy !== null}>
                <RefreshCw className={busy === "calculate" ? "size-4 animate-spin" : "size-4"} />
                {t("payroll.run.recalculate")}
              </Button>
            )}
            {canApprove && editable && (
              <Button onClick={approve} disabled={busy !== null || blocked || run.payslips.length === 0}>
                <BadgeCheck className="size-4" />
                {busy === "approve" ? t("payroll.run.approving") : t("common.action.approve")}
              </Button>
            )}
            {canApprove && !editable && (
              <Button variant="outline" onClick={() => setReopening(true)} disabled={busy !== null}>
                <Undo2 className="size-4" />
                {t("payroll.run.reopen")}
              </Button>
            )}
            {canManage && run.status === "approved" && (
              <Button onClick={markPaid} disabled={busy !== null}>
                <Banknote className="size-4" />
                {t("payroll.run.markPaid")}
              </Button>
            )}
          </div>
        }
      />

      {run.is_stale && (
        <Alert
          variant="warning"
          title={
            run.stale_everyone
              ? t("payroll.run.staleEveryone")
              : t(run.stale_employee_ids.length === 1 ? "payroll.run.staleOne" : "payroll.run.staleOther", { n: run.stale_employee_ids.length })
          }
          action={
            canManage && (
              <Button size="sm" onClick={recalculateStale} disabled={busy !== null}>
                <RefreshCw className={busy === "calculate" ? "size-4 animate-spin" : "size-4"} />
                {run.stale_everyone
                  ? t("payroll.run.recalculateNow")
                  : run.stale_employee_ids.length === 1
                    ? t("payroll.run.recalculateThem")
                    : t("payroll.run.recalculateThese", { n: run.stale_employee_ids.length })}
              </Button>
            )
          }
        >
          {run.stale_everyone
            ? t("payroll.run.staleEveryoneText")
            : t("payroll.run.stalePeopleText", { names: `${staleNames.slice(0, 5).join(", ") || t("payroll.run.somePeople")}${staleNames.length > 5 ? "…" : ""}` })}
        </Alert>
      )}
      <WarningList warnings={run.warnings} />
      {withProblems > 0 && (
        <Alert variant="warning" title={t(withProblems === 1 ? "payroll.run.problemsOne" : "payroll.run.problemsOther", { n: withProblems })}>
          {t("payroll.run.problemsText")}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(run.totals ?? {}).flatMap(([currency, sum]) => [
          <Card key={`${currency}-net`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t(sum.employees === 1 ? "payroll.run.netOne" : "payroll.run.netOther", { currency, n: sum.employees })}</p>
              <p className="text-2xl font-semibold tabular-nums">{money(sum.net, currency)}</p>
            </CardContent>
          </Card>,
          <Card key={`${currency}-gross`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t("payroll.run.gross", { currency })}</p>
              <p className="text-2xl font-semibold tabular-nums">{money(sum.gross, currency)}</p>
            </CardContent>
          </Card>,
          <Card key={`${currency}-stat`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t("payroll.run.withheld", { currency })}</p>
              <p className="text-2xl font-semibold tabular-nums">{money(sum.nssf_employee + sum.tax, currency)}</p>
            </CardContent>
          </Card>,
          <Card key={`${currency}-cost`}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t("payroll.run.cost", { currency })}</p>
              <p className="text-2xl font-semibold tabular-nums">{money(sum.employer_cost, currency)}</p>
            </CardContent>
          </Card>,
        ])}
      </div>

      <DataTable
        data={run.payslips}
        getRowId={(p) => p.id}
        columns={columns}
        onRowClick={(p) => setOpenSlip(p.id)}
        searchPlaceholder={t("payroll.run.search")}
        emptyState={{ icon: Wallet, title: t("payroll.run.emptyTitle"), description: t("payroll.run.emptyText") }}
      />

      {canManage && editable && (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 className="size-4" />
            {t("payroll.run.deleteRun")}
          </Button>
        </div>
      )}

      <BankExportDialog run={run} open={bankExport} onOpenChange={setBankExport} canManage={canManage} />
      <PayslipDialog payslipId={openSlip} onOpenChange={(o) => !o && setOpenSlip(null)} />
      <ReopenDialog
        open={reopening}
        onOpenChange={setReopening}
        label={t("payroll.run.reopenLabel", { group: run.pay_group?.name ?? t("payroll.run.payroll"), period: run.period_label })}
        paid={run.status === "paid"}
        onReopen={reopen}
      />
    </div>
  );
}

/** Undoing a sign-off always needs a reason: it goes to the audit log. */
function ReopenDialog({
  open,
  onOpenChange,
  label,
  paid,
  onReopen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  paid: boolean;
  onReopen: (reason: string) => Promise<boolean>;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      if (await onReopen(reason.trim())) setReason("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("payroll.run.reopenTitle", { label })}</DialogTitle>
          <DialogDescription>
            {t("payroll.run.reopenText")}
            {paid && ` ${t("payroll.run.reopenPaid")}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reopen-reason">{t("common.field.reason")}</Label>
          <Textarea id="reopen-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t("payroll.run.reopenPlaceholder")} />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("common.action.cancel")}</DialogClose>
          <Button onClick={submit} disabled={saving || reason.trim() === ""}>
            {t("payroll.run.reopen")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
