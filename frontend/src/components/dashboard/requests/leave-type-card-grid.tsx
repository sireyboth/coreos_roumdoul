"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/dashboard/shared/status-chip";
import type { LeaveType } from "@/lib/api";
import { translate, useLang, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** A type's rules as short phrases: ["18 days a year, earned monthly", "after 12 months", "half days"]. */
export function leaveRules(lt: LeaveType, lang: Lang): string[] {
  const tr = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  return [
    lt.requires_balance && lt.yearly_days
      ? tr(lt.accrual === "monthly" ? "leave.policyPage.rules.yearlyMonthly" : "leave.policyPage.rules.yearlyJanuary", { n: lt.yearly_days })
      : tr("leave.policyPage.rules.noLimit"),
    lt.seniority_every_years && lt.seniority_extra_days
      ? tr("leave.policyPage.rules.seniority", { days: lt.seniority_extra_days, years: lt.seniority_every_years })
      : null,
    lt.eligible_after_months ? tr("leave.policyPage.rules.after", { n: lt.eligible_after_months }) : null,
    lt.allowed_during_probation ? null : tr("leave.policyPage.rules.notDuringProbation"),
    lt.counts === "calendar_days" ? tr("leave.policyPage.rules.calendarDays") : null,
    lt.max_days_per_request ? tr("leave.policyPage.rules.maxPerRequest", { n: lt.max_days_per_request }) : null,
    lt.attachment_from_days
      ? lt.attachment_from_days <= 1
        ? tr("leave.policyPage.rules.documentAlways")
        : tr("leave.policyPage.rules.documentFrom", { n: lt.attachment_from_days })
      : null,
    lt.min_notice_days ? tr("leave.policyPage.rules.notice", { n: lt.min_notice_days }) : null,
    lt.allow_half_day ? tr("leave.policyPage.rules.halfDays") : null,
    lt.gender ? tr(lt.gender === "female" ? "leave.policyPage.rules.women" : "leave.policyPage.rules.men") : null,
  ].filter((rule): rule is string => Boolean(rule));
}

/** Leave types as cards: report chip and name, pay, then every rule as a quiet chip. Click to edit. */
export function LeaveTypeCardGrid({ types, onEdit }: { types: LeaveType[]; onEdit: (type: LeaveType) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {types.map((lt) => (
        <LeaveTypeCard key={lt.id} type={lt} onEdit={onEdit} />
      ))}
    </ul>
  );
}

function LeaveTypeCard({ type: lt, onEdit }: { type: LeaveType; onEdit: (type: LeaveType) => void }) {
  const t = useT();
  const lang = useLang();
  // Pay as a soft tint: full = green, part = amber, unpaid = grey.
  const pay =
    lt.pay_percent === 0
      ? { label: t("leave.shared.unpaid"), className: "bg-muted text-muted-foreground" }
      : lt.pay_percent < 100
        ? { label: `${lt.pay_percent}%`, className: "bg-warning/12 text-warning" }
        : { label: `${lt.pay_percent}%`, className: "bg-success/12 text-success" };

  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-md", !lt.is_active && "opacity-70")}>
      <div className="flex items-start gap-3">
        {/* How this type shows everywhere; changed in Attendance → Status codes, with every other status. */}
        <StatusChip
          look={{ code: lt.report_code ?? "LV", color: lt.color ?? "violet", text: lt.text_color ?? "auto", bold: lt.bold ?? true }}
          unpaid={lt.pay_percent === 0}
          title={t("leave.policyPage.reportCode")}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{lt.name}</p>
          <p className="truncate text-sm text-muted-foreground">{lt.name_km || lt.code}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", pay.className)}>{pay.label}</span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {leaveRules(lt, lang).map((rule) => (
          <li key={rule} className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground/80">
            {rule}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", lt.is_active ? "text-success" : "text-muted-foreground")}>
          <span className={cn("size-1.5 rounded-full", lt.is_active ? "bg-success" : "bg-muted-foreground")} />
          {lt.is_active ? t("common.status.active") : t("leave.policyPage.off")}
        </span>
        <Button variant="outline" size="sm" onClick={() => onEdit(lt)}>
          <Pencil className="size-3.5" />
          {t("common.action.edit")}
        </Button>
      </div>
    </li>
  );
}
