"use client";

import { useState } from "react";
import { Check, Hourglass, Scissors, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { monthBounds, MonthBar, parseDate } from "@/components/dashboard/schedules/calendar-shared";
import { displayOrderColumn } from "@/components/dashboard/shared/display-order";
import { useApi } from "@/hooks/use-api";
import { api, type OvertimeEntry } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatMinutes, OVERTIME_TYPE } from "@/lib/schedule";
import { dateLocale, useLang, useT, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Status = OvertimeEntry["overtime_status"];

const STATUS_TABS: { id: Status; label: TKey }[] = [
  { id: "pending", label: "attendance.overtime.tabPending" },
  { id: "approved", label: "common.status.approved" },
  { id: "rejected", label: "common.status.rejected" },
];

/**
 * Overtime that a schedule says needs a manager's approval. Only approved
 * overtime reaches the monthly summary payroll reads. If a day's overtime
 * changes afterwards (e.g. a correction), it comes back here for review.
 */
export function OvertimeReview({ month, onMonthChange, onChanged }: { month: string; onMonthChange: (month: string) => void; onChanged?: () => void }) {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<Status>("pending");
  const { data, error, reload } = useApi(() => api.attendance.overtime({ status, ...monthBounds(month) }), [status, month]);
  const entries = data ?? (error ? [] : null);
  const [busy, setBusy] = useState<number | null>(null);
  const [partOf, setPartOf] = useState<OvertimeEntry | null>(null);

  /** minutes: approve only part of the overtime; left out = all of it. */
  async function review(entry: OvertimeEntry, decision: "approve" | "reject", minutes?: number): Promise<boolean> {
    setBusy(entry.id);
    try {
      if (decision === "approve") await api.attendance.approveOvertime(entry.id, minutes);
      else await api.attendance.rejectOvertime(entry.id);
      notifySuccess(
        decision === "approve" ? t("attendance.overtime.approved") : t("attendance.overtime.rejected"),
        t("attendance.overtime.decisionDetail", {
          name: entry.employee.name,
          time: formatMinutes(minutes ?? entry.overtime_minutes, lang),
          date: parseDate(entry.date).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" }),
        }),
      );
      reload();
      onChanged?.();
      return true;
    } catch (err) {
      notifyError(err);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const columns: DataTableColumn<OvertimeEntry>[] = [
    {
      id: "employee",
      header: t("common.field.employee"),
      primary: true,
      cell: (e) => (
        <div className="flex flex-col">
          <span className="font-medium">{e.employee.name}</span>
          {e.employee.employee_code && <span className="text-xs text-muted-foreground">{e.employee.employee_code}</span>}
        </div>
      ),
      sortValue: (e) => e.employee.name,
      searchValue: (e) => [e.employee.name, e.employee.employee_code].filter(Boolean).join(" "),
    },
    displayOrderColumn<OvertimeEntry>((e) => e.employee.sort_order),
    {
      id: "date",
      header: t("common.field.date"),
      cell: (e) => parseDate(e.date).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "numeric", month: "short" }),
      sortValue: (e) => e.date,
    },
    {
      id: "overtime",
      header: t("attendance.overtime.colOvertime"),
      cell: (e) => (
        <div className="flex flex-col">
          {e.overtime_approved_minutes !== null ? (
            // Approved in part: what is paid, and what was worked.
            <span className="tabular-nums">
              <span className="font-semibold">{formatMinutes(e.overtime_approved_minutes, lang)}</span>{" "}
              <span className="text-xs text-muted-foreground">{t("attendance.overtime.ofWorked", { worked: formatMinutes(e.overtime_minutes, lang) })}</span>
            </span>
          ) : (
            <span className="font-semibold tabular-nums">{formatMinutes(e.overtime_minutes, lang)}</span>
          )}
          <span className="text-xs text-muted-foreground">{t(`attendance.status.overtimeType.${e.overtime_type}`)}</span>
        </div>
      ),
      sortValue: (e) => e.overtime_minutes,
    },
    {
      id: "worked",
      header: t("attendance.overtime.colWorked"),
      cell: (e) => (
        <span className="tabular-nums text-muted-foreground">
          {formatMinutes(e.worked_minutes, lang)} / {e.scheduled_minutes > 0 ? formatMinutes(e.scheduled_minutes, lang) : "—"}
        </span>
      ),
      hideOnMobile: true,
      sortValue: (e) => e.worked_minutes,
    },
    {
      id: "schedule",
      header: t("attendance.overtime.colSchedule"),
      cell: (e) => <span className="text-muted-foreground">{e.schedule ?? "—"}</span>,
      hideOnMobile: true,
      sortValue: (e) => e.schedule,
    },
    ...(status !== "pending"
      ? [
          {
            id: "reviewed",
            header: t("attendance.overtime.colReviewedBy"),
            cell: (e: OvertimeEntry) => <span className="text-muted-foreground">{e.reviewed_by?.name ?? t("attendance.overtime.automatic")}</span>,
            sortValue: (e: OvertimeEntry) => e.reviewed_by?.name ?? t("attendance.overtime.automatic"),
          },
        ]
      : []),
  ];

  const employeeOptions = Array.from(new Map((entries ?? []).map((e) => [e.employee.id, e.employee.name])).entries())
    .map(([value, label]) => ({ value: String(value), label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filters: DataTableFilter<OvertimeEntry>[] = [
    {
      type: "select",
      id: "type",
      label: t("common.field.type"),
      options: (Object.keys(OVERTIME_TYPE) as OvertimeEntry["overtime_type"][]).map((value) => ({
        value,
        label: t(`attendance.status.overtimeType.${value}`),
      })),
      getValue: (e) => e.overtime_type,
    },
    { type: "select", id: "employee", label: t("common.field.employee"), options: employeeOptions, getValue: (e) => String(e.employee.id) },
    { type: "date-range", id: "date", label: t("common.field.date"), getValue: (e) => e.date },
  ];

  return (
    <div className="flex flex-col gap-4">
      <MonthBar month={month} onChange={onMonthChange} />

      <div className="inline-flex self-start rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={status === tab.id}
            onClick={() => setStatus(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              status === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <DataTable
        data={entries}
        getRowId={(e) => e.id}
        columns={columns}
        filters={filters}
        searchPlaceholder={t("attendance.overtime.searchPlaceholder")}
        emptyState={{
          icon: Hourglass,
          title:
            status === "pending"
              ? t("attendance.overtime.emptyPending")
              : status === "approved"
                ? t("attendance.overtime.emptyApproved")
                : t("attendance.overtime.emptyRejected"),
          description: status === "pending" ? t("attendance.overtime.emptyPendingHint") : t("attendance.overtime.emptyReviewedHint"),
        }}
        rowActions={(e) =>
          e.overtime_status === "pending" ? (
            <>
              <Button size="sm" onClick={() => review(e, "approve")} disabled={busy === e.id}>
                <Check className="size-3.5" />
                {t("common.action.approve")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPartOf(e)} disabled={busy === e.id}>
                <Scissors className="size-3.5" />
                {t("attendance.overtime.approvePart")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => review(e, "reject")} disabled={busy === e.id}>
                <X className="size-3.5" />
                {t("common.action.reject")}
              </Button>
            </>
          ) : (
            <Badge variant={e.overtime_status === "approved" ? "success" : "secondary"}>
              {e.overtime_approved_minutes !== null ? t("attendance.overtime.approvedPart") : t(`common.status.${e.overtime_status}`)}
            </Badge>
          )
        }
      />

      {partOf && (
        <ApprovePartDialog
          key={partOf.id}
          entry={partOf}
          busy={busy === partOf.id}
          onOpenChange={(open) => !open && setPartOf(null)}
          onApprove={async (minutes) => {
            if (await review(partOf, "approve", minutes)) setPartOf(null);
          }}
        />
      )}
    </div>
  );
}

/** Approve fewer hours than were worked, e.g. 2 h of 3.5 h. Only the approved hours are paid. */
function ApprovePartDialog({ entry, busy, onOpenChange, onApprove }: { entry: OvertimeEntry; busy: boolean; onOpenChange: (open: boolean) => void; onApprove: (minutes: number) => void }) {
  const t = useT();
  const lang = useLang();
  const worked = entry.overtime_minutes;
  const [hours, setHours] = useState(String(Math.floor(worked / 60)));
  const [minutes, setMinutes] = useState(String(worked % 60));
  const h = Number(hours || 0);
  const m = Number(minutes || 0);
  // Whole hours and minutes, minutes under 60, nothing negative: anything else can't be sent.
  const wellFormed = Number.isInteger(h) && Number.isInteger(m) && h >= 0 && m >= 0 && m < 60;
  const total = wellFormed ? h * 60 + m : 0;
  const tooMuch = total > worked;
  const valid = wellFormed && total >= 1 && !tooMuch;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (valid) onApprove(total);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("attendance.overtime.partTitle")}</DialogTitle>
            <DialogDescription>
              {t("attendance.overtime.partText", {
                name: entry.employee.name,
                worked: formatMinutes(worked, lang),
                date: parseDate(entry.date).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "numeric", month: "short" }),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ot-part-hours">{t("attendance.overtime.partHours")}</Label>
              <Input id="ot-part-hours" type="number" inputMode="numeric" min={0} step={1} value={hours} onChange={(ev) => setHours(ev.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ot-part-minutes">{t("attendance.overtime.partMinutes")}</Label>
              <Input id="ot-part-minutes" type="number" inputMode="numeric" min={0} max={59} step={5} value={minutes} onChange={(ev) => setMinutes(ev.target.value)} />
            </div>
          </div>
          <p className={cn("text-xs", tooMuch || !wellFormed ? "text-destructive" : "text-muted-foreground")}>
            {!wellFormed
              ? t("attendance.overtime.partInvalid")
              : tooMuch
              ? t("attendance.overtime.partTooMuch", { worked: formatMinutes(worked, lang) })
              : t("attendance.overtime.partHint", { approved: formatMinutes(total, lang), worked: formatMinutes(worked, lang) })}
          </p>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={!valid || busy}>
              <Check className="size-3.5" />
              {t("attendance.overtime.partApprove", { time: formatMinutes(valid ? total : 0, lang) })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
