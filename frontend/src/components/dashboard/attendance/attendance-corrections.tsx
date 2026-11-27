"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, CheckCircle2, Clock, FileEdit, MessageSquareText, Plus, X, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ExcelActions } from "@/components/dashboard/excel/excel-actions";
import { useMe } from "@/contexts/me-context";
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { cn } from "@/lib/utils";
import { displayOrderColumn } from "@/components/dashboard/shared/display-order";
import { PHONE_SHEET, SheetHandle } from "@/components/dashboard/shared/phone-sheet";
import { monthBounds, MonthBar } from "@/components/dashboard/schedules/calendar-shared";
import { api, ApiError, AttendanceCorrection } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { attendanceImport, exportCorrections } from "@/lib/excel/specs/time";
import { dateOnly } from "@/lib/date";
import { notifyError, notifySuccess } from "@/lib/notify";
import { dateLocale, useLang, useT, type Lang } from "@/lib/i18n";

// Labels are common.status.<key>.
const STATUS = {
  pending: { variant: "warning", dot: "bg-warning" },
  approved: { variant: "success", dot: "bg-success" },
  rejected: { variant: "destructive", dot: "bg-destructive" },
  cancelled: { variant: "secondary", dot: "bg-muted-foreground" },
} as const;

/** The two dates people look for first: the day that went wrong (red) and when it was reported (green). */
const TONE = { missed: "text-destructive", requested: "text-success" } as const;

/** The status as a soft pill with a coloured dot — the same everywhere on this tab. */
function StatusPill({ status }: { status: AttendanceCorrection["status"] }) {
  const t = useT();
  return (
    <Badge variant={STATUS[status].variant} className="gap-1.5">
      <span className={cn("size-1.5 rounded-full", STATUS[status].dot)} />
      {t(`common.status.${status}`)}
    </Badge>
  );
}

/** One label / value line in the grouped list, like a row in a phone's Settings screen. */
function DetailRow({
  icon: IconCmp,
  label,
  tone,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Colours the icon and value: red for the missed day, green for when it was asked. */
  tone?: "missed" | "requested";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <IconCmp className={cn("mt-0.5 size-4 shrink-0", tone ? TONE[tone] : "text-muted-foreground")} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={cn("text-sm font-medium", tone && TONE[tone])}>{children}</div>
      </div>
    </div>
  );
}

/** A step in the request's history: filled dot when it happened, hollow while waiting. */
function TimelineStep({
  title,
  time,
  note,
  dot,
  last,
  waiting,
}: {
  title: string;
  time?: string;
  note?: string | null;
  dot: string;
  last?: boolean;
  waiting?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span className="absolute top-3 left-[5px] h-full w-px bg-border" aria-hidden />}
      <span
        className={cn("relative mt-1 size-[11px] shrink-0 rounded-full", waiting ? "border-2 border-dashed border-muted-foreground/60 bg-background" : dot)}
        aria-hidden
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-sm", waiting ? "text-muted-foreground" : "font-medium")}>{title}</span>
        {time && <span className="text-xs tabular-nums text-muted-foreground">{time}</span>}
        {note && <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground/90">“{note}”</p>}
      </div>
    </li>
  );
}

/**
 * One correction with what can be done to it — a bottom sheet on phones, a
 * card on wider screens. Every decision can carry a remark the employee
 * reads: optional when approving, required when rejecting or when a manager
 * cancels someone else's.
 */
function CorrectionReviewDialog({
  correction,
  canManage,
  isOwn,
  onClose,
  onDone,
}: {
  correction: AttendanceCorrection | null;
  canManage: boolean;
  isOwn: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [remark, setRemark] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  // What the sheet shows. It keeps the last correction while the sheet slides
  // away — clearing it at once would empty the box mid-animation (a visible
  // jump) — and lets go only when the close animation has finished.
  const [shown, setShown] = useState(correction);
  if (correction && correction !== shown) setShown(correction);
  const c = shown;
  const pending = c?.status === "pending";
  const canDecide = canManage && pending && !isOwn;
  const canCancel = pending && (isOwn || canManage);
  const remarkRequiredToCancel = canCancel && !isOwn;

  async function act(action: "approve" | "reject" | "cancel") {
    if (!c) return;
    const text = remark.trim();
    if (!text && (action === "reject" || (action === "cancel" && remarkRequiredToCancel))) {
      setMissing(true);
      return;
    }
    setBusy(true);
    try {
      if (action === "approve") await api.attendanceCorrections.approve(c.id, text);
      else if (action === "reject") await api.attendanceCorrections.reject(c.id, text);
      else await api.attendanceCorrections.cancel(c.id, text);
      notifySuccess(
        action === "approve"
          ? t("attendance.corrections.approved")
          : action === "reject"
            ? t("attendance.corrections.rejected")
            : t("attendance.corrections.cancelled"),
        action === "approve" ? t("attendance.corrections.approvedHint") : undefined,
      );
      onClose();
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={correction !== null}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => {
        if (open) return;
        setShown(null);
        setRemark("");
        setMissing(false);
      }}
    >
      <DialogContent
        // Phones: a sheet that slides up from the bottom edge, like a native app.
        className={cn("gap-0 p-0 sm:max-w-md", PHONE_SHEET)}
      >
        {c && (
          <>
            <SheetHandle />

            <div className="flex flex-col gap-5 overflow-y-auto px-5 pt-4 pb-5 sm:pt-5">
              {/* Who, and where the request stands. */}
              <div className="flex items-center gap-3 pr-8">
                <EmployeeAvatar name={c.employee.name} photoUrl={c.employee.photo_url} className="size-12 text-sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <DialogTitle className="truncate text-base font-semibold">{c.employee.name}</DialogTitle>
                  <DialogDescription className="truncate text-xs">
                    {[t("attendance.corrections.title"), c.employee.job_title].filter(Boolean).join(" · ")}
                  </DialogDescription>
                </div>
                <StatusPill status={c.status} />
              </div>

              {/* The request itself, as a grouped list. */}
              <div className="divide-y overflow-hidden rounded-2xl border bg-muted/30">
                <DetailRow icon={CalendarX} label={t("attendance.corrections.colMissedDay")} tone="missed">
                  {formatMissedDay(c.date, lang, "long")}
                </DetailRow>
                <DetailRow icon={CalendarCheck} label={t("attendance.corrections.colRequestedOn")} tone="requested">
                  <span className="tabular-nums">{formatMoment(c.created_at, lang)}</span>
                </DetailRow>
                <DetailRow icon={Clock} label={t("attendance.corrections.colScans")}>
                  <ScanChips times={c.requested_times} lang={lang} />
                </DetailRow>
                <DetailRow icon={MessageSquareText} label={t("common.field.reason")}>
                  <span className="font-normal leading-relaxed">{c.reason}</span>
                </DetailRow>
              </div>

              {/* What happened, in order. */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("attendance.corrections.activity")}</h3>
                <ol className="flex flex-col">
                  <TimelineStep
                    title={t("attendance.corrections.requestedBy", { name: c.requested_by?.name ?? c.employee.name })}
                    time={formatMoment(c.created_at, lang)}
                    dot="bg-success"
                  />
                  {pending ? (
                    <TimelineStep title={t("attendance.corrections.waiting")} waiting dot="" last />
                  ) : (
                    <TimelineStep
                      title={
                        c.reviewed_by
                          ? t("attendance.corrections.decidedBy", { status: t(`common.status.${c.status}`), name: c.reviewed_by.name })
                          : t(`common.status.${c.status}`)
                      }
                      time={c.reviewed_at ? formatMoment(c.reviewed_at, lang) : undefined}
                      note={c.review_notes}
                      dot={STATUS[c.status].dot}
                      last
                    />
                  )}
                </ol>
              </div>

              {(canDecide || canCancel) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="correction-remark" className="text-xs text-muted-foreground">
                    {canDecide ? t("attendance.corrections.remark") : isOwn ? t("attendance.corrections.reasonOptional") : t("attendance.corrections.remark")}
                  </Label>
                  <Textarea
                    id="correction-remark"
                    value={remark}
                    onChange={(e) => {
                      setRemark(e.target.value);
                      setMissing(false);
                    }}
                    maxLength={500}
                    rows={2}
                    aria-invalid={missing}
                    className="rounded-xl"
                    placeholder={canDecide ? t("attendance.corrections.remarkPlaceholder") : ""}
                  />
                  {missing && <p className="text-xs text-destructive">{t("attendance.corrections.remarkMissing")}</p>}
                </div>
              )}
            </div>

            {/* Big, thumb-friendly actions pinned to the bottom. */}
            {(canDecide || canCancel) && (
              <div className="flex flex-col gap-2 border-t bg-muted/30 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {canDecide && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="lg" className="h-11 rounded-xl text-destructive hover:text-destructive" onClick={() => act("reject")} disabled={busy}>
                      <XCircle className="size-4" />
                      {t("common.action.reject")}
                    </Button>
                    <Button size="lg" className="h-11 rounded-xl" onClick={() => act("approve")} disabled={busy}>
                      <CheckCircle2 className="size-4" />
                      {t("common.action.approve")}
                    </Button>
                  </div>
                )}
                {canCancel && (
                  <Button
                    variant={canDecide ? "ghost" : "outline"}
                    size="lg"
                    className={cn("h-11 rounded-xl", canDecide && "text-muted-foreground")}
                    onClick={() => act("cancel")}
                    disabled={busy}
                  >
                    {t("attendance.corrections.cancelRequest")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The scan times as small clock chips: "08:00" "17:30". */
function ScanChips({ times, lang }: { times: string[]; lang: Lang }) {
  if (times.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {times.map((time) => (
        <span key={time} className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-border">
          {formatTime(time, lang)}
        </span>
      ))}
    </div>
  );
}

/** The day being corrected, e.g. "Mon, 5 Oct 2026". A date column, so no timezone shift. */
function formatMissedDay(date: string, lang: Lang, style: "short" | "long" = "short"): string {
  return new Date(dateOnly(date) + "T00:00:00").toLocaleDateString(dateLocale(lang), {
    weekday: style,
    day: "numeric",
    month: style,
    year: "numeric",
  });
}

/** Just the date part of a moment, on the viewer's clock: "4 Nov 2026". */
function formatMomentDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" });
}

/** A moment (when it was asked for or decided) on the viewer's clock, e.g. "6 Oct 2026, 08:15". */
function formatMoment(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });
}

/**
 * The typed times as wall-clock datetimes on the chosen date, in order. A time
 * earlier than the one before it is the next morning (a night shift's OUT).
 */
function scansFor(date: string, times: string[]): string[] {
  let day = date;
  let previous = "";
  return times
    .filter(Boolean)
    .map((time) => {
      if (previous && time <= previous) {
        const next = new Date(`${day}T00:00:00`);
        next.setDate(next.getDate() + 1);
        day = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      }
      previous = time;
      return `${day}T${time}`;
    });
}

/** The Corrections tab on the Attendance page: request a missed scan, and (managers) review requests. */
/** initialStatus: start filtered, e.g. "pending" when opened from the dashboard. */
export function AttendanceCorrections({
  month,
  onMonthChange,
  onChanged,
  initialStatus,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  onChanged?: () => void;
  initialStatus?: string;
}) {
  const t = useT();
  const lang = useLang();
  const { me } = useMe();
  // Kept with the month it answers; a different month means it is still loading.
  const [result, setResult] = useState<{ month: string; data: AttendanceCorrection[] } | null>(null);
  const corrections = result?.month === month ? result.data : null;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  // The scans to add, as HH:MM on the chosen date (a time earlier than the one before is the next morning).
  const [times, setTimes] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.attendanceCorrections
      .all(monthBounds(month))
      .then((data) => setResult({ month, data }))
      .catch(() => setResult({ month, data: [] }));
  }

  useEffect(() => {
    load();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  // A review also changes the page's pending count, so the page reloads too.
  function reload() {
    load();
    onChanged?.();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.attendanceCorrections.create({ date, reason, scans: scansFor(date, times) });
      notifySuccess(t("attendance.corrections.requested"), t("attendance.corrections.requestedHint"));
      setDate("");
      setReason("");
      setTimes([""]);
      setOpen(false);
      reload();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  const canManage = me?.permissions.includes("attendance.manage") ?? false;
  const [reviewing, setReviewing] = useState<AttendanceCorrection | null>(null);
  const isOwn = (c: AttendanceCorrection) => c.employee.id === me?.employee?.id || c.requested_by?.id === me?.user.id;

  // Every cell is two quiet lines at most: the fact, then a muted detail under it.
  const columns: DataTableColumn<AttendanceCorrection>[] = [
    ...(canManage
      ? [
          {
            id: "employee",
            header: t("common.field.employee"),
            primary: true,
            cell: (c: AttendanceCorrection) => (
              <div className="flex items-center gap-2.5">
                <EmployeeAvatar name={c.employee.name} photoUrl={c.employee.photo_url} className="size-8 text-[11px]" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{c.employee.name}</span>
                  {c.employee.job_title && <span className="truncate text-xs text-muted-foreground">{c.employee.job_title}</span>}
                </div>
              </div>
            ),
            sortValue: (c: AttendanceCorrection) => c.employee.name,
            searchValue: (c: AttendanceCorrection) => c.employee.name,
          },
          displayOrderColumn<AttendanceCorrection>((c) => c.employee.sort_order),
        ]
      : []),
    {
      id: "date",
      header: t("attendance.corrections.colMissedDay"),
      primary: !canManage,
      className: "whitespace-nowrap",
      cell: (c) => {
        const day = new Date(dateOnly(c.date) + "T00:00:00");
        return (
          <div className="flex flex-col">
            <span className={cn("font-medium", TONE.missed)}>{day.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" })}</span>
            <span className="text-xs text-muted-foreground">{day.toLocaleDateString(dateLocale(lang), { weekday: "long" })}</span>
          </div>
        );
      },
      sortValue: (c) => dateOnly(c.date),
    },
    {
      id: "requested_at",
      header: t("attendance.corrections.colRequestedOn"),
      className: "whitespace-nowrap",
      cell: (c) => (
        <div className="flex flex-col">
          <span className={cn("font-medium", TONE.requested)}>{formatMomentDate(c.created_at, lang)}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{formatTime(c.created_at, lang)}</span>
        </div>
      ),
      sortValue: (c) => c.created_at,
    },
    {
      id: "scans",
      header: t("attendance.corrections.colScans"),
      cell: (c) => <ScanChips times={c.requested_times} lang={lang} />,
      sortValue: (c) => c.requested_times[0],
      sortLabels: [t("attendance.corrections.sortEarliest"), t("attendance.corrections.sortLatest")],
    },
    {
      id: "reason",
      header: t("common.field.reason"),
      // One line in the table (full text in the sheet); wraps on a phone card.
      className: "max-w-56",
      cell: (c) => <span className="line-clamp-1 text-muted-foreground md:block md:truncate">{c.reason}</span>,
      searchValue: (c) => c.reason,
      sortValue: (c) => c.reason,
    },
    {
      id: "status",
      header: t("common.field.status"),
      className: "whitespace-nowrap",
      cell: (c) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={c.status} />
          {c.reviewed_at && (
            <span className="text-xs text-muted-foreground">
              {[c.reviewed_by && t("attendance.corrections.reviewedBy", { name: c.reviewed_by.name }), formatMomentDate(c.reviewed_at, lang)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      ),
      sortValue: (c) => c.status,
    },
  ];

  const employeeOptions = Array.from(new Map((corrections ?? []).map((c) => [c.employee.id, c.employee.name])).entries())
    .map(([value, label]) => ({ value: String(value), label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthBar month={month} onChange={onMonthChange} />
        <div className="flex flex-wrap gap-2">
          <ExcelActions
            onExport={exportCorrections}
            // Importing files rows for other people, which only attendance managers may do.
            importSpec={me?.permissions.includes("attendance.manage") ? attendanceImport : undefined}
            onImported={reload}
          />
          {me?.employee && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button>
                    <Plus className="size-4" />
                    {t("attendance.corrections.request")}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("attendance.corrections.formTitle")}</DialogTitle>
                  <DialogDescription>{t("attendance.corrections.formDescription")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="date">{t("attendance.corrections.colMissedDay")}</Label>
                    <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t("attendance.corrections.missedScans")}</Label>
                    <p className="-mt-1 text-xs text-muted-foreground">{t("attendance.corrections.missedScansHint")}</p>
                    {times.map((time, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          required
                          aria-label={t("attendance.corrections.scanN", { n: i + 1 })}
                          value={time}
                          onChange={(e) => setTimes((all) => all.map((v, j) => (j === i ? e.target.value : v)))}
                          className="w-32"
                        />
                        {times.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("attendance.corrections.removeTime")}
                            onClick={() => setTimes((all) => all.filter((_, j) => j !== i))}
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {times.length < 8 && (
                      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setTimes((all) => [...all, ""])}>
                        <Plus className="size-3.5" />
                        {t("attendance.corrections.addTime")}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reason">{t("common.field.reason")}</Label>
                    <Input id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  {error && <Alert variant="destructive">{error}</Alert>}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
                    <Button type="submit" disabled={saving}>
                      {saving ? t("attendance.corrections.submitting") : t("attendance.corrections.submit")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* A table on desktop, stacked cards on phones. */}
      <DataTable
        data={corrections}
        getRowId={(correction) => correction.id}
        columns={columns}
        filters={[
          {
            type: "select",
            id: "status",
            label: t("common.field.status"),
            options: (Object.keys(STATUS) as (keyof typeof STATUS)[]).map((value) => ({ value, label: t(`common.status.${value}`) })),
            getValue: (correction) => correction.status,
          },
          ...(canManage
            ? [
                {
                  type: "select" as const,
                  id: "employee",
                  label: t("common.field.employee"),
                  options: employeeOptions,
                  getValue: (correction: AttendanceCorrection) => String(correction.employee.id),
                },
              ]
            : []),
          { type: "date-range", id: "date", label: t("attendance.corrections.colMissedDay"), getValue: (correction) => dateOnly(correction.date) },
        ]}
        searchPlaceholder={canManage ? t("attendance.corrections.searchManager") : t("attendance.corrections.searchOwn")}
        initialFilters={initialStatus && initialStatus in STATUS ? { status: initialStatus } : undefined}
        emptyState={{ icon: FileEdit, title: t("attendance.corrections.empty"), description: t("attendance.corrections.emptyHint") }}
        onRowClick={setReviewing}
        rowActions={(correction) =>
          correction.status === "pending" && (canManage || isOwn(correction)) ? (
            <Button variant="outline" size="sm" onClick={() => setReviewing(correction)}>
              {canManage && !isOwn(correction) ? t("attendance.corrections.review") : t("attendance.corrections.open")}
            </Button>
          ) : null
        }
      />

      <CorrectionReviewDialog
        correction={reviewing}
        canManage={canManage}
        isOwn={reviewing ? isOwn(reviewing) : false}
        onClose={() => setReviewing(null)}
        onDone={reload}
      />
    </div>
  );
}
