"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { api, type MyPayslip, type Payslip, type PayLineKind, type PayRunDetail, type PayslipBody, type PayslipLine } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useLang, useT } from "@/lib/i18n";
import { LINE_SECTIONS, WarningList, dateLabel, money, monthLabel } from "./shared";

/** Setting a line by hand, from a saved payslip in a run that can still change. */
export type LineEditing = {
  save: (line: PayslipLine, amount: number, reason: string) => Promise<boolean>;
  clear: (line: PayslipLine) => Promise<boolean>;
};

/*
 * Colours, so a payslip reads at a glance: green is money you get, red is
 * money taken off, amber is something to check, blue is a plain total.
 * Classes are written out in full so Tailwind keeps them.
 */
type Tone = "success" | "danger" | "warning" | "info";
const TONE: Record<Tone, { tile: string; text: string; dot: string; accent: string }> = {
  success: { tile: "border-success/30 bg-success/10", text: "text-success", dot: "bg-success", accent: "border-l-success" },
  danger: { tile: "border-destructive/30 bg-destructive/10", text: "text-destructive", dot: "bg-destructive", accent: "border-l-destructive" },
  warning: { tile: "border-warning/30 bg-warning/10", text: "text-warning", dot: "bg-warning", accent: "border-l-warning" },
  info: { tile: "border-info/30 bg-info/10", text: "text-info", dot: "bg-info", accent: "border-l-info" },
};
const SECTION_TONE: Record<PayLineKind, Tone> = {
  earning: "success",
  deduction: "danger",
  statutory: "warning",
  net_deduction: "danger",
  employer: "info",
};

function Row({ label, value, strong, muted }: { label: React.ReactNode; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "font-semibold", muted && "text-muted-foreground")}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/**
 * HR's own amount for one line, with the reason (shown on the payslip and
 * kept in the audit log). Opens under the line it changes.
 */
function LineOverrideForm({ line, currency, editing, onDone }: { line: PayslipLine; currency: string; editing: LineEditing; onDone: () => void }) {
  const t = useT();
  const current = line.details?.override;
  const [amount, setAmount] = useState(String(Number(line.amount)));
  const [reason, setReason] = useState(current?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const valid = amount.trim() !== "" && Number(amount) >= 0 && reason.trim() !== "";

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <div className="mb-2 flex flex-col gap-3 rounded-md bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">
        {t("payroll.payslip.override.ruleSays", { amount: money(current?.calculated ?? line.amount, currency) })}
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`override-amount-${line.code}`}>{t("payroll.payslip.override.amount")}</Label>
        <Input id={`override-amount-${line.code}`} type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`override-reason-${line.code}`}>{t("payroll.payslip.override.reason")}</Label>
        <Textarea id={`override-reason-${line.code}`} rows={2} maxLength={500} placeholder={t("payroll.payslip.override.reasonHint")} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {current && (
          <Button variant="ghost" size="sm" className="mr-auto" disabled={busy} onClick={() => run(() => editing.clear(line))}>
            {t("payroll.payslip.override.useRule")}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={busy} onClick={onDone}>
          {t("common.action.cancel")}
        </Button>
        <Button size="sm" disabled={busy || !valid} onClick={() => run(() => editing.save(line, Number(amount), reason.trim()))}>
          {busy ? t("common.message.saving") : t("common.action.save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * A payslip read top to bottom: every line with how it was worked out, the
 * totals, and the attendance it came from. Used for saved payslips and for
 * the live preview in settings. With `editing`, lines made by a rule can be
 * set by hand. Without employer_cost (an employee's own payslip) the
 * company's cost line is left out.
 */
export function PayslipView({
  slip,
  highlight,
  editing,
}: {
  slip: Omit<PayslipBody, "employer_cost"> & { employer_cost?: PayslipBody["employer_cost"] };
  highlight?: string;
  editing?: LineEditing;
}) {
  const t = useT();
  const lang = useLang();
  const [openLine, setOpenLine] = useState<number | null>(null);
  const c = slip.currency;
  const a = slip.inputs.attendance;
  const v = slip.inputs.variables;
  // A fact gets its colour only when it matters (e.g. absent > 0), so problems stand out and zeros stay quiet.
  const fact = (label: string, value: unknown, tone?: Tone | false) => (
    <div className={cn("rounded-md border px-3 py-2", tone ? TONE[tone].tile : "border-border")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-medium tabular-nums", tone && TONE[tone].text)}>{String(value ?? 0)}</p>
    </div>
  );
  const count = (value: unknown) => Number(value ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <WarningList warnings={slip.warnings} />

      <div className="grid grid-cols-3 gap-2">
        <div className={cn("rounded-lg border p-3", TONE.info.tile)}>
          <p className="text-xs text-muted-foreground">{t("payroll.payslip.gross")}</p>
          <p className={cn("text-base font-semibold tabular-nums", TONE.info.text)}>{money(slip.gross, c)}</p>
        </div>
        <div className={cn("rounded-lg border p-3", TONE.warning.tile)}>
          <p className="text-xs text-muted-foreground">{t("payroll.payslip.statutory")}</p>
          <p className={cn("text-base font-semibold tabular-nums", TONE.warning.text)}>{money(Number(slip.nssf_employee) + Number(slip.tax), c)}</p>
        </div>
        <div className={cn("rounded-lg border-2 p-3", TONE.success.tile)}>
          <p className="text-xs font-medium text-muted-foreground">{t("payroll.payslip.net")}</p>
          <p className={cn("text-lg font-bold tabular-nums", TONE.success.text)}>{money(slip.net, c)}</p>
        </div>
      </div>

      {LINE_SECTIONS.map((section) => {
        const lines = slip.lines.filter((l) => l.kind === section.kind);
        if (lines.length === 0) return null;
        const tone = TONE[SECTION_TONE[section.kind]];
        return (
          <section key={section.kind}>
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden />
              {t(section.titleKey)}
            </h3>
            <div className={cn("divide-y divide-border rounded-lg border border-l-4 border-border px-3", tone.accent)}>
              {lines.map((line, i) => {
                const override = line.details?.override;
                const componentId = line.pay_component_id ?? null;
                return (
                  <div key={`${line.code}-${i}`}>
                    <div className={cn("flex items-start justify-between gap-4 py-2", highlight && line.code === highlight && "-mx-3 bg-primary/5 px-3")}>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {line.name}
                          {override && <Badge variant="warning">{t("payroll.payslip.override.badge")}</Badge>}
                        </p>
                        {override ? (
                          <p className="text-xs text-muted-foreground">{t("payroll.payslip.override.because", { reason: override.reason })}</p>
                        ) : (
                          line.explanation && <p className="text-xs text-muted-foreground">{line.explanation}</p>
                        )}
                        {override && (
                          <p className="text-xs text-muted-foreground">
                            {t("payroll.payslip.override.wasRule", { amount: money(override.calculated, c) })}
                            {override.by && ` · ${override.by}`}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <p className={cn("text-sm font-medium tabular-nums", tone.text)}>
                          {section.sign && `${section.sign} `}
                          {money(line.amount, c)}
                        </p>
                        {editing && componentId !== null && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("payroll.payslip.override.edit", { line: line.name })}
                            onClick={() => setOpenLine(openLine === componentId ? null : componentId)}
                          >
                            <Pencil />
                          </Button>
                        )}
                      </div>
                    </div>
                    {editing && componentId !== null && openLine === componentId && (
                      <LineOverrideForm line={line} currency={c} editing={editing} onDone={() => setOpenLine(null)} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="px-3 py-1">
          <Row label={t("payroll.payslip.grossPay")} value={money(slip.gross, c)} />
          {slip.employer_cost !== undefined && <Row label={t("payroll.payslip.cost")} value={money(slip.employer_cost, c)} muted />}
        </div>
        {/* The line people look for first: what they actually receive. */}
        <div className={cn("flex items-baseline justify-between gap-4 border-t px-3 py-2.5", TONE.success.tile)}>
          <span className="text-sm font-semibold">{t("payroll.payslip.net")}</span>
          <span className={cn("text-base font-bold tabular-nums", TONE.success.text)}>{money(slip.net, c)}</span>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("payroll.payslip.workedFrom")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fact(t("payroll.payslip.daysWorked"), a.present_days, count(a.present_days) > 0 && "success")}
          {fact(t("payroll.payslip.absent"), v.absent_days, count(v.absent_days) > 0 && "danger")}
          {fact(t("payroll.payslip.missingScan"), a.incomplete_days, count(a.incomplete_days) > 0 && "warning")}
          {fact(t("payroll.payslip.lateArrivals"), v.late_count, count(v.late_count) > 0 && "warning")}
          {fact(t("payroll.payslip.dailyRate"), money(slip.daily_rate, c))}
          {fact(t("payroll.payslip.hourlyRate"), money(slip.hourly_rate, c))}
          {fact(t("payroll.payslip.dayBasis"), t("payroll.payslip.days", { n: slip.inputs.rate_basis.days }))}
          {fact(
            t("payroll.payslip.taxRate"),
            slip.exchange_rate ? Number(slip.exchange_rate).toLocaleString("en-US") : c === "KHR" ? "—" : t("payroll.payslip.missing"),
            !slip.exchange_rate && c !== "KHR" && "danger",
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("payroll.payslip.paidFor", { from: dateLabel(slip.inputs.employed.from, lang), to: dateLabel(slip.inputs.employed.to, lang) })} ·{" "}
          {slip.pay_type === "daily" ? t("payroll.payslip.perDay") : t("payroll.payslip.monthly")}
          {slip.inputs.exchange_rate_source === "company_fallback" && ` · ${t("payroll.payslip.fallbackRate")}`}
        </p>
      </section>

      {(slip.inputs.months?.length ?? 0) > 1 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("payroll.payslip.byMonth")}</h3>
          <div className="rounded-lg border border-border px-3 py-1">
            {slip.inputs.months!.map((m) => (
              <Row key={m.month} label={t(m.days === 1 ? "payroll.payslip.monthDaysOne" : "payroll.payslip.monthDaysOther", { month: monthLabel(m.month, lang), n: m.days })} value={money(m.gross, c)} muted />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("payroll.payslip.crossMonth")}</p>
        </section>
      )}
    </div>
  );
}

/**
 * A saved payslip, opened from a pay run. With `onRunChange` (HR, run not yet
 * approved), its rule lines can be set by hand: the person is recalculated and
 * the run comes back with their new payslip. With `own`, it is the signed-in
 * person's payslip from their profile (read-only, no HR permission needed).
 */
export function PayslipDialog({
  payslipId,
  onOpenChange,
  onRunChange,
  own,
}: {
  payslipId: number | null;
  onOpenChange: (open: boolean) => void;
  onRunChange?: (run: PayRunDetail, employeeId: number) => void;
  own?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const { data: slip } = useApi<Payslip | MyPayslip>(
    payslipId ? () => (own ? api.myPay.payslip(payslipId) : api.payroll.payslip(payslipId)) : null,
    [payslipId, own],
    { notify: true },
  );

  const employeeId = slip?.employee?.id;
  const editing: LineEditing | undefined =
    slip && employeeId && onRunChange
      ? {
          save: (line, amount, reason) => apply(() => api.payroll.setLine(slip.pay_run_id, employeeId, line.pay_component_id!, { amount, reason })),
          clear: (line) => apply(() => api.payroll.clearLine(slip.pay_run_id, employeeId, line.pay_component_id!)),
        }
      : undefined;

  async function apply(action: () => Promise<PayRunDetail>) {
    try {
      onRunChange!(await action(), employeeId!);
      notifySuccess(t("payroll.payslip.override.saved"));
      return true;
    } catch (err) {
      notifyError(err);
      return false;
    }
  }

  return (
    <Dialog open={payslipId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {slip?.employee?.name ?? t("payroll.payslip.title")}
            {slip?.employee?.employee_code && <Badge variant="secondary">{slip.employee.employee_code}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {slip
              ? `${t("payroll.payslip.for", { period: slip.period_label ?? monthLabel(slip.month, lang) })}${slip.pay_group ? ` · ${slip.pay_group.name}` : ""}`
              : t("common.message.loading")}
          </DialogDescription>
        </DialogHeader>
        {slip ? (
          <PayslipView slip={slip} editing={editing} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
