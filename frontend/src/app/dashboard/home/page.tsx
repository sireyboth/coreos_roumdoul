"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, QrCode, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableGrid } from "@/components/ui/sortable-grid";
import { KbachCorner, KbachPattern, surfaceCard as card } from "@/components/dashboard/kbach";
import { EmployeeAvatar } from "@/components/dashboard/employee-avatar";
import { canSee, findNavItem, type NavItem } from "@/components/dashboard/nav";
import { LanguageToggle } from "@/components/language-toggle";
import { useMe } from "@/contexts/me-context";
import { useApi } from "@/hooks/use-api";
import { useSavedOrder } from "@/hooks/use-saved-order";
import { api } from "@/lib/api";
import { navLabel, useLang, useT, type TKey } from "@/lib/i18n";
import { clock, formatMinutes } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// The mobile home screen: a launcher in the style of a banking app. It only
// links to the existing pages — every feature still lives where it always has.
//
// Glass theme (globals.css, components/glass): the dashboard layout draws the
// warm mesh behind this page, and the header and tab bar float over it as
// glass. Everything on the page itself is a solid surface, so the glass is
// the only thing that looks like glass, and text stays easy to read.

// Services grid (default order; each person can drag their own), then the scrolling "More" row. Icons and permissions come
// from the sidebar's nav config so the two never disagree; names from lib/i18n.
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

/**
 * Stat chips: one strong colour per meaning, readable (AA) in light and dark.
 * Corrections is a soft periwinkle — a blue leaning warm, so it sits with the
 * amber and green. In dark mode each chip gets a thin edge of its own colour,
 * since amber on espresso would otherwise melt into the card.
 */
const STAT_TONE = {
  late: "bg-amber-100 text-amber-900 dark:bg-amber-400/25 dark:text-amber-100 dark:ring-1 dark:ring-amber-300/35 dark:ring-inset",
  corrections: "bg-[#e8eaf6] text-[#2f3a6e] dark:bg-[#8f9ce0]/22 dark:text-[#d3d9f7] dark:ring-1 dark:ring-[#a8b3ea]/30 dark:ring-inset",
  overtime: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-1 dark:ring-emerald-300/30 dark:ring-inset",
};

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

/** Tight line-height suits big Latin headings but clips Khmer's stacked marks — Khmer keeps the page's 1.65. */
function useTight(): string | undefined {
  return useLang() === "km" ? undefined : "leading-tight";
}

/** Fades each block up into place on open, one after another (transform/opacity only). Skipped for reduced motion. */
function Rise({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div
      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-500 ease-out"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-semibold text-ink-muted">{children}</p>;
}

/** The card's main action: open the camera to scan. The brand colour marks it as the thing to press. */
function ScanCta() {
  const t = useT();
  return (
    <Link
      href="/dashboard/scan"
      className="press inline-flex h-12 shrink-0 items-center gap-2 rounded-[12px] bg-brand px-4 text-[15px] font-semibold text-brand-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_-8px_var(--brand)]"
    >
      <QrCode className="size-5" />
      {t("common.action.scan")}
    </Link>
  );
}

function TodayCard() {
  const t = useT();
  const lang = useLang();
  const tight = useTight();
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
          : null;

  return (
    <section className={card}>
      <KbachCorner />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{t("home.today.badge")}</CardTitle>
          {today?.schedule && <p className="truncate text-xs text-ink-muted">{today.schedule}</p>}
        </div>
        {!today?.auto && <ScanCta />}
      </div>

      {error ? (
        <p className="mt-3 text-lg font-semibold">{t("common.message.loadFailed")}</p>
      ) : headline === null ? (
        <Skeleton className="mt-3 h-8 w-52" />
      ) : (
        <p className={cn("mt-3 flex items-center gap-2.5 text-[26px] font-semibold tracking-tight", tight)}>
          {last && <span className={cn("size-3 shrink-0 rounded-full", last.type === "in" ? "bg-emerald-500" : "bg-ink-muted/50")} />}
          <span className="min-w-0 truncate">{headline}</span>
        </p>
      )}
      {detail && <p className="mt-1 text-sm text-ink-muted">{detail}</p>}

      {today && today.slots.length > 0 && (
        <div className="mt-4">
          <div className="flex gap-1.5">
            {today.slots.map((slot) => (
              <span
                key={slot.sequence}
                className={cn("h-2 flex-1 rounded-full", slot.actual_at ? "bg-brand" : slot.status === "missing" ? "bg-red-500/70" : "bg-ink/10")}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-xs text-ink-muted">
            <span>{t("home.today.scansDone", { done: scanned.length, total: today.slots.length })}</span>
            {today.day && today.day.worked_minutes > 0 && <span>{t("home.today.worked", { time: formatMinutes(today.day.worked_minutes, lang) })}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

/** For accounts with no employee record (owners, admins): the team's day instead of their own. */
function TeamCard() {
  const t = useT();
  const { data: summary, error } = useApi(() => api.dashboard.summary(), []);

  const att = summary?.attendance ?? null;
  const staff = summary?.employees ?? null;
  const checkedIn = att?.checked_in_today ?? 0;
  const percent = staff ? Math.min(100, Math.round((checkedIn / staff) * 100)) : 0;

  // Each chip opens the list behind its number (attendance page deep links).
  const stats = [
    { key: "late", label: t("home.team.late"), value: att?.late_today, href: `/dashboard/attendance?date=${summary?.today ?? ""}` },
    { key: "corrections", label: t("home.team.corrections"), value: att?.pending_corrections, href: "/dashboard/attendance?tab=corrections&status=pending" },
    { key: "overtime", label: t("home.team.overtime"), value: att?.pending_overtime, href: "/dashboard/attendance?tab=overtime" },
  ] as const;

  return (
    <section className={card}>
      <KbachCorner />
      <div className="flex items-start justify-between gap-3">
        <CardTitle>{t("home.team.badge")}</CardTitle>
        <ScanCta />
      </div>

      {error ? (
        <p className="mt-2 text-lg font-semibold">{t("common.message.loadFailed")}</p>
      ) : !summary ? (
        <Skeleton className="mt-2 h-14 w-40" />
      ) : (
        <>
          {/* The focal point: how many are in, out of how many. */}
          <p className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-[56px] leading-none font-semibold tracking-tight">{checkedIn}</span>
            {staff !== null && <span className="text-2xl font-medium text-ink-muted">/ {staff}</span>}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{t("home.team.checkedIn")}</p>
        </>
      )}

      {staff !== null && (
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("home.team.checkedIn")}
          className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${percent}%` }} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats
          .filter((s) => s.value !== null && s.value !== undefined)
          .map((s) => (
            <Link key={s.key} href={s.href} className={cn("press flex min-h-14 flex-col justify-center rounded-[12px] px-3 py-1.5", STAT_TONE[s.key])}>
              <span className="text-xl font-semibold tabular-nums">{s.value}</span>
              <span className="truncate text-xs font-medium">{s.label}</span>
            </Link>
          ))}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-base font-semibold">{children}</h2>;
}

/** Services tile: the icon straight on the tile (no extra circle), 2px strokes like every icon here. */
function Tile({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon;
  const tight = useTight();
  return (
    <Link
      href={HREF_OVERRIDE[item.href] ?? item.href}
      className="press relative isolate flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] border border-surface-border bg-surface px-2 py-3 text-center shadow-[0_1px_2px_rgb(43_27_18/0.05)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
    >
      <KbachPattern />
      <Icon className="size-6 shrink-0" />
      <span className={cn("line-clamp-2 text-[13px] font-medium", tight && "leading-snug")}>{label}</span>
    </Link>
  );
}

function Chip({ item, label }: { item: NavItem; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="press flex h-12 shrink-0 items-center gap-2 rounded-full border border-surface-border bg-surface pr-4 pl-3.5 text-sm font-medium"
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

/**
 * The Services tiles, in the order this person dragged them into (press and
 * hold a tile, then move it). Kept per user on this device only; "Reset order"
 * shows once they've changed it.
 */
function ServicesGrid({ items }: { items: NavItem[] }) {
  const { me } = useMe();
  const lang = useLang();
  const t = useT();

  // useItems gives a new array each render; the joined hrefs only change when the tiles do.
  const hrefs = items.map((item) => item.href).join("|");
  const ids = useMemo(() => hrefs.split("|"), [hrefs]);
  const { ordered, setOrder, reset, isCustom } = useSavedOrder(me ? `home.grid.${me.user.id}` : null, ids);
  const byHref = new Map(items.map((item) => [item.href, item]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <SectionTitle>{t("home.menu.services")}</SectionTitle>
        {isCustom && (
          <button
            type="button"
            onClick={reset}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-muted"
          >
            <RotateCcw className="size-4" />
            {t("home.menu.resetOrder")}
          </button>
        )}
      </div>
      <SortableGrid
        as="nav"
        aria-label={t("home.menu.services")}
        className="grid grid-cols-3 gap-2.5"
        items={ordered.map((href) => byHref.get(href)!)}
        getId={(item) => item.href}
        renderItem={(item) => <Tile item={item} label={navLabel(lang, item.href, item.label)} />}
        onReorder={setOrder}
      />
    </section>
  );
}

export default function MobileHomePage() {
  const { me } = useMe();
  const lang = useLang();
  const t = useT();
  const tight = useTight();
  const grid = useItems(GRID);
  const chips = useItems(CHIPS);
  const name = me?.employee?.name ?? me?.user.name ?? "";
  // The header already shows the business name; an owner account named after the business doesn't repeat it here.
  const showName = Boolean(name) && name.trim().toLowerCase() !== (me?.company?.name ?? "").trim().toLowerCase();
  const hasAttendance = Boolean(me?.modules.attendance);
  const showToday = Boolean(me?.employee) && hasAttendance;
  const showTeam = !me?.employee && hasAttendance && Boolean(me?.permissions.includes("dashboard.view"));
  const date = new Date().toLocaleDateString(lang === "km" ? "km-KH" : [], { weekday: "long", day: "numeric", month: "long" });

  // Blocks in the order they fade in.
  let step = 0;

  return (
    // lang marks the Khmer text for the browser and screen readers; Khmer gets a 1.65 line-height throughout.
    <div lang={lang} className={cn("text-ink", lang === "km" && "leading-[1.65]")}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-5 pb-4">
        <Rise index={step++}>
          <header className="flex flex-col gap-4 px-1">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/profile" aria-label={navLabel(lang, "/dashboard/profile")} className="press shrink-0 rounded-full">
                <EmployeeAvatar name={name || "?"} className="size-14 text-base ring-2 ring-surface" />
              </Link>
              <div className="min-w-0">
                {showName ? (
                  <>
                    <p className="text-sm text-ink-muted">{t(greetingKey())},</p>
                    <p className={cn("truncate text-2xl font-semibold tracking-tight", tight)}>{name}</p>
                  </>
                ) : (
                  <p className={cn("text-2xl font-semibold tracking-tight", tight)}>{t(greetingKey())}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-surface-border bg-surface/85 px-3 text-[13px] font-medium">
                <CalendarDays className="size-4 shrink-0" />
                <span className="truncate">{date}</span>
              </span>
              {/* 52px tall with 2px padding, so each option is a 48px touch target. */}
              <LanguageToggle className="h-13 rounded-full border-surface-border bg-surface p-0.5 shadow-none [&_button]:rounded-full [&_button]:px-4 [&_button]:text-ink-muted **:aria-pressed:bg-brand! **:aria-pressed:text-brand-foreground!" />
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
            <ServicesGrid items={grid} />
          </Rise>
        )}

        {chips.length > 0 && (
          <Rise index={step++}>
            <section className="flex flex-col gap-3">
              <SectionTitle>{t("home.menu.more")}</SectionTitle>
              <nav aria-label={t("home.menu.more")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
                {chips.map((item) => (
                  <Chip key={item.href} item={item} label={navLabel(lang, item.href, item.label)} />
                ))}
              </nav>
            </section>
          </Rise>
        )}
      </div>
    </div>
  );
}
