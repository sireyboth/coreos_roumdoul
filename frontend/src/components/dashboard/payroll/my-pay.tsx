"use client";

import { useState } from "react";
import { ChevronRight, Eye, EyeOff, ReceiptText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { PayslipDialog } from "./payslip-view";
import { RUN_STATUS, dateLabel, money } from "./shared";

const MASK = "••••••";

/**
 * The signed-in person's own pay, for the profile page: the salary in force
 * today and the payslips of approved or paid runs, newest first. Amounts start
 * hidden, so a glance over the shoulder doesn't show them. The API only ever
 * returns the caller's own record.
 */
export function MyPay() {
  const t = useT();
  const lang = useLang();
  const { data, error, loading } = useApi(() => api.myPay.get(), []);
  const [shown, setShown] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (error || !data) return <Alert variant="destructive">{error}</Alert>;

  const amount = (value: Parameters<typeof money>[0], currency: string) => (shown ? money(value, currency) : MASK);
  const salary = data.salary;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 rounded-lg bg-primary/8 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">{t("payroll.myPay.currentSalary")}</p>
          {salary ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {amount(salary.amount, salary.currency)}
                <span className="ml-1.5 text-sm font-normal text-ink-muted">
                  {salary.pay_type === "daily" ? t("payroll.myPay.perDay") : t("payroll.myPay.perMonth")}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{t("payroll.myPay.since", { date: dateLabel(salary.effective_from, lang) })}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{t("payroll.myPay.noSalary")}</p>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setShown(!shown)} aria-label={shown ? t("payroll.myPay.hide") : t("payroll.myPay.show")} title={shown ? t("payroll.myPay.hide") : t("payroll.myPay.show")}>
          {shown ? <EyeOff /> : <Eye />}
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("payroll.myPay.payslips")}</h3>
        {data.payslips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">{t("payroll.myPay.noPayslips")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.payslips.map((slip) => (
              <li key={slip.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(slip.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-ink-muted">
                    <ReceiptText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{slip.period_label}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {slip.paid_at ? t("payroll.myPay.paidOn", { date: dateLabel(slip.paid_at, lang) }) : slip.pay_group?.name}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{amount(slip.net, slip.currency)}</span>
                    <Badge variant={RUN_STATUS[slip.status].variant}>{t(RUN_STATUS[slip.status].labelKey)}</Badge>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PayslipDialog own payslipId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </div>
  );
}
