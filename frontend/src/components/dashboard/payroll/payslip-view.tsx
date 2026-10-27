"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { api, type PayslipBody } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLang, useT } from "@/lib/i18n";
import { LINE_SECTIONS, WarningList, dateLabel, money, monthLabel } from "./shared";

function Row({ label, value, strong, muted }: { label: React.ReactNode; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "font-semibold", muted && "text-muted-foreground")}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/**
 * A payslip read top to bottom: every line with how it was worked out, the
 * totals, and the attendance it came from. Used for saved payslips and for
 * the live preview in settings.
 */
export function PayslipView({ slip, highlight }: { slip: PayslipBody; highlight?: string }) {
  const t = useT();
  const lang = useLang();
  const c = slip.currency;
  const a = slip.inputs.attendance;
  const v = slip.inputs.variables;
  const fact = (label: string, value: unknown) => (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{String(value ?? 0)}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <WarningList warnings={slip.warnings} />

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{t("payroll.payslip.gross")}</p>
          <p className="text-base font-semibold tabular-nums">{money(slip.gross, c)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{t("payroll.payslip.statutory")}</p>
          <p className="text-base font-semibold tabular-nums">{money(Number(slip.nssf_employee) + Number(slip.tax), c)}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-3">
          <p className="text-xs text-muted-foreground">{t("payroll.payslip.net")}</p>
          <p className="text-base font-semibold tabular-nums text-primary">{money(slip.net, c)}</p>
        </div>
      </div>

      {LINE_SECTIONS.map((section) => {
        const lines = slip.lines.filter((l) => l.kind === section.kind);
        if (lines.length === 0) return null;
        return (
          <section key={section.kind}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(section.titleKey)}</h3>
            <div className="divide-y divide-border rounded-lg border border-border px-3">
              {lines.map((line, i) => (
                <div key={`${line.code}-${i}`} className={cn("flex items-start justify-between gap-4 py-2", highlight && line.code === highlight && "-mx-3 bg-primary/5 px-3")}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.name}</p>
                    {line.explanation && <p className="text-xs text-muted-foreground">{line.explanation}</p>}
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">
                    {section.sign && `${section.sign} `}
                    {money(line.amount, c)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="rounded-lg border border-border px-3 py-1">
        <Row label={t("payroll.payslip.grossPay")} value={money(slip.gross, c)} />
        <Row label={t("payroll.payslip.net")} value={money(slip.net, c)} strong />
        <Row label={t("payroll.payslip.cost")} value={money(slip.employer_cost, c)} muted />
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("payroll.payslip.workedFrom")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fact(t("payroll.payslip.daysWorked"), a.present_days)}
          {fact(t("payroll.payslip.absent"), v.absent_days)}
          {fact(t("payroll.payslip.missingScan"), a.incomplete_days)}
          {fact(t("payroll.payslip.lateArrivals"), v.late_count)}
          {fact(t("payroll.payslip.dailyRate"), money(slip.daily_rate, c))}
          {fact(t("payroll.payslip.hourlyRate"), money(slip.hourly_rate, c))}
          {fact(t("payroll.payslip.dayBasis"), t("payroll.payslip.days", { n: slip.inputs.rate_basis.days }))}
          {fact(t("payroll.payslip.taxRate"), slip.exchange_rate ? Number(slip.exchange_rate).toLocaleString("en-US") : c === "KHR" ? "—" : t("payroll.payslip.missing"))}
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

/** A saved payslip, opened from a pay run. */
export function PayslipDialog({ payslipId, onOpenChange }: { payslipId: number | null; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const lang = useLang();
  const { data: slip } = useApi(payslipId ? () => api.payroll.payslip(payslipId) : null, [payslipId], { notify: true });

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
          <PayslipView slip={slip} />
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
