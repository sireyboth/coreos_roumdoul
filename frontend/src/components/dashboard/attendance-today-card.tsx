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
import { translateNow, useLang, useT } from "@/lib/i18n";
import { withLocationRetry } from "@/lib/location";
import { notifyError, notifySuccess } from "@/lib/notify";
import { clock, EXCEPTIONS, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

/**
 * The signed-in person's day: what their schedule expects, what they've
 * scanned so far, and one Scan button — the schedule decides whether a scan
 * is an IN or an OUT.
 */
export function AttendanceTodayCard({ onScanned }: { onScanned: () => void }) {
  const t = useT();
  const lang = useLang();
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
      // translateNow, not t: handleQr keeps the first render's submit.
      notifySuccess(
        translateNow(result.slot ? (result.slot.type === "in" ? "attendance.today.recordedIn" : "attendance.today.recordedOut") : "attendance.today.recordedScan"),
        result.message,
      );
      setReloads((n) => n + 1);
      onScanned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translateNow("common.message.somethingWrong"));
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
      setError(t("attendance.today.noGeolocation"));
      return;
    }
    setWorking(true);
    navigator.geolocation.getCurrentPosition(
      (position) => submit({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => {
        setError(t("attendance.today.locationFailed"));
        setWorking(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const next = today?.next ?? null;
  const done = today && today.slots.length > 0 && !next;
  const day = today?.day ?? null;
  const slotName = (type: "in" | "out") => t(type === "in" ? "attendance.today.in" : "attendance.today.out");

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t("common.time.today")}
          {today?.schedule && <Badge variant="outline">{today.schedule}</Badge>}
          {today && today.kind !== "work" && <Badge variant="secondary">{today.label ?? t(`attendance.today.kind.${today.kind}`)}</Badge>}
        </CardTitle>
        <CardDescription>
          {!today
            ? t("attendance.today.loading")
            : today.auto
              ? t("attendance.today.auto")
              : next
              ? t("attendance.today.next", { slot: slotName(next.type), time: clock(next.expected_at) })
              : done
                ? t("attendance.today.allDone")
                : today.kind === "work"
                  ? t("attendance.today.scanOnArrival")
                  : t("attendance.today.nothingScheduled")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {loadError && <Alert variant="warning">{t("attendance.today.loadFailed")}</Alert>}

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
                    <span className={slot.type === "in" ? "text-success" : "text-destructive"}>{slotName(slot.type)}</span>
                    <span className="tabular-nums text-muted-foreground">{clock(slot.expected_at)}</span>
                  </span>
                  <span className="mt-0.5 text-sm tabular-nums">
                    {slot.actual_at
                      ? clock(slot.actual_at)
                      : slot.status === "missing"
                        ? t("attendance.today.missed")
                        : isNext
                          ? t("attendance.today.nextSlot")
                          : "—"}
                    {slot.late_minutes > 0 && <span className="text-xs text-warning"> · {t("attendance.today.lateBy", { n: slot.late_minutes })}</span>}
                    {slot.early_minutes > 0 && <span className="text-xs text-warning"> · {t("attendance.today.earlyBy", { n: slot.early_minutes })}</span>}
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
              {working
                ? t("attendance.today.recording")
                : next
                  ? t("attendance.today.scanQrSlot", { slot: slotName(next.type) })
                  : t("attendance.today.scanQr")}
            </Button>
            <Button onClick={handleGps} disabled={working} variant="outline" size="lg">
              <MapPin className="size-4" />
              {t("attendance.today.useGps")}
            </Button>
          </div>
        )}

        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="destructive">{error}</Alert>}

        {day && (day.worked_minutes > 0 || day.exceptions.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{t("attendance.today.worked", { time: formatMinutes(day.worked_minutes, lang) })}</span>
            {day.overtime_minutes > 0 && <span>· {t("attendance.today.overtime", { time: formatMinutes(day.overtime_minutes, lang) })}</span>}
            {day.exceptions.map((code) => (
              <Badge key={code} variant={EXCEPTIONS[code].tone}>
                {t(`attendance.status.exception.${code}`)}
              </Badge>
            ))}
          </div>
        )}

        {!today?.auto && (
          <Link href="/dashboard/scan" className="text-sm text-muted-foreground underline">
            {t("attendance.today.openInstant")}
          </Link>
        )}
      </CardContent>

      <QrScanDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleQr} />
    </Card>
  );
}
