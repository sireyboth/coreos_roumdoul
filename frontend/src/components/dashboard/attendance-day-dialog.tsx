"use client";

import { useState } from "react";
import { ExternalLink, PencilLine } from "lucide-react";
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
import type { AttendanceDay, DaySlot, ScanDetail } from "@/lib/api";
import { AttendanceAdjustScans } from "@/components/dashboard/attendance-adjust-scans";
import { parseDate } from "@/components/dashboard/calendar-shared";
import { clock, DAY_STATUS, EXCEPTIONS, formatMinutes, OVERTIME_TYPE } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const METHOD_LABELS: Record<string, string> = {
  qr: "QR scan",
  gps: "GPS",
  correction: "Approved correction",
  adjustment: "Adjusted by admin",
  auto: "Automatic",
  none: "Not verified",
};

const SLOT_STATUS: Record<DaySlot["status"], { label: string; className: string }> = {
  ok: { label: "On time", className: "text-success" },
  late: { label: "Late", className: "text-warning" },
  early: { label: "Early", className: "text-warning" },
  missing: { label: "Missing", className: "text-destructive" },
  pending: { label: "Not yet", className: "text-muted-foreground" },
};

type MapPoint = { lat: number; lng: number; caption: string };

/**
 * What to pin on the map: the phone's own GPS reading when it sent one,
 * otherwise the work location, so a manager still sees where the scan was
 * supposed to be.
 */
function mapPointFor(scan: ScanDetail): MapPoint | null {
  if (scan.latitude != null && scan.longitude != null) {
    return { lat: Number(scan.latitude), lng: Number(scan.longitude), caption: "Where the employee's phone was" };
  }
  const location = scan.work_location;
  if (location?.latitude != null && location?.longitude != null) {
    return {
      lat: Number(location.latitude),
      lng: Number(location.longitude),
      caption: `${location.name} (the phone sent no GPS)`,
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
  const hasGps = scan.latitude != null && scan.longitude != null;
  const point = mapPointFor(scan);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex items-center gap-1.5">
          {scan.method === "qr" && !hasGps && (
            <Badge variant="warning" title="The scan came without the phone's location, so it couldn't be checked against the branch.">
              No location
            </Badge>
          )}
          {scan.method && <Badge variant="outline">{METHOD_LABELS[scan.method] ?? scan.method}</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Field label="Location">
          {scan.work_location ? (
            <>
              {scan.work_location.name}
              {scan.work_location.address && <span className="block text-xs text-muted-foreground">{scan.work_location.address}</span>}
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Distance">{scan.distance_meters != null ? `${scan.distance_meters} m from the location` : "No GPS to compare"}</Field>
        {scan.recorded_by && <Field label="Recorded by">{scan.recorded_by.name}</Field>}
        {scan.notes && (
          <div className="col-span-2">
            <Field label="Notes">{scan.notes}</Field>
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
              Open in Google Maps
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
  const status = day ? DAY_STATUS[day.status] : null;
  // Which day is being edited, so opening another day starts in the normal view.
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = day !== null && editingId === day.id;
  // On an automatic-attendance schedule the times come from the schedule, not scans.
  const automatic = day?.scans.some((entry) => entry.method === "auto") ?? false;

  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{day?.employee?.name ?? "Attendance"}</DialogTitle>
          <DialogDescription>
            {day
              ? parseDate(day.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : ""}
            {day?.schedule ? ` · ${day.schedule}` : ""}
            {day?.holiday ? ` · ${day.holiday}` : ""}
          </DialogDescription>
        </DialogHeader>

        {day && status && (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Status">
                <Badge variant={status.tone}>{status.label}</Badge>
              </Field>
              <Field label="Worked">
                {formatMinutes(day.worked_minutes)}
                {day.scheduled_minutes > 0 && <span className="text-muted-foreground"> / {formatMinutes(day.scheduled_minutes)}</span>}
              </Field>
              <Field label="Late / early">
                {day.late_minutes || day.early_leave_minutes
                  ? [day.late_minutes && `${day.late_minutes}m late`, day.early_leave_minutes && `${day.early_leave_minutes}m early`].filter(Boolean).join(", ")
                  : "On time"}
              </Field>
              <Field label="Overtime">
                {day.overtime_minutes > 0 ? (
                  <span className="flex flex-col">
                    <span>
                      {formatMinutes(day.overtime_minutes)}
                      {day.overtime_type && <span className="text-muted-foreground"> · {OVERTIME_TYPE[day.overtime_type]}</span>}
                    </span>
                    {day.overtime_status && <span className="text-xs capitalize text-muted-foreground">{day.overtime_status}</span>}
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
                    {EXCEPTIONS[code].label}
                  </Badge>
                ))}
              </div>
            )}

            {day.slots.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Expected and actual</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Scan</th>
                        <th className="px-3 py-2 text-left font-medium">Expected</th>
                        <th className="px-3 py-2 text-left font-medium">Actual</th>
                        <th className="px-3 py-2 text-left font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {day.slots.map((slot) => (
                        <tr key={slot.sequence}>
                          <td className="px-3 py-2">
                            <span className={cn("font-semibold", slot.type === "in" ? "text-success" : "text-destructive")}>{slot.type.toUpperCase()}</span>{" "}
                            <span className="text-muted-foreground">#{slot.sequence}</span>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{clock(slot.expected_at)}</td>
                          <td className="px-3 py-2 tabular-nums">{clock(slot.actual_at)}</td>
                          <td className={cn("px-3 py-2", SLOT_STATUS[slot.status].className)}>
                            {SLOT_STATUS[slot.status].label}
                            {slot.late_minutes > 0 && ` · ${slot.late_minutes}m`}
                            {slot.early_minutes > 0 && ` · ${slot.early_minutes}m`}
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
                <h3 className="text-sm font-semibold">Adjusted by an admin</h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {day.adjustments.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{a.by ?? "Deleted user"}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {new Date(a.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <span className="tabular-nums">{a.changes}</span>
                      <span className="text-xs text-muted-foreground">Reason: {a.reason}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {automatic && (
              <p className="text-sm text-muted-foreground">
                Recorded automatically from the schedule — this person doesn&apos;t need to scan.
              </p>
            )}

            {!editing && !automatic && day.scans.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Scans ({day.scans.length})</h3>
                {day.scans.map(
                  (entry, i) =>
                    entry.scan && (
                      <ScanCard
                        key={entry.scan_id}
                        title={`${i + 1}. ${entry.role === "extra" ? "Extra scan" : entry.role.toUpperCase()} at ${clock(entry.at)}`}
                        scan={entry.scan}
                      />
                    ),
                )}
              </section>
            )}

            {!editing && day.scans.length === 0 && <p className="text-sm text-muted-foreground">No scans on this day.</p>}
          </div>
        )}

        <DialogFooter>
          {canManage && day?.employee && !editing && !automatic && (
            <Button type="button" variant="outline" onClick={() => setEditingId(day.id)}>
              <PencilLine className="size-4" />
              Adjust scans
            </Button>
          )}
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
