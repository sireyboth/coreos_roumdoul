"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/contexts/me-context";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import { api, ApiError, type AttendanceToday, type ScanResult } from "@/lib/api";
import { withLocationRetry } from "@/lib/location";
import { clock } from "@/lib/schedule";

type Status =
  | { kind: "scanning" }
  | { kind: "submitting" }
  | { kind: "success"; result: ScanResult }
  | { kind: "error"; message: string };

/**
 * The dedicated landing page for a bookmarked "Add to Home Screen" shortcut:
 * opens straight to the camera, no navigation required. One scan — the
 * person's work schedule decides whether it was an IN or an OUT.
 */
export default function ScanPage() {
  const { me } = useMe();
  const [status, setStatus] = useState<Status>({ kind: "scanning" });
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const gpsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const loadToday = useCallback(() => {
    api.attendance.today().then(setToday).catch(() => {});
  }, []);

  const hasEmployee = Boolean(me?.employee);

  useEffect(() => {
    if (!hasEmployee) return;
    loadToday();

    // The home-screen app can sit open in the background for hours — refresh
    // when it comes back so "what's next" is current.
    const onVisible = () => {
      if (document.visibilityState === "visible") loadToday();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hasEmployee, loadToday]);

  useEffect(() => {
    if (status.kind !== "scanning") return;
    gpsRef.current = null;
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        gpsRef.current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [status.kind]);

  const handleScan = useCallback(
    async (token: string) => {
      setStatus({ kind: "submitting" });
      try {
        const result = await withLocationRetry(api.attendance.scan, { qr_token: token, ...gpsRef.current });
        setStatus({ kind: "success", result });
        loadToday();
      } catch (err) {
        setStatus({ kind: "error", message: err instanceof ApiError ? err.message : "Something went wrong." });
      }
    },
    [loadToday],
  );

  const { videoRef, canvasRef, error: cameraError } = useQrScanner(status.kind === "scanning", handleScan);

  if (!me?.employee) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record, so you can&apos;t scan yourself.
        </p>
        <Link href="/dashboard/attendance" className="text-sm underline">
          Go to Attendance
        </Link>
      </div>
    );
  }

  const next = today?.next ?? null;

  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      <Link href="/dashboard/attendance" className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white" aria-label="Exit scan mode">
        <X className="size-5" />
      </Link>

      {(status.kind === "scanning" || status.kind === "submitting") && (
        <>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <p className="text-lg font-medium">{status.kind === "submitting" ? "Recording…" : "Point your camera at the QR code"}</p>
            {status.kind === "scanning" && next && (
              <p className="text-sm text-white/70">
                Next: {next.type === "in" ? "IN" : "OUT"} at {clock(next.expected_at)}
              </p>
            )}
            {cameraError && <p className="text-sm text-red-400">{cameraError}</p>}
          </div>
        </>
      )}

      {status.kind === "success" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <CheckCircle2 className="size-20 text-green-400" />
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-semibold">
              {status.result.slot ? (status.result.slot.type === "in" ? "IN recorded" : "OUT recorded") : "Scan recorded"}
            </p>
            <p className="text-white/70">{status.result.message}</p>
            {next ? (
              <p className="mt-3 text-sm text-white/60">
                Next: {next.type === "in" ? "IN" : "OUT"} at {clock(next.expected_at)}. Scan the same QR code then.
              </p>
            ) : (
              today?.slots.length ? <p className="mt-3 text-sm text-white/60">That&apos;s every scan for today.</p> : null
            )}
          </div>
          <Button onClick={() => setStatus({ kind: "scanning" })} variant="secondary" size="lg" className="mt-4">
            <QrCode className="size-4" />
            Scan again
          </Button>
        </div>
      )}

      {status.kind === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium text-red-400">{status.message}</p>
          <Button onClick={() => setStatus({ kind: "scanning" })} variant="secondary" size="lg">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
