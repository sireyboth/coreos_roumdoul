"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock3, MapPin, QrCode, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QrScanDialog } from "@/components/dashboard/qr-scan-dialog";
import { api, ApiError, type AttendanceToday } from "@/lib/api";
import { withLocationRetry } from "@/lib/location";
import { notifyError, notifySuccess } from "@/lib/notify";
import { clock, EXCEPTIONS, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<AttendanceToday["kind"], string> = {
  work: "",
  holiday: "Holiday",
  day_off: "Day off",
  weekly_off: "Your day off",
  unscheduled: "No work schedule today",
};

/**
 * The signed-in person's day: what their schedule expects, what they've
 * scanned so far, and one Scan button — the schedule decides whether a scan
 * is an IN or an OUT.
 */
export function AttendanceTodayCard({ onScanned }: { onScanned: () => void }) {
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanGps = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.attendance
      .today()
      .then((data) => {
        if (cancelled) return;
        setToday(data);
        setLoadError(false);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [reloads]);

  // Best effort, in parallel with the camera: if GPS comes, it's sent with the QR
  // scan so the branch radius can be checked; if not (common indoors), the scan
  // still goes ahead.
  useEffect(() => {
    if (!scannerOpen) return;
    scanGps.current = null;
    navigator.geolocation?.getCurrentPosition(
      (position) => (scanGps.current = { latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [scannerOpen]);

  async function submit(data: { qr_token?: string; latitude?: number; longitude?: number }) {
    setError(null);
    setMessage(null);
    setWorking(true);
    try {
      const result = await withLocationRetry(api.attendance.scan, data);
      setMessage(result.message);
      notifySuccess(result.slot ? `${result.slot.type === "in" ? "IN" : "OUT"} recorded` : "Scan recorded", result.message);
      setReloads((n) => n + 1);
      onScanned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      notifyError(err);
    } finally {
      setWorking(false);
    }
  }

  const handleQr = useCallback((token: string) => {
    setScannerOpen(false);
    submit({ qr_token: token, ...scanGps.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGps() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location — scan the QR code instead.");
      return;
    }
    setWorking(true);
    navigator.geolocation.getCurrentPosition(
      (position) => submit({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => {
        setError("Couldn't get your location — check browser permissions, or scan the QR code instead.");
        setWorking(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const next = today?.next ?? null;
  const done = today && today.slots.length > 0 && !next;
  const day = today?.day ?? null;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Today
          {today?.schedule && <Badge variant="outline">{today.schedule}</Badge>}
          {today && today.kind !== "work" && <Badge variant="secondary">{today.label ?? KIND_LABEL[today.kind]}</Badge>}
        </CardTitle>
        <CardDescription>
          {!today
            ? "Loading your day…"
            : today.auto
              ? "Your attendance is recorded automatically — no need to scan."
              : next
              ? `Next: ${next.type === "in" ? "IN" : "OUT"} at ${clock(next.expected_at)}`
              : done
                ? "Every scan for today is done."
                : today.kind === "work"
                  ? "Scan when you arrive."
                  : "Nothing is scheduled — scans today still count as worked time."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {loadError && <Alert variant="warning">Couldn&apos;t load today&apos;s schedule. You can still scan.</Alert>}

        {!today && !loadError && <Skeleton className="h-16 w-full" />}

        {today && today.slots.length > 0 && (
          <ol className="flex flex-wrap gap-2">
            {today.slots.map((slot) => {
              // An automatic slot fills itself in, so there's no "next" to scan.
              const isNext = !today.auto && next?.sequence === slot.sequence;
              const Icon = slot.actual_at ? CheckCircle2 : slot.status === "missing" ? XCircle : isNext ? Clock3 : Circle;
              return (
                <li
                  key={slot.sequence}
                  className={cn(
                    "flex min-w-24 flex-col rounded-lg border px-3 py-2",
                    isNext ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border",
                    slot.status === "missing" && "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon
                      className={cn(
                        "size-3.5",
                        slot.actual_at ? (slot.status === "ok" ? "text-success" : "text-warning") : slot.status === "missing" ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                    <span className={slot.type === "in" ? "text-success" : "text-destructive"}>{slot.type.toUpperCase()}</span>
                    <span className="tabular-nums text-muted-foreground">{clock(slot.expected_at)}</span>
                  </span>
                  <span className="mt-0.5 text-sm tabular-nums">
                    {slot.actual_at ? clock(slot.actual_at) : slot.status === "missing" ? "Missed" : isNext ? "Next" : "—"}
                    {slot.late_minutes > 0 && <span className="text-xs text-warning"> · {slot.late_minutes}m late</span>}
                    {slot.early_minutes > 0 && <span className="text-xs text-warning"> · {slot.early_minutes}m early</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {!today?.auto && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setScannerOpen(true)} disabled={working} size="lg">
              <QrCode className="size-4" />
              {working ? "Recording…" : next ? `Scan QR — ${next.type === "in" ? "IN" : "OUT"}` : "Scan QR"}
            </Button>
            <Button onClick={handleGps} disabled={working} variant="outline" size="lg">
              <MapPin className="size-4" />
              Use GPS instead
            </Button>
          </div>
        )}

        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="destructive">{error}</Alert>}

        {day && (day.worked_minutes > 0 || day.exceptions.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>Worked {formatMinutes(day.worked_minutes)}</span>
            {day.overtime_minutes > 0 && <span>· {formatMinutes(day.overtime_minutes)} overtime</span>}
            {day.exceptions.map((code) => (
              <Badge key={code} variant={EXCEPTIONS[code].tone}>
                {EXCEPTIONS[code].label}
              </Badge>
            ))}
          </div>
        )}

        {!today?.auto && (
          <Link href="/dashboard/scan" className="text-sm text-muted-foreground underline">
            Open instant-scan mode →
          </Link>
        )}
      </CardContent>

      <QrScanDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleQr} />
    </Card>
  );
}
