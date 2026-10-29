"use client";

import { useState } from "react";
import { ExternalLink, PencilLine, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type AttendanceDay, type DaySlot, type ScanDetail } from "@/lib/api";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { notifyError, notifySuccess } from "@/lib/notify";
import { AttendanceAdjustScans } from "@/components/dashboard/attendance-adjust-scans";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { clock, DAY_STATUS, EXCEPTIONS, formatMinutes } from "@/lib/schedule";
import { dateLocale, useLang, useT, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Scan methods with a label in attendance.day.method; anything else shows as sent.
const METHODS = ["qr", "gps", "correction", "adjustment", "auto", "none"];

const SLOT_STATUS: Record<DaySlot["status"], string> = {
  ok: "text-success",
  late: "text-warning",
  early: "text-warning",
  missing: "text-destructive",
  pending: "text-muted-foreground",
};

type MapPoint = { lat: number; lng: number; caption: string };

/**
 * What to pin on the map: the phone's own GPS reading when it sent one,
 * otherwise the work location, so a manager still sees where the scan was
 * supposed to be.
 */
function mapPointFor(scan: ScanDetail, t: ReturnType<typeof useT>): MapPoint | null {
  if (scan.latitude != null && scan.longitude != null) {
    return { lat: Number(scan.latitude), lng: Number(scan.longitude), caption: t("attendance.day.phoneWas") };
  }
  const location = scan.work_location;
  if (location?.latitude != null && location?.longitude != null) {
    return {
      lat: Number(location.latitude),
      lng: Number(location.longitude),
      caption: t("attendance.day.noPhoneGps", { location: location.name }),
    };
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ScanCard({ title, scan }: { title: string; scan: ScanDetail }) {
  const t = useT();
  const hasGps = scan.latitude != null && scan.longitude != null;
  const point = mapPointFor(scan, t);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex items-center gap-1.5">
          {scan.method === "qr" && !hasGps && (
            <Badge variant="warning" title={t("attendance.day.noLocationHint")}>
              {t("attendance.day.noLocation")}
            </Badge>
          )}
          {scan.method && (
            <Badge variant="outline">{METHODS.includes(scan.method) ? t(`attendance.day.method.${scan.method}` as TKey) : scan.method}</Badge>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Field label={t("attendance.day.location")}>
          {scan.work_location ? (
            <>
              {scan.work_location.name}
              {scan.work_location.address && <span className="block text-xs text-muted-foreground">{scan.work_location.address}</span>}
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label={t("attendance.day.distance")}>
          {scan.distance_meters != null ? t("attendance.day.distanceValue", { m: scan.distance_meters }) : t("attendance.day.noGpsToCompare")}
        </Field>
        {scan.recorded_by && <Field label={t("attendance.day.recordedBy")}>{scan.recorded_by.name}</Field>}
        {scan.notes && (
          <div className="col-span-2">
            <Field label={t("common.field.notes")}>{scan.notes}</Field>
          </div>
        )}
      </dl>
      {point && (
        <div className="flex flex-col gap-1.5">
          <iframe
            title={point.caption}
            src={`https://www.google.com/maps?q=${point.lat},${point.lng}&z=17&output=embed`}
            className="h-40 w-full rounded-md border border-border"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{point.caption}</p>
            <a
              href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs underline"
            >
              {t("attendance.day.openInMaps")}
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * One employee's day in full: expected next to actual, every scan, and what
 * follows from them. Someone who manages attendance can adjust the scans here.
 */
export function AttendanceDayDialog({
  day,
  onOpenChange,
  canManage = false,
  onAdjusted,
}: {
  day: AttendanceDay | null;
  onOpenChange: (open: boolean) => void;
  canManage?: boolean;
  // The recalculated day, or null when nothing is left to keep.
  onAdjusted?: (day: AttendanceDay | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  const status = day ? DAY_STATUS[day.status] : null;
  // Which day is being edited, so opening another day starts in the normal view.
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = day !== null && editingId === day.id;
  // On an automatic-attendance schedule the times come from the schedule, not scans.
  const automatic = day?.scans.some((entry) => entry.method === "auto") ?? false;
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!day) return;
    const ok = await confirm({
      title: day.employee ? t("attendance.day.deleteTitleNamed", { name: day.employee.name }) : t("attendance.day.deleteTitle"),
      description: t("attendance.day.deleteWarning"),
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await api.attendance.deleteDays([day.id]);
      notifySuccess(t("attendance.day.deleted"));
      onAdjusted?.(null);
    } catch (err) {
      notifyError(err);
    } finally {
      setDeleting(false);
    }
  }

  const roleLabel = (role: "in" | "out" | "extra") =>
    role === "extra" ? t("attendance.status.exception.extra_scan") : role === "in" ? t("attendance.day.scanIn") : t("attendance.day.scanOut");

  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{day?.employee?.name ?? t("attendance.day.title")}</DialogTitle>
          <DialogDescription>
            {day
              ? parseDate(day.date).toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : ""}
            {day?.schedule ? ` · ${day.schedule}` : ""}
            {day?.holiday ? ` · ${day.holiday}` : ""}
          </DialogDescription>
        </DialogHeader>

        {day && status && (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label={t("common.field.status")}>
                <Badge variant={status.tone}>{t(`attendance.status.day.${day.status}`)}</Badge>
              </Field>
              <Field label={t("attendance.day.worked")}>
                {formatMinutes(day.worked_minutes, lang)}
                {day.scheduled_minutes > 0 && <span className="text-muted-foreground"> / {formatMinutes(day.scheduled_minutes, lang)}</span>}
              </Field>
              <Field label={t("attendance.day.lateEarly")}>
                {day.late_minutes || day.early_leave_minutes
                  ? [
                      day.late_minutes && t("attendance.day.lateMinutes", { n: day.late_minutes }),
                      day.early_leave_minutes && t("attendance.day.earlyMinutes", { n: day.early_leave_minutes }),
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : t("attendance.day.slot.ok")}
              </Field>
              <Field label={t("attendance.day.overtime")}>
                {day.overtime_minutes > 0 ? (
                  <span className="flex flex-col">
                    <span>
                      {formatMinutes(day.overtime_minutes, lang)}
                      {day.overtime_type && <span className="text-muted-foreground"> · {t(`attendance.status.overtimeType.${day.overtime_type}`)}</span>}
                    </span>
                    {day.overtime_status && <span className="text-xs text-muted-foreground">{t(`common.status.${day.overtime_status}`)}</span>}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
            </dl>

            {day.exceptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {day.exceptions.map((code) => (
                  <Badge key={code} variant={EXCEPTIONS[code].tone}>
                    {t(`attendance.status.exception.${code}`)}
                  </Badge>
                ))}
              </div>
            )}

            {day.slots.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("attendance.day.expectedActual")}</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t("attendance.day.colScan")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("attendance.day.colExpected")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("attendance.day.colActual")}</th>
                        <th className="px-3 py-2 text-left font-medium">{t("attendance.day.colResult")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {day.slots.map((slot) => (
                        <tr key={slot.sequence}>
                          <td className="px-3 py-2">
                            <span className={cn("font-semibold", slot.type === "in" ? "text-success" : "text-destructive")}>
                              {slot.type === "in" ? t("attendance.day.scanIn") : t("attendance.day.scanOut")}
                            </span>{" "}
                            <span className="text-muted-foreground">#{slot.sequence}</span>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{clock(slot.expected_at)}</td>
                          <td className="px-3 py-2 tabular-nums">{clock(slot.actual_at)}</td>
                          <td className={cn("px-3 py-2", SLOT_STATUS[slot.status])}>
                            {t(`attendance.day.slot.${slot.status}`)}
                            {slot.late_minutes > 0 && ` · ${t("common.time.minutes", { n: slot.late_minutes })}`}
                            {slot.early_minutes > 0 && ` · ${t("common.time.minutes", { n: slot.early_minutes })}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {editing && (
              <AttendanceAdjustScans
                day={day}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  setEditingId(null);
                  onAdjusted?.(updated);
                }}
              />
            )}

            {!editing && day.adjustments.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("attendance.day.adjustedByAdmin")}</h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {day.adjustments.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{a.by ?? t("attendance.day.deletedUser")}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {new Date(a.at).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <span className="tabular-nums">{a.changes}</span>
                      <span className="text-xs text-muted-foreground">{t("attendance.day.adjustReason", { reason: a.reason })}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {automatic && <p className="text-sm text-muted-foreground">{t("attendance.day.automatic")}</p>}

            {!editing && !automatic && day.scans.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("attendance.day.scans", { n: day.scans.length })}</h3>
                {day.scans.map(
                  (entry, i) =>
                    entry.scan && (
                      <ScanCard
                        key={entry.scan_id}
                        title={t("attendance.day.scanTitle", { n: i + 1, role: roleLabel(entry.role), time: clock(entry.at) })}
                        scan={entry.scan}
                      />
                    ),
                )}
              </section>
            )}

            {!editing && day.scans.length === 0 && <p className="text-sm text-muted-foreground">{t("attendance.day.noScans")}</p>}
          </div>
        )}

        <DialogFooter>
          {canManage && day && !editing && (
            <Button type="button" variant="destructive" onClick={remove} disabled={deleting} className="sm:mr-auto">
              <Trash2 className="size-4" />
              {t("common.action.delete")}
            </Button>
          )}
          {canManage && day?.employee && !editing && !automatic && (
            <Button type="button" variant="outline" onClick={() => setEditingId(day.id)}>
              <PencilLine className="size-4" />
              {t("attendance.adjust.title")}
            </Button>
          )}
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.close")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
