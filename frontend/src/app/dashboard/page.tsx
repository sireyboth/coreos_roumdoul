"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  FileClock,
  Layers,
  QrCode,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { canSee, homeFor, NAV_GROUPS } from "@/components/dashboard/nav";
import { useMe } from "@/contexts/me-context";
import { api, AttendanceSession } from "@/lib/api";
import { dateOnly } from "@/lib/date";
import { cn } from "@/lib/utils";

const MODULE_LABELS: Record<string, string> = {
  attendance: "Attendance",
  hr: "HR",
  payroll: "Payroll",
  pos: "POS",
  inventory: "Inventory",
  crm: "CRM",
  accounting: "Accounting",
};

// Local calendar date as YYYY-MM-DD (toISOString would shift it to UTC).
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Kpi = {
  label: string;
  value: number | string | null;
  hint: string;
  icon: LucideIcon;
  href?: string;
  tone: string;
  soft: string;
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon;
  const body = (
    <Card className="group h-full gap-3 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
          {kpi.value === null ? (
            <Skeleton className="mt-2 h-9 w-16" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{kpi.value}</p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground">{kpi.hint}</p>
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", kpi.soft)}>
          <Icon className={cn("size-5", kpi.tone)} />
        </div>
      </CardContent>
    </Card>
  );

  return kpi.href ? (
    <Link href={kpi.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function WeekChart({ sessions }: { sessions: AttendanceSession[] | null }) {
  const days = useMemo(() => {
    const out: { key: string; label: string; count: number; today: boolean }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = isoDate(d);
      out.push({
        key,
        label: d.toLocaleDateString([], { weekday: "short" }),
        count: sessions?.filter((s) => dateOnly(s.date) === key).length ?? 0,
        today: i === 0,
      });
    }
    return out;
  }, [sessions]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="grid-cols-[1fr_auto]">
        <div>
          <CardTitle>Attendance this week</CardTitle>
          <CardDescription>Check-in sessions recorded over the last 7 days</CardDescription>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{sessions === null ? "—" : total}</p>
          <p className="text-xs text-muted-foreground">total sessions</p>
        </div>
      </CardHeader>
      <CardContent>
        {sessions === null ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="flex h-48 items-end gap-2 sm:gap-4">
            {days.map((day) => (
              <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">{day.count}</span>
                <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-muted/60">
                  <div
                    className={cn(
                      "w-full rounded-lg transition-all duration-700",
                      day.today
                        ? "bg-linear-to-t from-indigo-600 to-fuchsia-500 shadow-[0_0_20px_-4px] shadow-primary/60"
                        : "bg-linear-to-t from-indigo-500/60 to-violet-400/60",
                    )}
                    style={{ height: `${Math.max((day.count / max) * 100, day.count ? 6 : 0)}%` }}
                  />
                </div>
                <span className={cn("text-xs", day.today ? "font-semibold text-primary" : "text-muted-foreground")}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ sessions }: { sessions: AttendanceSession[] | null }) {
  const recent = useMemo(
    () => [...(sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 6),
    [sessions],
  );

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="grid-cols-[1fr_auto]">
        <div>
          <CardTitle>Recent check-ins</CardTitle>
          <CardDescription>Latest attendance activity</CardDescription>
        </div>
        <Link
          href="/dashboard/attendance"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View all <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {sessions === null &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        {sessions?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No attendance recorded yet.</p>
        )}
        {recent.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <EmployeeAvatar name={s.employee.name} photoUrl={s.employee.photo_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.employee.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {s.date} · {formatTime(s.check_in_event?.event_time)} → {formatTime(s.check_out_event?.event_time)}
              </p>
            </div>
            {s.late_minutes > 0 && <Badge variant="warning">{s.late_minutes}m late</Badge>}
            <Badge variant={s.status === "completed" ? "success" : s.status === "missing_checkout" ? "destructive" : "info"}>
              {s.status.replace("_", " ")}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { me } = useMe();
  const router = useRouter();
  const [sessions, setSessions] = useState<AttendanceSession[] | null>(null);
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [branchCount, setBranchCount] = useState<number | null>(null);
  const [pendingCorrections, setPendingCorrections] = useState<number | null>(null);

  const can = (permission: string) => me?.permissions.includes(permission) ?? false;
  const canDashboard = can("dashboard.view");
  const canAttendance = can("attendance.view") && Boolean(me?.modules.attendance);
  const canEmployees = can("employees.view");
  const canBranches = can("branches.view");

  // Roles without dashboard.view (e.g. employees) never see this page — send
  // them to the first page they can use.
  useEffect(() => {
    if (me && !canDashboard) router.replace(homeFor(me));
  }, [me, canDashboard, router]);

  useEffect(() => {
    if (!me || !canDashboard) return;

    const from = new Date();
    from.setDate(from.getDate() - 6);

    if (canAttendance) {
      api.attendance.list({ from: isoDate(from) }).then((r) => setSessions(r.data)).catch(() => setSessions([]));
      api.attendanceCorrections
        .list()
        .then((r) => setPendingCorrections(r.data.filter((c) => c.status === "pending").length))
        .catch(() => setPendingCorrections(0));
    }
    if (canEmployees) api.employees.list({ perPage: 1 }).then((r) => setEmployeeCount(r.total)).catch(() => setEmployeeCount(0));
    if (canBranches) api.branches.list().then((r) => setBranchCount(r.data.length)).catch(() => setBranchCount(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.user.id]);

  if (!me || !canDashboard) return null;

  const today = isoDate(new Date());
  const enabledModules = Object.values(me.modules).filter(Boolean).length;
  const totalModules = Object.keys(me.modules).length;
  const presentToday = sessions?.filter((s) => dateOnly(s.date) === today).length ?? null;

  const kpis: Kpi[] = [];
  if (canAttendance)
    kpis.push({
      label: "Checked in today",
      value: presentToday,
      hint: "Sessions started today",
      icon: CalendarCheck2,
      href: "/dashboard/attendance",
      tone: "text-emerald-600 dark:text-emerald-400",
      soft: "bg-emerald-500/12",
    });
  if (canEmployees)
    kpis.push({
      label: "Employees",
      value: employeeCount,
      hint: "On your team",
      icon: Users,
      href: "/dashboard/employees",
      tone: "text-violet-600 dark:text-violet-400",
      soft: "bg-violet-500/12",
    });
  if (canBranches)
    kpis.push({
      label: "Branches",
      value: branchCount,
      hint: "Active locations",
      icon: Building2,
      href: "/dashboard/branches",
      tone: "text-sky-600 dark:text-sky-400",
      soft: "bg-sky-500/12",
    });
  if (canAttendance)
    kpis.push({
      label: "Pending corrections",
      value: pendingCorrections,
      hint: "Waiting for review",
      icon: FileClock,
      href: "/dashboard/attendance/corrections",
      tone: "text-amber-600 dark:text-amber-400",
      soft: "bg-amber-500/14",
    });
  kpis.push({
    label: "Active modules",
    value: `${enabledModules}/${totalModules}`,
    hint: "Included in your plan",
    icon: Layers,
    tone: "text-fuchsia-600 dark:text-fuchsia-400",
    soft: "bg-fuchsia-500/12",
  });

  const quickLinks = NAV_GROUPS.flatMap((g) => g.items).filter((item) => item.href !== "/dashboard" && canSee(item, me));

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-indigo-500/20 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-40 size-60 rounded-full bg-cyan-300/20 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/70">
              {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting()}, {me.user.name.split(" ")[0]} 👋
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/80">
              <span className="font-medium text-white">{me.company?.name ?? "Business OS"}</span>
              {me.roles.map((role) => (
                <span key={role} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium capitalize backdrop-blur">
                  {role}
                </span>
              ))}
              {me.company?.status && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-100">
                  <span className="size-1.5 rounded-full bg-emerald-300" />
                  {me.company.status}
                </span>
              )}
            </div>
          </div>
          {canAttendance && me.employee && (
            <Button
              size="lg"
              render={<Link href="/dashboard/attendance" />}
              nativeButton={false}
              className="h-11 bg-white px-5 text-indigo-700 shadow-lg hover:bg-white/90"
            >
              <QrCode className="size-4" />
              Check in / out
            </Button>
          )}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </section>

      {/* Chart + modules */}
      <section className="grid gap-6 lg:grid-cols-3">
        {canAttendance ? (
          <WeekChart sessions={sessions} />
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick access</CardTitle>
              <CardDescription>Jump straight to what you manage</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <QuickLink key={item.href} item={item} />
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>What your plan currently grants you</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Object.entries(me.modules).map(([key, enabled]) => (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm",
                  enabled ? "border-success/25 bg-success/[0.06]" : "border-border bg-muted/50 opacity-60",
                )}
              >
                <span className="font-medium">{MODULE_LABELS[key] ?? key}</span>
                <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "On" : "Off"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Activity + quick actions */}
      <section className="grid gap-6 lg:grid-cols-3">
        {canAttendance && <RecentActivity sessions={sessions} />}

        {(canAttendance || quickLinks.length > 0) && (
          <Card className={cn(!canAttendance && "lg:col-span-3")}>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Shortcuts to your workspace</CardDescription>
            </CardHeader>
            <CardContent className={cn("grid gap-2", !canAttendance && "sm:grid-cols-2 lg:grid-cols-4")}>
              {quickLinks.map((item) => (
                <QuickLink key={item.href} item={item} compact />
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function QuickLink({ item, compact }: { item: (typeof NAV_GROUPS)[number]["items"][number]; compact?: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-background/60 transition-all hover:border-primary/40 hover:bg-accent/50 hover:shadow-sm",
        compact ? "p-2.5" : "p-3.5",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm", item.tone)}>
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{item.label}</span>
      <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
