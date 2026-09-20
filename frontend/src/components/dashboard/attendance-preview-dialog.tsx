"use client";

import { ExternalLink } from "lucide-react";
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
import { AttendanceEvent, AttendanceSession } from "@/lib/api";

const METHOD_LABELS: Record<NonNullable<AttendanceEvent["method"]>, string> = {
  qr: "QR scan",
  gps: "GPS",
  correction: "Approved correction",
  none: "Not verified",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

type MapPoint = { lat: number; lng: number; caption: string };

/**
 * What to pin on the map: the device's own GPS reading when it sent one,
 * otherwise the work location's coordinates so the admin still sees where
 * the check-in was supposed to be.
 */
function mapPointFor(event: AttendanceEvent): MapPoint | null {
  if (event.latitude != null && event.longitude != null) {
    return {
      lat: Number(event.latitude),
      lng: Number(event.longitude),
      caption: "Where the employee's device was",
    };
  }

  const location = event.work_location;
  if (location?.latitude != null && location?.longitude != null) {
    return {
      lat: Number(location.latitude),
      lng: Number(location.longitude),
      caption: `${location.name} (branch location — the device sent no GPS)`,
    };
  }

  return null;
}

function EventMap({ point }: { point: MapPoint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <iframe
        title={point.caption}
        src={`https://www.google.com/maps?q=${point.lat},${point.lng}&z=17&output=embed`}
        className="h-48 w-full rounded-md border border-border"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
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
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function EventDetails({ title, event }: { title: string; event: AttendanceEvent | null }) {
  if (!event) {
    return (
      <section className="rounded-md border border-border p-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Not recorded yet.</p>
      </section>
    );
  }

  const hasGps = event.latitude != null && event.longitude != null;
  const mapPoint = mapPointFor(event);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {event.method && <Badge variant="outline">{METHOD_LABELS[event.method]}</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Field label="Time">{formatDateTime(event.event_time)}</Field>
        <Field label="Location">
          {event.work_location ? (
            <>
              {event.work_location.name}
              {event.work_location.address && (
                <span className="block text-xs text-muted-foreground">{event.work_location.address}</span>
              )}
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Distance from location">
          {event.distance_meters != null ? `${event.distance_meters} m` : "No GPS to compare"}
        </Field>
        <Field label="Device GPS">
          {hasGps ? `${Number(event.latitude).toFixed(5)}, ${Number(event.longitude).toFixed(5)}` : "Not sent"}
        </Field>
        {event.device_id && <Field label="Device">{event.device_id}</Field>}
        {event.recorded_by && <Field label="Recorded by">{event.recorded_by.name}</Field>}
        {event.notes && (
          <div className="col-span-2">
            <Field label="Notes">{event.notes}</Field>
          </div>
        )}
      </dl>
      {mapPoint && <EventMap point={mapPoint} />}
    </section>
  );
}

export function AttendancePreviewDialog({
  session,
  onOpenChange,
}: {
  session: AttendanceSession | null;
  onOpenChange: (open: boolean) => void;
}) {
  const shift = session?.schedule?.shift;

  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{session?.employee.name}</DialogTitle>
          <DialogDescription>{session?.date}</DialogDescription>
        </DialogHeader>

        {session && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Status">
                <Badge
                  variant={
                    session.status === "completed"
                        ? "success"
                        : session.status === "missing_checkout"
                          ? "destructive"
                          : "info"
                  }
                >
                  {session.status.replace("_", " ")}
                </Badge>
              </Field>
              <Field label="Worked">{formatMinutes(session.worked_minutes)}</Field>
              <Field label="Late">{session.late_minutes > 0 ? `${session.late_minutes} min` : "On time"}</Field>
              <Field label="Branch">{session.employee.branch?.name ?? "—"}</Field>
              <Field label="Job title">{session.employee.job_title ?? "—"}</Field>
              <Field label="Shift">
                {shift ? `${shift.name} (${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)})` : "No shift scheduled"}
              </Field>
            </dl>

            <EventDetails title="Check in" event={session.check_in_event} />
            <EventDetails title="Check out" event={session.check_out_event} />
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
