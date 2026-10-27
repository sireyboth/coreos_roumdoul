"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, QrCode, X } from "lucide-react";
import { HomeButton } from "@/components/dashboard/home-button";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useMe } from "@/contexts/me-context";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import { isFreshAppLaunch } from "@/lib/app-launch";
import { api, ApiError, type AttendanceToday, type ScanResult } from "@/lib/api";
import { translateNow, useT } from "@/lib/i18n";
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
  const t = useT();
  const { me } = useMe();
  const router = useRouter();
  // Opened by a home-screen icon added before the Home page existed: go to
  // Home instead, without starting the camera (see lib/app-launch.ts). Safe to
  // read in the initializer — the layout's loader means this page never
  // renders on the server.
  const [launching] = useState(isFreshAppLaunch);
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
    if (launching) router.replace("/dashboard/home");
  }, [launching, router]);

  useEffect(() => {
    if (launching || status.kind !== "scanning") return;
    gpsRef.current = null;
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        gpsRef.current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [launching, status.kind]);

  const handleScan = useCallback(
    async (token: string) => {
      setStatus({ kind: "submitting" });
      try {
        const result = await withLocationRetry(api.attendance.scan, { qr_token: token, ...gpsRef.current });
        setStatus({ kind: "success", result });
        loadToday();
      } catch (err) {
        setStatus({ kind: "error", message: err instanceof ApiError ? err.message : translateNow("common.message.somethingWrong") });
      }
    },
    [loadToday],
  );

  const { videoRef, canvasRef, error: cameraError } = useQrScanner(!launching && status.kind === "scanning", handleScan);

  if (launching) return null;

  if (!me?.employee) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("attendance.page.noEmployee")}</p>
        <Link href="/dashboard/attendance" className="text-sm underline">
          {t("attendance.scan.goToAttendance")}
        </Link>
      </div>
    );
  }

  const next = today?.next ?? null;
  const slotName = (type: "in" | "out") => t(type === "in" ? "attendance.today.in" : "attendance.today.out");

  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      <HomeButton className="absolute top-4 left-4 z-10 md:hidden" />
      <Link href="/dashboard/attendance" className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white" aria-label={t("attendance.scan.exit")}>
        <X className="size-5" />
      </Link>

      {(status.kind === "scanning" || status.kind === "submitting") && (
        <>
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <p className="text-lg font-medium">
              {status.kind === "submitting" ? t("attendance.today.recording") : t("attendance.scan.pointCamera")}
            </p>
            {status.kind === "scanning" && next && (
              <p className="text-sm text-white/70">{t("attendance.today.next", { slot: slotName(next.type), time: clock(next.expected_at) })}</p>
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
              {status.result.slot
                ? t(status.result.slot.type === "in" ? "attendance.today.recordedIn" : "attendance.today.recordedOut")
                : t("attendance.today.recordedScan")}
            </p>
            <p className="text-white/70">{status.result.message}</p>
            {next ? (
              <p className="mt-3 text-sm text-white/60">
                {t("attendance.scan.nextThen", { slot: slotName(next.type), time: clock(next.expected_at) })}
              </p>
            ) : (
              today?.slots.length ? <p className="mt-3 text-sm text-white/60">{t("attendance.scan.allDone")}</p> : null
            )}
          </div>
          <Button onClick={() => setStatus({ kind: "scanning" })} variant="secondary" size="lg" className="mt-4">
            <QrCode className="size-4" />
            {t("attendance.scan.scanAgain")}
          </Button>
        </div>
      )}

      {status.kind === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium text-red-400">{status.message}</p>
          <Button onClick={() => setStatus({ kind: "scanning" })} variant="secondary" size="lg">
            {t("common.action.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
