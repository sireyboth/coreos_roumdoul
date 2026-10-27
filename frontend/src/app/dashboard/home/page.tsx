"use client";

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
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { navLabel, useLang, useT, type TKey } from "@/lib/i18n";
import { LangSwitch } from "@/components/brand-hero";
import { pane, well } from "@/components/glass";
import { clock, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// The mobile home screen: a launcher in the style of a banking app. It only
// links to the existing pages — every feature still lives where it always has.
// Look: "liquid glass" (components/glass) — the dashboard layout draws the
// backdrop behind this page and turns its header and tab bar to glass.

// Main grid, then the scrolling chip row. Icons and permissions come from the
// sidebar's nav config so the two never disagree; names from lib/i18n.
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
  "/dashboard/birthdays",
  "/dashboard/branches",
  "/dashboard/teams",
  "/dashboard/attendance/corrections",
  "/dashboard/audit",
];

// The full dashboard sends phones here, so the Overview tile asks to stay.
const HREF_OVERRIDE: Record<string, string> = { "/dashboard": "/dashboard?view=full" };

function greetingKey(): TKey {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greeting.morning";
  if (hour < 18) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

function useItems(hrefs: string[]): NavItem[] {
  const { me } = useMe();
  return hrefs
    .map((href) => findNavItem(href))
    .filter((item): item is NavItem => Boolean(item && me && canSee(item, me)));
}

/**
 * Small spaced-out label ("TODAY", "SERVICES"). Letter-spacing only for
 * English — spreading Khmer pulls its stacked marks apart.
 */
function Eyebrow({ children, dot = false }: { children: React.ReactNode; dot?: boolean }) {
  const lang = useLang();
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] font-semibold text-white/70", lang === "en" && "uppercase tracking-[0.18em]")}>
      {dot && <span className="size-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgb(255_255_255/0.8)]" />}
      {children}
    </span>
  );
}

/** Fades each block up into place on open, one after another. Skipped for reduced motion. */
function Rise({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div
      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-700 ease-out"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

type Action = { href: string; label: string; icon: LucideIcon };

/** The big glass card under the header — the banking app's "balance". */
function HeroCard({ badge, children, actions }: { badge: string; children: React.ReactNode; actions: Action[] }) {
  return (
    <section className={cn("overflow-hidden rounded-[28px]", pane)}>
      <div className="p-5 pt-4">
        <Eyebrow dot>{badge}</Eyebrow>
        {children}
      </div>
      <div className="mx-5 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
      <div className="grid grid-cols-3">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 py-3.5 text-xs font-medium text-white/90 transition-colors active:bg-white/10"
          >
            <span className={cn("flex size-9 items-center justify-center rounded-full", well)}>
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * The big QR button in the top-right of a hero card: opens the camera
 * (/dashboard/scan) to check in. Solid pearl-white so it is the one thing on
 * the glass that reads as "press me". Shared by the Today and Team cards.
 */
function ScanTile() {
  const t = useT();
  return (
    <Link
      href="/dashboard/scan"
      aria-label={t("home.today.scanAttendance")}
      className="flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-linear-to-b from-white to-slate-200 text-slate-800 shadow-[inset_0_-2px_0_rgb(15_23_42/0.08),0_12px_24px_-8px_rgb(2_6_23/0.5)] ring-4 ring-white/20 transition-transform text-shadow-none active:scale-95"
    >
      <QrCode className="size-7" strokeWidth={1.75} />
    </Link>
  );
}

function TodayCard() {
  const t = useT();
  const lang = useLang();
  const { data: today, error } = useApi(() => api.attendance.today(), []);

  const scanned = today?.slots.filter((s) => s.actual_at) ?? [];
  const last = scanned.at(-1) ?? null;
  const next = today?.next ?? null;
  const slotName = (type: "in" | "out") => t(type === "in" ? "home.today.in" : "home.today.out");

  const headline = !today
    ? null
    : today.kind !== "work" && !last
      ? (today.label ?? t("home.today.noWork"))
      : last
        ? `${t(last.type === "in" ? "home.today.checkedIn" : "home.today.checkedOut")} · ${clock(last.actual_at)}`
        : t("home.today.notCheckedIn");

  const detail = !today
    ? null
    : today.auto
      ? t("home.today.auto")
      : next
        ? t("home.today.next", { slot: slotName(next.type), time: clock(next.expected_at) })
        : last
          ? t("home.today.allDone")
          : today.schedule;

  const checkedIn = last?.type === "in";

  return (
    <HeroCard
      badge={t("home.today.badge")}
      actions={[
        { href: "/dashboard/scan", label: t("common.action.scan"), icon: QrCode },
        { href: "/dashboard/requests", label: t("home.today.request"), icon: Send },
        { href: "/dashboard/attendance/corrections", label: t("home.today.correction"), icon: FileClock },
      ]}
    >
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {today?.schedule && <p className="truncate text-xs text-white/65">{today.schedule}</p>}
          {error ? (
            <p className="mt-2 text-lg font-medium">{t("common.message.loadFailed")}</p>
          ) : headline === null ? (
            <Skeleton className="mt-2 h-8 w-48 bg-white/20" />
          ) : (
            <p className="mt-1 flex items-center gap-2.5 text-[22px] font-medium tracking-tight">
              {last && (
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    checkedIn ? "bg-emerald-300 shadow-[0_0_10px_rgb(110_231_183/0.9)]" : "bg-white/50",
                  )}
                />
              )}
              <span className="truncate">{headline}</span>
            </p>
          )}
          {detail && <p className="mt-1 truncate text-sm text-white/70">{detail}</p>}
        </div>
        {!today?.auto && <ScanTile />}
      </div>

      {today && today.slots.length > 0 && (
        <div className="mt-5">
          <div className="flex justify-between text-[11px] text-white/65">
            <span>{t("home.today.scansDone", { done: scanned.length, total: today.slots.length })}</span>
            {today.day && today.day.worked_minutes > 0 && <span>{t("home.today.worked", { time: formatMinutes(today.day.worked_minutes, lang) })}</span>}
          </div>
          <div className="mt-2 flex gap-1.5">
            {today.slots.map((slot) => (
              <span
                key={slot.sequence}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  slot.actual_at
                    ? "bg-emerald-300 shadow-[0_0_8px_rgb(110_231_183/0.6)]"
                    : slot.status === "missing"
                      ? "bg-rose-300"
                      : "bg-white/20",
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
  const lang = useLang();
  const { data: summary, error } = useApi(() => api.dashboard.summary(), []);

  const att = summary?.attendance ?? null;
  const staff = summary?.employees ?? null;
  const percent = att && staff ? Math.min(100, Math.round((att.checked_in_today / staff) * 100)) : 0;

  // Pale tints: the full-strength theme colours are too dark to read on glass.
  const stats = [
    { label: t("home.team.late"), value: att?.late_today, tone: "text-amber-200" },
    { label: t("home.team.corrections"), value: att?.pending_corrections, tone: "text-sky-200" },
    { label: t("home.team.overtime"), value: att?.pending_overtime, tone: "text-white" },
  ].filter((s) => s.value !== null && s.value !== undefined);

  return (
    <HeroCard
      badge={t("home.team.badge")}
      actions={[
        { href: "/dashboard/attendance", label: navLabel(lang, "/dashboard/attendance"), icon: Clock3 },
        { href: "/dashboard/attendance/corrections", label: t("home.team.corrections"), icon: FileClock },
        { href: "/dashboard/employees", label: navLabel(lang, "/dashboard/employees"), icon: Users },
      ]}
    >
      <div className="mt-3 flex items-start justify-between gap-4">
        {error ? (
          <p className="mt-2 text-lg font-medium">{t("common.message.loadFailed")}</p>
        ) : !summary ? (
          <Skeleton className="mt-2 h-12 w-36 bg-white/20" />
        ) : (
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-5xl font-light tracking-tight tabular-nums">{att?.checked_in_today ?? 0}</span>
            {staff !== null && <span className="text-xl font-light text-white/60 tabular-nums">/ {staff}</span>}
            <span className="ml-1 truncate text-sm text-white/70">{t("home.team.checkedIn")}</span>
          </p>
        )}
        <ScanTile />
      </div>
      {staff !== null && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-linear-to-r from-white/70 to-white shadow-[0_0_10px_rgb(255_255_255/0.7)] transition-[width] duration-1000"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {stats.length > 0 && (
        <div className="mt-5 flex gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <p className={cn("text-xl font-light tabular-nums", s.tone)}>{s.value}</p>
              <p className="text-[11px] text-white/65">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </HeroCard>
  );
}

function Tile({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={HREF_OVERRIDE[item.href] ?? item.href}
      className={cn("flex h-28 flex-col items-center justify-center gap-2.5 rounded-3xl p-2 text-center transition-transform active:scale-[0.96]", pane)}
    >
      <span className={cn("flex size-12 items-center justify-center rounded-2xl", well)}>
        <Icon className="size-5.5" strokeWidth={1.6} />
      </span>
      <span className="line-clamp-2 text-[13px] leading-tight text-white/90">{label}</span>
    </Link>
  );
}

function Chip({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn("flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm text-white/90 transition-transform active:scale-95", pane)}
    >
      <span className={cn("flex size-8 items-center justify-center rounded-full", well)}>
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      {label}
    </Link>
  );
}

/** A wide shortcut to the full-screen scanner. */
function ScanBanner() {
  const t = useT();
  return (
    <Link href="/dashboard/scan" className={cn("flex items-center gap-4 rounded-[28px] p-5 transition-transform active:scale-[0.98]", pane)}>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-medium tracking-tight">{t("home.scanBanner.title")}</p>
        <p className="mt-0.5 text-sm text-white/70">{t("home.scanBanner.body")}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-md text-shadow-none">
          {t("home.scanBanner.cta")}
          <ArrowRight className="size-3.5" />
        </span>
      </div>
      <div className={cn("flex size-20 shrink-0 items-center justify-center rounded-3xl", well)}>
        <QrCode className="size-10" strokeWidth={1.4} />
      </div>
    </Link>
  );
}

export default function MobileHomePage() {
  const { me } = useMe();
  const lang = useLang();
  const t = useT();
  const grid = useItems(GRID);
  const chips = useItems(CHIPS);
  const name = me?.employee?.name ?? me?.user.name ?? "";
  const hasAttendance = Boolean(me?.modules.attendance);
  const showToday = Boolean(me?.employee) && hasAttendance;
  const showTeam = !me?.employee && hasAttendance && Boolean(me?.permissions.includes("dashboard.view"));
  const date = new Date().toLocaleDateString(lang === "km" ? "km-KH" : [], { weekday: "long", day: "numeric", month: "long" });

  // Blocks in the order they fade in.
  let step = 0;

  return (
    // A faint shadow under the white text keeps it readable where the backdrop is pale.
    <div className="text-white [text-shadow:0_1px_2px_rgb(2_6_23/0.2)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-7 px-4 pt-6 pb-8">
        <Rise index={step++}>
          <header className="px-1">
            <Link href="/dashboard/profile" className="flex items-center gap-3.5">
              <span className="relative rounded-full p-0.5 glass-edge">
                <EmployeeAvatar name={name || "?"} className="size-13 text-base" />
                <span className="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.8)]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/70">{t(greetingKey())},</p>
                <p className="truncate text-[28px] leading-tight font-medium tracking-tight">{name}</p>
              </div>
              <span className={cn("flex size-10 items-center justify-center rounded-full", pane)}>
                <ChevronRight className="size-4.5" strokeWidth={1.75} />
              </span>
            </Link>

            <div className="mt-5 flex items-center justify-between gap-2 text-xs">
              <span className={cn("inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-medium", pane)}>
                <CalendarDays className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{date}</span>
              </span>
              <LangSwitch activeText="text-slate-800 text-shadow-none" />
            </div>
          </header>
        </Rise>

        {showToday && (
          <Rise index={step++}>
            <TodayCard />
          </Rise>
        )}
        {showTeam && (
          <Rise index={step++}>
            <TeamCard />
          </Rise>
        )}

        {grid.length > 0 && (
          <Rise index={step++}>
            <section className="flex flex-col gap-3">
              <h2 className="px-1">
                <Eyebrow>{t("home.menu.services")}</Eyebrow>
              </h2>
              <nav aria-label={t("home.menu.services")} className="grid grid-cols-3 gap-3">
                {grid.map((item) => (
                  <Tile key={item.href} item={item} label={navLabel(lang, item.href, item.label)} />
                ))}
              </nav>
            </section>
          </Rise>
        )}

        {chips.length > 0 && (
          <Rise index={step++}>
            <section className="flex flex-col gap-3">
              <h2 className="px-1">
                <Eyebrow>{t("home.menu.more")}</Eyebrow>
              </h2>
              <nav aria-label={t("home.menu.more")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-3 scrollbar-none [&::-webkit-scrollbar]:hidden">
                {chips.map((item) => (
                  <Chip key={item.href} item={item} label={navLabel(lang, item.href, item.label)} />
                ))}
              </nav>
            </section>
          </Rise>
        )}

        {showToday && (
          <Rise index={step++}>
            <ScanBanner />
          </Rise>
        )}
      </div>
    </div>
  );
}
