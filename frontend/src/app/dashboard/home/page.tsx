"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileClock,
  QrCode,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { canSee, findNavItem, type NavItem } from "@/components/dashboard/nav";
import { useMe } from "@/contexts/me-context";
import { api, type AttendanceToday, type DashboardSummary } from "@/lib/api";
import { NAV_KM, setHomeLang, useHomeLang, useT, type HomeLang } from "@/lib/home-lang";
import { clock, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// The mobile home screen: a launcher in the style of a banking app. It only
// links to the existing pages — every feature still lives where it always has.

// Main grid, then the scrolling chip row. Labels, icons and permissions come
// from the sidebar's nav config so the two never disagree.
const GRID = [
  "/dashboard/attendance",
  "/dashboard/requests",
  "/dashboard/payroll",
  "/dashboard/calendar",
  "/dashboard/work-schedules",
  "/dashboard/employees",
  "/dashboard/id-cards",
  "/dashboard/profile",
  "/dashboard",
];
const CHIPS = [
  "/dashboard/holidays",
  "/dashboard/branches",
  "/dashboard/teams",
  "/dashboard/attendance/corrections",
  "/dashboard/audit",
];

// Shorter English names where the sidebar's label is too long for a small tile.
const SHORT_LABEL: Record<string, string> = {
  "/dashboard/requests": "Leave",
  "/dashboard/payroll": "Payroll",
  "/dashboard/work-schedules": "Schedules",
  "/dashboard": "Overview",
};

// The full dashboard sends phones here, so the Overview tile asks to stay.
const HREF_OVERRIDE: Record<string, string> = { "/dashboard": "/dashboard?view=full" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { km: "អរុណសួស្តី", en: "Good morning" };
  if (hour < 18) return { km: "ទិវាសួស្តី", en: "Good afternoon" };
  return { km: "សាយ័ណ្ហសួស្តី", en: "Good evening" };
}

function useItems(hrefs: string[]): NavItem[] {
  const { me } = useMe();
  return hrefs
    .map((href) => findNavItem(href))
    .filter((item): item is NavItem => Boolean(item && me && canSee(item, me)));
}

function itemLabel(item: NavItem, lang: HomeLang, short = true): string {
  if (lang === "km") return NAV_KM[item.href] ?? item.label;
  return (short && SHORT_LABEL[item.href]) || item.label;
}

/** Decorative geometry for the hero band: a dot grid plus concentric rings. */
function HeroPattern() {
  const id = useId();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-white" preserveAspectRatio="none">
      <defs>
        <pattern id={`${id}-dots`} width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="currentColor" opacity="0.18" />
        </pattern>
        <radialGradient id={`${id}-fade`} cx="85%" cy="10%" r="80%">
          <stop offset="0" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-dots)`} mask={`url(#${id}-mask)`} />
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        {[40, 80, 120, 160, 200].map((r, i) => (
          <circle key={r} cx="92%" cy="-10" r={r} opacity={0.22 - i * 0.035} />
        ))}
        {[60, 110].map((r) => (
          <circle key={r} cx="-20" cy="100%" r={r} opacity="0.1" />
        ))}
      </g>
    </svg>
  );
}

/** ខ្មែរ | EN switch on the hero band. */
function LangSwitch() {
  const lang = useHomeLang();
  return (
    <div role="group" aria-label="Language" className="flex shrink-0 rounded-full bg-white/15 p-0.5 text-[11px] font-semibold ring-1 ring-white/20 backdrop-blur">
      {(["km", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setHomeLang(value)}
          aria-pressed={lang === value}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            lang === value ? "bg-white text-violet-700" : "text-white/80",
          )}
        >
          {value === "km" ? "ខ្មែរ" : "EN"}
        </button>
      ))}
    </div>
  );
}

/** The floating card under the hero — the banking app's "balance". */
function HeroCard({ children, actions }: { children: React.ReactNode; actions: { href: string; label: string; icon: LucideIcon }[] }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-xl shadow-indigo-950/10 backdrop-blur dark:shadow-black/40">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative p-5">{children}</div>
      <div className="relative grid grid-cols-3 border-t border-border/70 bg-muted/40">
        {actions.map(({ href, label, icon: Icon }, i) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1.5 py-3 text-xs font-medium transition-colors active:bg-muted",
              i > 0 && "border-l border-border/70",
            )}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Icon className="size-4" />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function CardBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      {children}
    </span>
  );
}

function TodayCard() {
  const t = useT();
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.attendance
      .today()
      .then((data) => !cancelled && setToday(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const last = today?.slots.filter((s) => s.actual_at).at(-1) ?? null;
  const next = today?.next ?? null;
  const done = today?.slots.filter((s) => s.actual_at).length ?? 0;
  const total = today?.slots.length ?? 0;
  const slotName = (type: "in" | "out") => (type === "in" ? t({ km: "ចូល", en: "IN" }) : t({ km: "ចេញ", en: "OUT" }));

  const headline = !today
    ? null
    : today.kind !== "work" && !last
      ? (today.label ?? t({ km: "គ្មានកាលវិភាគការងារ", en: "No work scheduled" }))
      : last
        ? `${last.type === "in" ? t({ km: "បានចូលធ្វើការ", en: "Checked in" }) : t({ km: "បានចេញពីការងារ", en: "Checked out" })} · ${clock(last.actual_at)}`
        : t({ km: "មិនទាន់ស្កេនចូល", en: "Not checked in yet" });

  const detail = !today
    ? null
    : today.auto
      ? t({ km: "កត់ត្រាដោយស្វ័យប្រវត្តិ", en: "Recorded automatically" })
      : next
        ? t({ km: `បន្ទាប់៖ ស្កេន${slotName(next.type)} ម៉ោង ${clock(next.expected_at)}`, en: `Next ${slotName(next.type)} at ${clock(next.expected_at)}` })
        : last
          ? t({ km: "បានស្កេនគ្រប់សម្រាប់ថ្ងៃនេះ", en: "All scans done for today" })
          : today.schedule;

  const checkedIn = last?.type === "in";

  return (
    <HeroCard
      actions={[
        { href: "/dashboard/scan", label: t({ km: "ស្កេន", en: "Scan" }), icon: QrCode },
        { href: "/dashboard/requests", label: t({ km: "ស្នើសុំ", en: "Request" }), icon: Send },
        { href: "/dashboard/attendance/corrections", label: t({ km: "កែតម្រូវ", en: "Correction" }), icon: FileClock },
      ]}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardBadge>{t({ km: "ថ្ងៃនេះ", en: "Today" })}</CardBadge>
            {today?.schedule && <span className="truncate text-xs text-muted-foreground">{today.schedule}</span>}
          </div>
          {failed ? (
            <p className="mt-3 text-lg font-semibold">{t({ km: "មិនអាចផ្ទុកទិន្នន័យបានទេ", en: "Couldn't load today" })}</p>
          ) : headline === null ? (
            <Skeleton className="mt-3 h-7 w-44" />
          ) : (
            <p className="mt-3 flex items-center gap-2 text-xl font-bold tracking-tight">
              {last && (
                <span className={cn("relative flex size-2.5", checkedIn ? "text-success" : "text-muted-foreground")}>
                  {checkedIn && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
                  <span className="relative inline-flex size-2.5 rounded-full bg-current" />
                </span>
              )}
              <span className="truncate">{headline}</span>
            </p>
          )}
          {detail && <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p>}
        </div>
        {!today?.auto && (
          <Link
            href="/dashboard/scan"
            aria-label={t({ km: "ស្កេនវត្តមាន", en: "Scan attendance" })}
            className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-95"
          >
            <span aria-hidden className="absolute inset-0 rounded-2xl ring-4 ring-emerald-500/15" />
            <QrCode className="size-7" />
          </Link>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{t({ km: `បានស្កេន ${done}/${total}`, en: `${done} of ${total} scans` })}</span>
            {today?.day && today.day.worked_minutes > 0 && (
              <span>
                {t({ km: "ម៉ោងធ្វើការ", en: "Worked" })} {formatMinutes(today.day.worked_minutes)}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex gap-1">
            {today!.slots.map((slot) => (
              <span
                key={slot.sequence}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  slot.actual_at ? "bg-success" : slot.status === "missing" ? "bg-destructive/60" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </HeroCard>
  );
}

/** For accounts with no employee record (owners, admins): the team's day instead of their own. */
function TeamCard() {
  const t = useT();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.dashboard
      .summary()
      .then((data) => !cancelled && setSummary(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const att = summary?.attendance ?? null;
  const staff = summary?.employees ?? null;
  const percent = att && staff ? Math.min(100, Math.round((att.checked_in_today / staff) * 100)) : 0;

  const stats = [
    { label: t({ km: "យឺត", en: "Late" }), value: att?.late_today, tone: "text-warning" },
    { label: t({ km: "កែតម្រូវ", en: "Corrections" }), value: att?.pending_corrections, tone: "text-info" },
    { label: t({ km: "ថែមម៉ោង", en: "Overtime" }), value: att?.pending_overtime, tone: "text-primary" },
  ].filter((s) => s.value !== null && s.value !== undefined);

  return (
    <HeroCard
      actions={[
        { href: "/dashboard/attendance", label: t({ km: "វត្តមាន", en: "Attendance" }), icon: Clock3 },
        { href: "/dashboard/attendance/corrections", label: t({ km: "កែតម្រូវ", en: "Corrections" }), icon: FileClock },
        { href: "/dashboard/employees", label: t({ km: "បុគ្គលិក", en: "Employees" }), icon: Users },
      ]}
    >
      <CardBadge>{t({ km: "ក្រុមការងារថ្ងៃនេះ", en: "Team today" })}</CardBadge>
      {failed ? (
        <p className="mt-3 text-lg font-semibold">{t({ km: "មិនអាចផ្ទុកទិន្នន័យបានទេ", en: "Couldn't load today" })}</p>
      ) : !summary ? (
        <Skeleton className="mt-3 h-9 w-36" />
      ) : (
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{att?.checked_in_today ?? 0}</span>
          {staff !== null && <span className="text-lg font-medium text-muted-foreground tabular-nums">/ {staff}</span>}
          <span className="ml-1 text-sm text-muted-foreground">{t({ km: "នាក់បានចូលធ្វើការ", en: "checked in" })}</span>
        </p>
      )}
      {staff !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-[width] duration-700" style={{ width: `${percent}%` }} />
        </div>
      )}
      {stats.length > 0 && (
        <div className="mt-4 flex gap-5">
          {stats.map((s) => (
            <div key={s.label}>
              <p className={cn("text-lg font-semibold tabular-nums", s.tone)}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </HeroCard>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-[15px] font-semibold tracking-tight">{children}</h2>;
}

function Tile({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={HREF_OVERRIDE[item.href] ?? item.href}
      className="group relative flex h-28 flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-border/70 bg-card p-2 text-center shadow-sm transition-transform active:scale-95"
    >
      {/* A faint wash of the tile's own colour in the corner. */}
      <span aria-hidden className={cn("absolute -top-6 -right-6 size-16 rounded-full bg-linear-to-br opacity-10 blur-md", item.tone)} />
      <span className={cn("relative flex size-12 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md", item.tone)}>
        <span aria-hidden className="absolute inset-x-1 top-0.5 h-1/2 rounded-t-xl bg-white/20" />
        <Icon className="relative size-5.5" />
      </span>
      <span className="relative line-clamp-2 text-[13px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

function Chip({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card py-1.5 pr-4 pl-1.5 text-sm font-medium shadow-sm transition-transform active:scale-95"
    >
      <span className={cn("flex size-8 items-center justify-center rounded-full bg-linear-to-br text-white", item.tone)}>
        <Icon className="size-4" />
      </span>
      {label}
    </Link>
  );
}

/** A wide promo-style shortcut to the full-screen scanner. */
function ScanBanner() {
  const id = useId();
  const t = useT();
  return (
    <Link
      href="/dashboard/scan"
      className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600 p-5 text-white shadow-lg shadow-teal-500/20 transition-transform active:scale-[0.98]"
    >
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <pattern id={`${id}-grid`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <path d="M0 11h22" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-grid)`} />
      </svg>
      <div className="relative min-w-0 flex-1">
        <p className="text-base font-bold">{t({ km: "ស្កេនរហ័ស", en: "Instant scan" })}</p>
        <p className="mt-0.5 text-sm text-white/80">
          {t({ km: "បើកកាមេរ៉ា ហើយស្កេនចូលធ្វើការភ្លាមៗ។", en: "Open the camera and check in with one tap." })}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
          {t({ km: "បើកកាមេរ៉ា", en: "Open scanner" })}
          <ArrowRight className="size-3.5" />
        </span>
      </div>
      <div className="relative flex size-20 shrink-0 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
        <QrCode className="size-10" />
      </div>
    </Link>
  );
}

export default function MobileHomePage() {
  const { me } = useMe();
  const lang = useHomeLang();
  const t = useT();
  const grid = useItems(GRID);
  const chips = useItems(CHIPS);
  const name = me?.employee?.name ?? me?.user.name ?? "";
  const hasAttendance = Boolean(me?.modules.attendance);
  const showToday = Boolean(me?.employee) && hasAttendance;
  const showTeam = !me?.employee && hasAttendance && Boolean(me?.permissions.includes("dashboard.view"));
  const hasCard = showToday || showTeam;
  const date = new Date().toLocaleDateString(lang === "km" ? "km-KH" : [], { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto w-full max-w-md pb-6">
      {/* Hero band — always the brand gradient, in light and dark alike. */}
      <header
        className={cn(
          "relative overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 pt-5 text-white dark:from-indigo-950 dark:via-violet-950 dark:to-fuchsia-950",
          hasCard ? "pb-24" : "pb-8",
          "sm:mt-4 sm:rounded-3xl",
        )}
      >
        <HeroPattern />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-fuchsia-400/30 blur-3xl dark:bg-fuchsia-500/20" />

        <Link href="/dashboard/profile" className="relative flex items-center gap-3">
          <span className="relative">
            <EmployeeAvatar name={name || "?"} className="size-13 text-base ring-2 ring-white/70" />
            <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-violet-600 bg-emerald-400 dark:border-violet-950" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/75">{t(greeting())},</p>
            <p className="truncate text-xl font-bold tracking-tight">{name}</p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <ChevronRight className="size-4.5" />
          </span>
        </Link>

        <div className="relative mt-5 flex items-center gap-2 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium ring-1 ring-white/20 backdrop-blur">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">{date}</span>
          </span>
          <span className="flex-1" />
          <LangSwitch />
        </div>
      </header>

      <div className={cn("relative flex flex-col gap-6 px-4", hasCard ? "-mt-16" : "mt-5")}>
        {showToday && <TodayCard />}
        {showTeam && <TeamCard />}

        {grid.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>{t({ km: "សេវាកម្ម", en: "Services" })}</SectionTitle>
            <nav aria-label="Services" className="grid grid-cols-3 gap-3">
              {grid.map((item) => (
                <Tile key={item.href} item={item} label={itemLabel(item, lang)} />
              ))}
            </nav>
          </section>
        )}

        {chips.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>{t({ km: "ផ្សេងៗ", en: "More" })}</SectionTitle>
            <nav aria-label="More" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
              {chips.map((item) => (
                <Chip key={item.href} item={item} label={itemLabel(item, lang, false)} />
              ))}
            </nav>
          </section>
        )}

        {showToday && <ScanBanner />}
      </div>
    </div>
  );
}
