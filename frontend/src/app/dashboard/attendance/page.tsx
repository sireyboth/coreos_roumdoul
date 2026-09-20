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
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { AttendancePreviewDialog } from "@/components/dashboard/attendance-preview-dialog";
import { QrScanDialog } from "@/components/dashboard/qr-scan-dialog";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, AttendanceSession } from "@/lib/api";
import { dateOnly, isToday } from "@/lib/date";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";

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

  const todaySession = sessions?.find((s) => isToday(s.date));
  // The shift the server still has open — not just today's, so an overnight
  // shift can still be checked out of after midnight. Shifts forgotten for
  // too long become "missing_checkout" and stop counting as open.
  const openSession = sessions?.find((s) => s.status === "open");
  const myForgottenShifts = (sessions ?? []).filter(
    (s) => s.status === "missing_checkout" && s.employee.id === me?.employee?.id,
  );
  const isCheckingOut = Boolean(openSession);

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
        notifySuccess("Checked out", "Have a good rest of your day.");
      } else {
        await api.attendance.checkIn(data);
        notifySuccess("Checked in", "Your attendance has been recorded.");
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      notifyError(err);
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

  const columns: DataTableColumn<AttendanceSession>[] = [
    ...(canManage
      ? [
          {
            id: "employee",
            header: "Employee",
            primary: true,
            cell: (session: AttendanceSession) => <span className="font-medium">{session.employee.name}</span>,
            sortValue: (session: AttendanceSession) => session.employee.name,
            searchValue: (session: AttendanceSession) => session.employee.name,
          },
        ]
      : []),
    {
      id: "date",
      header: "Date",
      primary: !canManage,
      cell: (session) => dateOnly(session.date),
      sortValue: (session) => session.date,
    },
    {
      id: "location",
      header: "Location",
      cell: (session) => (
        <span className="text-muted-foreground">{session.check_in_event?.work_location?.name ?? "—"}</span>
      ),
      sortValue: (session) => session.check_in_event?.work_location?.name,
      searchValue: (session) => session.check_in_event?.work_location?.name,
    },
    {
      id: "check_in",
      header: "Check in",
      cell: (session) => (
        <span className="text-muted-foreground">{formatTime(session.check_in_event?.event_time)}</span>
      ),
      sortValue: (session) => session.check_in_event?.event_time,
    },
    {
      id: "check_out",
      header: "Check out",
      cell: (session) => (
        <span className="text-muted-foreground">{formatTime(session.check_out_event?.event_time)}</span>
      ),
      sortValue: (session) => session.check_out_event?.event_time,
    },
    {
      id: "worked",
      header: "Worked",
      cell: (session) => <span className="text-muted-foreground">{formatMinutes(session.worked_minutes)}</span>,
      sortValue: (session) => session.worked_minutes,
    },
    {
      id: "status",
      header: "Status",
      cell: (session) => (
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
      ),
      sortValue: (session) => session.status,
    },
  ];

  const employeeOptions = Array.from(
    new Map((sessions ?? []).map((session) => [session.employee.id, session.employee.name])).entries(),
  )
    .map(([value, label]) => ({ value: String(value), label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filters: DataTableFilter<AttendanceSession>[] = [
    {
      type: "select",
      id: "status",
      label: "Status",
      options: [
        { value: "open", label: "Open" },
        { value: "completed", label: "Completed" },
        { value: "missing_checkout", label: "Missing checkout" },
      ],
      getValue: (session) => session.status,
    },
    ...(canManage
      ? [
          {
            type: "select" as const,
            id: "employee",
            label: "Employee",
            options: employeeOptions,
            getValue: (session: AttendanceSession) => String(session.employee.id),
          },
        ]
      : []),
    { type: "date-range", id: "date", label: "Date", getValue: (session) => dateOnly(session.date) },
  ];

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

        {myForgottenShifts.length > 0 && (
          <Alert
            variant="warning"
            title={
              myForgottenShifts.length === 1
                ? "You forgot to check out once"
                : `You forgot to check out ${myForgottenShifts.length} times`
            }
            action={
              <Link href="/dashboard/attendance/corrections" className="text-sm font-medium underline">
                Request a correction
              </Link>
            }
          >
            No check-out was recorded on {myForgottenShifts.map((s) => dateOnly(s.date)).join(", ")}, so those hours
            aren&apos;t counted yet. Ask for a correction so your manager can fix it.
          </Alert>
        )}

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
              {(isCheckingOut || !todaySession?.check_out_event) && (
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
                {error && <Alert variant="destructive">{error}</Alert>}
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

        <DataTable
          data={sessions}
          getRowId={(session) => session.id}
          columns={columns}
          filters={filters}
          searchPlaceholder="Search by employee or location…"
          initialSort={{ columnId: "date", direction: "desc" }}
          emptyState={{
            icon: Clock,
            title: "No attendance yet",
            description: "Check-ins will show up here.",
          }}
          rowActions={(session) => (
            <Button variant="outline" size="sm" onClick={() => setPreviewSession(session)}>
              <Eye className="size-3.5" />
              Preview
            </Button>
          )}
        />
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
