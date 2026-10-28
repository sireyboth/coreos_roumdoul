"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { money, today } from "@/components/dashboard/payroll/shared";
import { api, type PayRun, type PayRunReport, type PayrollPolicy } from "@/lib/api";
import { BANK_FORMATS, bankTransfers, defaultRemarks, downloadBankFile, isBank, type BankFormat, type SkippedSlip } from "@/lib/bank-export";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";
import { cn } from "cn";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none";

/**
 * Picks a bank and writes that bank's bulk salary transfer file for one pay
 * run. The company's own details (Chip Mong's header) are remembered on the
 * payroll policy for whoever can manage payroll.
 */
export function BankExportDialog({ run, open, onOpenChange, canManage }: { run: PayRun; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean }) {
  const t = useT();
  const [report, setReport] = useState<PayRunReport | null>(null);
  const [saved, setSaved] = useState<PayrollPolicy["bank_exports"]>(null);
  const [format, setFormat] = useState<BankFormat>("chipmong");
  const [currency, setCurrency] = useState("USD");
  const [sameBankOnly, setSameBankOnly] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [debitAccount, setDebitAccount] = useState("");
  const [valueDate, setValueDate] = useState(today());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.payroll.runReport(run.id), api.payroll.settings()])
      .then(([r, settings]) => {
        setReport(r);
        setRemarks(defaultRemarks(run.period_end));
        setValueDate(today());
        const currencies = [...new Set<string>(r.payslips.map((p) => p.currency))];
        if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0]);
        const chipmong = settings.policy.bank_exports?.chipmong;
        setSaved(settings.policy.bank_exports);
        setCompanyCode(chipmong?.company_code ?? "");
        setDebitAccount(chipmong?.debit_account ?? "");
      })
      .catch(notifyError);
    // Loaded fresh each time the dialog opens, so it follows a recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, run.id, run.period_end]);

  const currencies = useMemo(() => [...new Set(report?.payslips.map((p) => p.currency) ?? [])], [report]);
  // Nobody at this bank at all: the filter would leave an empty file, so everyone paid by bank is offered instead.
  const anyAtBank = report?.payslips.some((p) => isBank(format, p.employee?.bank_name)) ?? false;
  const filter = sameBankOnly && anyAtBank;
  const { transfers, skipped } = useMemo(
    () => (report ? bankTransfers(report.payslips, currency, format, filter) : { transfers: [], skipped: [] as SkippedSlip[] }),
    [report, currency, format, filter],
  );
  const total = transfers.reduce((sum, r) => sum + r.amount, 0);
  const bankName = BANK_FORMATS.find((b) => b.key === format)!.name;
  const missing = skipped.filter((s) => s.reason === "noAccount");
  const chipmongReady = format !== "chipmong" || (companyCode.trim() !== "" && debitAccount.trim() !== "" && valueDate !== "");

  async function download() {
    setBusy(true);
    try {
      if (format === "chipmong" && canManage) {
        const next = { company_code: companyCode.trim(), debit_account: debitAccount.trim() };
        if (next.company_code !== (saved?.chipmong?.company_code ?? "") || next.debit_account !== (saved?.chipmong?.debit_account ?? "")) {
          const policy = await api.payroll.updatePolicy({ bank_exports: { ...saved, chipmong: next } });
          setSaved(policy.bank_exports);
        }
      }
      await downloadBankFile({
        format,
        currency,
        transfers,
        remarks: remarks.trim(),
        companyCode: companyCode.trim(),
        debitAccount: debitAccount.trim(),
        valueDate,
        filename: `${format}-payroll-${currency.toLowerCase()}-${run.period_end}.xlsx`,
      });
      notifySuccess(t("payroll.bankExport.downloaded", { n: transfers.length }));
      onOpenChange(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("payroll.bankExport.title")}</DialogTitle>
          <DialogDescription>{t("payroll.bankExport.description")}</DialogDescription>
        </DialogHeader>

        {!report ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("payroll.bankExport.bank")}</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {BANK_FORMATS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    role="radio"
                    aria-checked={format === b.key}
                    onClick={() => setFormat(b.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      format === b.key ? "border-primary bg-primary/5 font-medium" : "border-input hover:bg-muted/50",
                    )}
                  >
                    <Landmark className={cn("size-4", format === b.key ? "text-primary" : "text-muted-foreground")} />
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {currencies.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank-currency">{t("payroll.bankExport.currency")}</Label>
                <select id="bank-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={SELECT_CLASS}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t("payroll.bankExport.currencyHint")}</p>
              </div>
            )}

            {format === "chipmong" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bank-company-code">{t("payroll.bankExport.companyCode")}</Label>
                  <Input id="bank-company-code" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} maxLength={50} placeholder="0100718" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bank-debit-account">{t("payroll.bankExport.debitAccount")}</Label>
                  <Input id="bank-debit-account" value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)} maxLength={50} placeholder="98410041" />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="bank-value-date">{t("payroll.bankExport.valueDate")}</Label>
                  <Input id="bank-value-date" type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
                </div>
                {canManage && <p className="text-xs text-muted-foreground sm:col-span-2">{t("payroll.bankExport.remembered")}</p>}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bank-remarks">{t("payroll.bankExport.remarks")}</Label>
              <Input id="bank-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={60} />
            </div>

            <label className={cn("flex items-start gap-2 text-sm", !anyAtBank && "opacity-60")}>
              <input type="checkbox" className="mt-0.5 size-4" checked={filter} disabled={!anyAtBank} onChange={(e) => setSameBankOnly(e.target.checked)} />
              <span className="flex flex-col">
                <span>{t("payroll.bankExport.sameBankOnly", { bank: bankName })}</span>
                <span className="text-xs text-muted-foreground">
                  {anyAtBank ? t("payroll.bankExport.sameBankOnlyHint") : t("payroll.bankExport.noneAtBank", { bank: bankName })}
                </span>
              </span>
            </label>

            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t(transfers.length === 1 ? "payroll.bankExport.transfersOne" : "payroll.bankExport.transfersOther", { n: transfers.length })}</span>
                <span className="text-lg font-semibold tabular-nums">{money(total, currency)}</span>
              </div>
              {skipped.length > 0 && (
                <ul className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-xs text-muted-foreground">
                  {(["noAccount", "cash", "otherBank", "nothingToPay"] as const).map((reason) => {
                    const count = skipped.filter((s) => s.reason === reason).length;
                    return count > 0 && <li key={reason}>{t(`payroll.bankExport.skipped.${reason}`, { n: count })}</li>;
                  })}
                </ul>
              )}
            </div>

            {missing.length > 0 && (
              <Alert variant="warning" title={t("payroll.bankExport.missingTitle", { n: missing.length })}>
                {missing.slice(0, 6).map((s) => s.name).join(", ")}
                {missing.length > 6 ? "…" : ""}
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("common.action.cancel")}</DialogClose>
          <Button onClick={download} disabled={!report || busy || transfers.length === 0 || !chipmongReady || remarks.trim() === ""}>
            {busy ? t("payroll.run.preparing") : t("payroll.bankExport.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
