"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Eye, LogIn, LogOut, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { AttendancePreviewDialog } from "@/components/dashboard/attendance-preview-dialog";
import { QrScanDialog } from "@/components/dashboard/qr-scan-dialog";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, AttendanceSession } from "@/lib/api";

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const { me } = useMe();
  const [sessions, setSessions] = useState<AttendanceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [previewSession, setPreviewSession] = useState<AttendanceSession | null>(null);
  const scanGpsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  function load() {
    api.attendance.list().then((res) => setSessions(res.data)).catch(() => setSessions([]));
  }

  useEffect(() => {
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todaySession = sessions?.find((s) => s.date === today);
  const isCheckingOut = Boolean(todaySession?.check_in_event && !todaySession?.check_out_event);

  useEffect(() => {
    if (!scannerOpen) return;

    scanGpsRef.current = null;

    // Best-effort: captured in parallel with the camera so a successful
    // scan doesn't wait on it. If GPS is unavailable (common indoors —
    // exactly why QR exists), the scan still proceeds without it, and the
    // server simply can't enforce a radius it has no coordinates to check.
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        scanGpsRef.current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [scannerOpen]);

  async function submit(data?: { qr_token?: string; latitude?: number; longitude?: number }) {
    setError(null);
    setWorking(true);
    try {
      if (isCheckingOut) {
        await api.attendance.checkOut(data);
      } else {
        await api.attendance.checkIn(data);
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  const handleScan = useCallback(
    (token: string) => {
      setScannerOpen(false);
      submit({ qr_token: token, ...scanGpsRef.current });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCheckingOut],
  );

  function handleGps() {
    setError(null);

    if (!navigator.geolocation) {
      setError("Your browser doesn't support location — try scanning the QR code instead.");
      return;
    }

    setWorking(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        submit({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        setError("Couldn't get your location — check browser permissions, or scan the QR code instead.");
        setWorking(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const canManage = me?.permissions.includes("attendance.manage") ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Attendance"
          description={
            <Link href="/dashboard/attendance/corrections" className="hover:underline">
              Correction requests →
            </Link>
          }
        />

        {me?.employee && (
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Today</CardTitle>
              <CardDescription>
                {todaySession?.check_in_event
                  ? `Checked in at ${formatTime(todaySession.check_in_event.event_time)}`
                  : "You haven't checked in yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              {!todaySession?.check_out_event && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => setScannerOpen(true)} disabled={working} size="lg">
                    <QrCode className="size-4" />
                    Scan QR to {isCheckingOut ? "check out" : "check in"}
                  </Button>
                  <Button onClick={handleGps} disabled={working} variant="outline" size="lg">
                    {isCheckingOut ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
                    Use GPS instead
                  </Button>
                </div>
              )}
              {todaySession?.check_out_event && <Badge variant="success">Completed for today</Badge>}
              <div className="flex items-center gap-2">
                {todaySession && todaySession.late_minutes > 0 && (
                  <Badge variant="warning">{todaySession.late_minutes}m late</Badge>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Link href="/dashboard/scan" className="text-sm text-muted-foreground underline">
                Open instant-scan mode →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Set up a one-tap shortcut</CardTitle>
              <CardDescription>
                Open the link above on your phone, then use your browser&apos;s &quot;Add to Home
                Screen&quot; option. The icon it creates will open straight to the camera, ready to
                scan — no need to open the app or log in each time.
              </CardDescription>
            </CardHeader>
          </Card>
          </div>
        )}

        {!me?.employee && (
          <p className="text-sm text-muted-foreground">
            Your account isn&apos;t linked to an employee record, so you can&apos;t check in yourself.
          </p>
        )}

        {sessions === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {sessions?.length === 0 && (
          <EmptyState icon={Clock} title="No attendance yet" description="Check-ins will show up here." />
        )}

        {sessions && sessions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && <TableHead>Employee</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Worked</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  {canManage && <TableCell className="font-medium">{session.employee.name}</TableCell>}
                  <TableCell>{session.date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.check_in_event?.work_location?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTime(session.check_in_event?.event_time)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTime(session.check_out_event?.event_time)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatMinutes(session.worked_minutes)}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setPreviewSession(session)}>
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <QrScanDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} />
      <AttendancePreviewDialog
        session={previewSession}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPreviewSession(null);
        }}
      />
    </div>
  );
}
