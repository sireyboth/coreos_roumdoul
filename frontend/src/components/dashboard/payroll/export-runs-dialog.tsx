"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, FileSpreadsheet, Landmark, Sheet, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PHONE_SHEET, SheetHandle } from "@/components/dashboard/shared/phone-sheet";
import { RUN_STATUS, money, today } from "@/components/dashboard/payroll/shared";
import { api, type PayGroup, type PayRun, type PayRunReport, type PayrollPolicy } from "@/lib/api";
import { withBusy } from "@/lib/busy";
import { BANK_FORMATS, bankBatches, downloadBankWorkbook, rememberChipmong, type BankFormat } from "@/lib/export/bank";
import { downloadPayRunsWorkbook } from "@/lib/export/payroll-runs";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** "report": the accountant's workbook (Summary + payslips); else a bank's bulk upload layout. */
type ExportFormat = "report" | BankFormat;

const SKIP_REASONS = ["noAccount", "cash", "otherBank", "nothingToPay"] as const;

const employeesIn = (run: PayRun) => Object.values(run.totals ?? {}).reduce((n, t) => n + t.employees, 0);

/** Amounts added up per currency (USD and KHR never mixed): "$1,240.00 · 3,200,000 ៛". */
function perCurrency(sums: Map<string, number>): string {
  return sums.size ? [...sums].map(([currency, amount]) => money(amount, currency)).join(" · ") : "—";
}

function netOf(runs: PayRun[]): string {
  const sums = new Map<string, number>();
  for (const run of runs) {
    for (const [currency, t] of Object.entries(run.totals ?? {})) sums.set(currency, (sums.get(currency) ?? 0) + Number(t.net));
  }
  return perCurrency(sums);
}

/** Oldest period first, then pay group: the order sheets appear in the file. */
const byPeriod = (a: PayRun, b: PayRun) => a.period_end.localeCompare(b.period_end) || (a.pay_group?.name ?? "").localeCompare(b.pay_group?.name ?? "");

/** A pay group filter chip; the chosen one gets a soft primary tint. */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
        active ? "bg-primary/10 text-primary ring-primary/30" : "bg-background text-muted-foreground ring-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** One choice in the format picker: icon, name and a short hint. */
function FormatTile({ icon: IconCmp, label, hint, active, onClick }: { icon: LucideIcon; label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col items-start gap-1.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" : "bg-muted/30 hover:bg-accent/40",
      )}
    >
      <IconCmp className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
      <span className="w-full truncate text-sm font-medium">{label}</span>
      <span className="w-full truncate text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}

/** A small uppercase heading over a section, like a phone's Settings screen. */
function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h3>
      {action}
    </div>
  );
}

/**
 * Pick pay runs and a format, get one Excel file:
 *   - Excel report: Summary sheet, then one sheet per run (lib/export/payroll-runs.ts).
 *   - A bank: one sheet per run and currency in that bank's upload layout (lib/export/bank.ts).
 * A bottom sheet on phones, a card on wider screens, like the correction review.
 */
export function ExportRunsDialog({
  open,
  runs,
  groups,
  initialGroup,
  canManage,
  onOpenChange,
}: {
  open: boolean;
  runs: PayRun[];
  groups: PayGroup[];
  /** The page's pay group filter, so the sheet opens on the same list. */
  initialGroup: string;
  /** May save Chip Mong's company details on the payroll policy. */
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [format, setFormat] = useState<ExportFormat>("report");
  const [groupFilter, setGroupFilter] = useState(initialGroup);
  // Kept across group changes: ticking runs from two groups is allowed.
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Each ticked run's payslips, fetched once per opening (a bank file needs them for its preview).
  const [reports, setReports] = useState<Record<number, PayRunReport>>({});
  // Bank file options. Chip Mong's company code and debit account come from the payroll policy.
  const [saved, setSaved] = useState<PayrollPolicy["bank_exports"] | undefined>(undefined);
  const [companyCode, setCompanyCode] = useState("");
  const [debitAccount, setDebitAccount] = useState("");
  const [valueDate, setValueDate] = useState(today());
  const [sameBankOnly, setSameBankOnly] = useState(true);

  // Opening again starts on the page's current group (set during render, React's
  // pattern for "reset state when a prop changes").
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setGroupFilter(initialGroup);
      setValueDate(today());
    }
  }

  const isBankFile = format !== "report";
  const shown = groupFilter ? runs.filter((r) => String(r.pay_group?.id) === groupFilter) : runs;
  const shownSelected = shown.filter((r) => selected.has(r.id)).length;
  const allShown = shown.length > 0 && shownSelected === shown.length;
  const chosen = runs.filter((r) => selected.has(r.id)).sort(byPeriod);
  const loadingReports = isBankFile && chosen.some((r) => !reports[r.id]);

  // A bank file previews its transfers, so the ticked runs' payslips load as they are ticked.
  useEffect(() => {
    if (!open || !isBankFile) return;
    const missing = [...selected].filter((id) => !reports[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => api.payroll.runReport(id)))
      .then((list) => !cancelled && setReports((current) => ({ ...current, ...Object.fromEntries(list.map((r) => [r.id, r])) })))
      .catch(notifyError);
    return () => {
      cancelled = true;
    };
    // `reports` is left out on purpose: adding to it must not start another fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isBankFile, selected]);

  // Chip Mong's saved company details, loaded the first time a bank is picked.
  useEffect(() => {
    if (!open || !isBankFile || saved !== undefined) return;
    api.payroll
      .settings()
      .then((settings) => {
        const chipmong = settings.policy.bank_exports?.chipmong;
        setSaved(settings.policy.bank_exports);
        setCompanyCode(chipmong?.company_code ?? "");
        setDebitAccount(chipmong?.debit_account ?? "");
      })
      .catch(() => setSaved(null));
  }, [open, isBankFile, saved]);

  // What the bank file would hold right now: one batch per run and currency.
  const bank = useMemo(() => {
    if (!isBankFile || loadingReports) return null;
    const { batches, anyAtBank, filtered } = bankBatches(
      chosen.map((r) => reports[r.id]),
      format,
      sameBankOnly,
    );
    const totals = new Map<string, number>();
    let count = 0;
    for (const b of batches) {
      for (const tr of b.transfers) totals.set(b.currency, (totals.get(b.currency) ?? 0) + tr.amount);
      count += b.transfers.length;
    }
    const skipped = batches.flatMap((b) => b.skipped);
    return { batches, anyAtBank, filtered, totals, count, skipped, missing: skipped.filter((s) => s.reason === "noAccount") };
  }, [isBankFile, loadingReports, chosen, reports, format, sameBankOnly]);

  const bankName = isBankFile ? BANK_FORMATS.find((b) => b.key === format)!.name : "";
  const chipmongReady = format !== "chipmong" || (companyCode.trim() !== "" && debitAccount.trim() !== "" && valueDate !== "");
  const canDownload = chosen.length > 0 && !exporting && (!isBankFile || (bank !== null && bank.count > 0 && chipmongReady));

  function toggle(ids: number[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      if (isBankFile) {
        if (!bank) return;
        if (format === "chipmong" && canManage && saved !== undefined) setSaved(await rememberChipmong(saved, companyCode, debitAccount));
        await downloadBankWorkbook(`${format}-payroll-${today()}.xlsx`, bank.batches, {
          format,
          companyCode: companyCode.trim(),
          debitAccount: debitAccount.trim(),
          valueDate,
        });
        notifySuccess(t("payroll.bankExport.downloaded", { n: bank.count }));
      } else {
        // Reuses any payslips already loaded for a bank preview.
        const list = await withBusy(() => Promise.all(chosen.map((r) => reports[r.id] ?? api.payroll.runReport(r.id))));
        await downloadPayRunsWorkbook(list);
        notifySuccess(t("payroll.runs.export.done", { n: chosen.length }));
      }
      onOpenChange(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !exporting && onOpenChange(next)}
      // Cleared once the close animation ends, so nothing jumps while it slides away.
      // Payslips are dropped too: the next opening follows any recalculation.
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setSelected(new Set());
        setReports({});
      }}
    >
      <DialogContent className={cn("flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg", PHONE_SHEET)}>
        <SheetHandle />

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-5 sm:pt-5">
          {/* What this is. */}
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success ring-1 ring-success/20">
              <Sheet className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-base font-semibold">{t("payroll.runs.export.title")}</DialogTitle>
              <DialogDescription className="text-xs">{t("payroll.runs.export.description")}</DialogDescription>
            </div>
          </div>

          {/* Format: the accountant's report, or a bank's upload file. */}
          <div className="flex flex-col gap-2">
            <SectionTitle>{t("payroll.runs.export.format")}</SectionTitle>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("payroll.runs.export.format")}>
              <FormatTile
                icon={FileSpreadsheet}
                label={t("payroll.runs.export.formatReport")}
                hint={t("payroll.runs.export.formatReportHint")}
                active={format === "report"}
                onClick={() => setFormat("report")}
              />
              {BANK_FORMATS.map((b) => (
                <FormatTile
                  key={b.key}
                  icon={Landmark}
                  label={b.name}
                  hint={t("payroll.runs.export.formatBankHint")}
                  active={format === b.key}
                  onClick={() => setFormat(b.key)}
                />
              ))}
            </div>
          </div>

          {/* The runs, as a grouped list. */}
          <div className="flex flex-col gap-2">
            <SectionTitle
              action={
                shown.length > 0 && (
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => toggle(shown.map((r) => r.id), !allShown)}>
                    {allShown ? t("payroll.runs.export.clearAll") : t("payroll.runs.export.selectAll")}
                  </button>
                )
              }
            >
              {t("payroll.runs.export.runsCount", { n: shown.length })}
            </SectionTitle>

            {/* Pay group chips — scroll sideways on a phone when there are many. */}
            {groups.length > 1 && (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 scrollbar-none">
                <Chip active={groupFilter === ""} onClick={() => setGroupFilter("")}>
                  {t("payroll.runs.allGroups")}
                </Chip>
                {groups.map((g) => (
                  <Chip key={g.id} active={groupFilter === String(g.id)} onClick={() => setGroupFilter(String(g.id))}>
                    {g.name}
                  </Chip>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("payroll.runs.export.none")}</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-2xl border bg-muted/30">
                {shown.map((run) => {
                  const on = selected.has(run.id);
                  return (
                    <li key={run.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors", on ? "bg-primary/5" : "hover:bg-accent/40")}>
                        {/* The real checkbox stays for keyboards and screen readers; the circle is what people see. */}
                        <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => toggle([run.id], e.target.checked)} />
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                          )}
                          aria-hidden
                        >
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">{run.period_label}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {[run.pay_group?.name, t(employeesIn(run) === 1 ? "payroll.runs.export.peopleOne" : "payroll.runs.export.people", { n: employeesIn(run) })]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-medium tabular-nums">{netOf([run])}</span>
                          <Badge variant={RUN_STATUS[run.status].variant}>{t(RUN_STATUS[run.status].labelKey)}</Badge>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Bank file options: only what the chosen bank's upload needs. */}
          {isBankFile && (
            <div className="flex flex-col gap-2">
              <SectionTitle>{t("payroll.runs.export.bankOptions", { bank: bankName })}</SectionTitle>
              <div className="divide-y overflow-hidden rounded-2xl border bg-muted/30">
                {format === "chipmong" && (
                  <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="export-company-code" className="text-xs text-muted-foreground">
                        {t("payroll.bankExport.companyCode")}
                      </Label>
                      <Input id="export-company-code" className="rounded-xl bg-background" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} maxLength={50} placeholder="0100718" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="export-debit-account" className="text-xs text-muted-foreground">
                        {t("payroll.bankExport.debitAccount")}
                      </Label>
                      <Input id="export-debit-account" className="rounded-xl bg-background" value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)} maxLength={50} placeholder="98410041" />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label htmlFor="export-value-date" className="text-xs text-muted-foreground">
                        {t("payroll.bankExport.valueDate")}
                      </Label>
                      <Input id="export-value-date" type="date" className="rounded-xl bg-background" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
                    </div>
                    {canManage && <p className="text-xs text-muted-foreground sm:col-span-2">{t("payroll.bankExport.remembered")}</p>}
                  </div>
                )}

                <label className={cn("flex cursor-pointer items-start gap-3 px-4 py-3", bank && !bank.anyAtBank && "cursor-default opacity-60")}>
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={bank ? bank.filtered : sameBankOnly}
                    disabled={!!bank && !bank.anyAtBank}
                    onChange={(e) => setSameBankOnly(e.target.checked)}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm">{t("payroll.bankExport.sameBankOnly", { bank: bankName })}</span>
                    <span className="text-xs text-muted-foreground">
                      {bank && !bank.anyAtBank ? t("payroll.bankExport.noneAtBank", { bank: bankName }) : t("payroll.bankExport.sameBankOnlyHint")}
                    </span>
                  </span>
                </label>

                <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">{t("payroll.runs.export.bankSheets")}</p>
              </div>

              {bank && bank.missing.length > 0 && (
                <Alert variant="warning" title={t("payroll.bankExport.missingTitle", { n: bank.missing.length })}>
                  {[...new Set(bank.missing.map((s) => s.name))].slice(0, 6).join(", ")}
                  {bank.missing.length > 6 ? "…" : ""}
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* What will be downloaded, and one big thumb-friendly action pinned to the bottom. */}
        <div className="flex flex-col gap-2 border-t bg-muted/30 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isBankFile && chosen.length > 0 ? (
            loadingReports || !bank ? (
              <p className="text-sm text-muted-foreground">{t("payroll.runs.export.loading")}</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t(bank.count === 1 ? "payroll.bankExport.transfersOne" : "payroll.bankExport.transfersOther", { n: bank.count })}
                  </span>
                  <span className="truncate text-right font-semibold tabular-nums">{perCurrency(bank.totals)}</span>
                </div>
                {bank.skipped.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {SKIP_REASONS.map((reason) => {
                      const n = bank.skipped.filter((s) => s.reason === reason).length;
                      return n > 0 ? t(`payroll.bankExport.skipped.${reason}`, { n }) : null;
                    })
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </>
            )
          ) : (
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t("payroll.runs.export.selected", { n: chosen.length })}</span>
              {chosen.length > 0 && (
                <span className="truncate text-right tabular-nums">
                  <span className="text-muted-foreground">{t("payroll.runs.colNet")}: </span>
                  <span className="font-semibold">{netOf(chosen)}</span>
                </span>
              )}
            </div>
          )}
          <Button size="lg" className="mt-1 h-11 rounded-xl" onClick={handleExport} disabled={!canDownload}>
            <Download className="size-4" />
            {exporting
              ? t("payroll.runs.export.preparing")
              : chosen.length === 0
                ? t("payroll.runs.export.pickFirst")
                : isBankFile
                  ? t("payroll.runs.export.downloadBank", { bank: bankName })
                  : t("payroll.runs.export.downloadN", { n: chosen.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
