"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LogIn, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/contexts/me-context";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import { api, ApiError, AttendanceSession } from "@/lib/api";
import { withLocationRetry } from "@/lib/location";

type Status =
  | { kind: "scanning" }
  | { kind: "submitting" }
  | { kind: "success"; action: "check_in" | "check_out"; time: string }
  | { kind: "error"; message: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The dedicated landing page for a bookmarked "Add to Home Screen" shortcut:
 * opens straight to the camera, no navigation required. Meant to be the
 * start_url employees are taught to shortcut to on their own phone.
 */
export default function ScanPage() {
  const { me } = useMe();
  const [status, setStatus] = useState<Status>({ kind: "scanning" });
  const [openSession, setOpenSession] = useState<AttendanceSession | null>(null);
  const gpsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // The shift the server still has open — not "today's" record, so an overnight
  // shift (in before midnight, out after) still checks out. A forgotten one is
  // marked missing_checkout by the server and no longer counts.
  const isCheckingOut = openSession !== null;

  const loadOpenSession = useCallback(() => {
    api.attendance
      .list()
      .then((res) => {
        setOpenSession(res.data.find((s) => s.status === "open") ?? null);
      })
      .catch(() => {});
  }, []);

  const hasEmployee = Boolean(me?.employee);

  useEffect(() => {
    if (!hasEmployee) return;
    loadOpenSession();

    // The home-screen app can sit open in the background for hours — refresh
    // when it comes back so the next scan is treated correctly.
    const onVisible = () => {
      if (document.visibilityState === "visible") loadOpenSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hasEmployee, loadOpenSession]);

  useEffect(() => {
    if (status.kind !== "scanning") return;
    gpsRef.current = null;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
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
      const action = isCheckingOut ? "check_out" : "check_in";

      try {
        const event = await withLocationRetry(isCheckingOut ? api.attendance.checkOut : api.attendance.checkIn, {
          qr_token: token,
          ...gpsRef.current,
        });
        setStatus({ kind: "success", action, time: event.event_time });
        loadOpenSession();
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Something went wrong.",
        });
      }
    },
    [isCheckingOut, loadOpenSession],
  );

  const { videoRef, canvasRef, error: cameraError } = useQrScanner(status.kind === "scanning", handleScan);

  function scanAgain() {
    setStatus({ kind: "scanning" });
  }

  if (!me?.employee) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record, so you can&apos;t check in yourself.
        </p>
        <Link href="/dashboard/attendance" className="text-sm underline">
          Go to Attendance
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      <Link
        href="/dashboard/attendance"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white"
        aria-label="Exit scan mode"
      >
        <X className="size-5" />
      </Link>

      {(status.kind === "scanning" || status.kind === "submitting") && (
        <>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="text-lg font-medium">
              {status.kind === "submitting"
                ? "Checking…"
                : `Point your camera at the QR code to ${isCheckingOut ? "check out" : "check in"}`}
            </p>
            {cameraError && <p className="text-sm text-red-400">{cameraError}</p>}
          </div>
        </>
      )}

      {status.kind === "success" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <CheckCircle2 className="size-20 text-green-400" />
          <div>
            <p className="text-2xl font-semibold">
              {status.action === "check_in" ? "Checked in" : "Checked out"}
            </p>
            <p className="text-white/70">at {formatTime(status.time)}</p>
            {status.action === "check_in" && (
              <p className="mt-3 text-sm text-white/60">
                When you finish work, open this again and scan the same QR code to check out.
              </p>
            )}
          </div>
          <Button onClick={scanAgain} variant="secondary" size="lg" className="mt-4">
            {status.action === "check_in" ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
            Scan again
          </Button>
        </div>
      )}

      {status.kind === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium text-red-400">{status.message}</p>
          <Button onClick={scanAgain} variant="secondary" size="lg">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
