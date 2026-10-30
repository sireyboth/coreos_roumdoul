"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, QrCode, type LucideIcon } from "lucide-react";
import { canSee, findNavItem } from "@/components/dashboard/layout/nav";
import { useMe } from "@/contexts/me-context";
import { navLabel, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Tab = { href: string; icon: LucideIcon };

// Either side of the Scan button. Icons and permissions for the nav pages
// come from nav.ts, like everywhere else.
const LEFT = ["/dashboard/requests"];
const RIGHT = ["/dashboard/attendance", "/dashboard/profile"];

// Springy ease (overshoots a touch, then settles) shared by the capsule and the icon pop.
const SPRING = "ease-[cubic-bezier(0.34,1.56,0.64,1)]";

/** One tab: 56px tall (above the 48px touch minimum). The capsule behind the selected one is drawn by the bar. */
function TabLink({ tab, label, selected, onSelect }: { tab: Tab; label: string; selected: boolean; onSelect: () => void }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      data-tab={tab.href}
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "press relative z-10 flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-medium transition-colors duration-200",
        selected ? "text-brand" : "text-ink-muted",
      )}
    >
      {/* Re-keyed on selection so the pop replays each time the tab becomes the selected one. */}
      <Icon key={String(selected)} className={cn("size-5.5 shrink-0", selected && cn("motion-safe:animate-in motion-safe:zoom-in-75 duration-400", SPRING))} />
      <span className="max-w-full truncate leading-[1.6]">{label}</span>
    </Link>
  );
}

/**
 * The app's bottom bar on phones: a floating glass pill, 12px in from the
 * sides and lifted clear of the home indicator / gesture bar / 3-button bar.
 * A single glass capsule slides to whichever tab is selected.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { me } = useMe();
  const lang = useLang();
  const t = useT();
  const barRef = useRef<HTMLDivElement>(null);

  const tabs = (hrefs: string[]): Tab[] =>
    hrefs.flatMap((href) => {
      const item = findNavItem(href);
      return item && me && canSee(item, me) ? [{ href, icon: item.icon }] : [];
    });

  const left: Tab[] = [{ href: "/dashboard/home", icon: House }, ...tabs(LEFT)];
  const right = tabs(RIGHT);
  const canScan = Boolean(me?.employee && me.modules.attendance);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const activeHref = [...left, ...right].find((tab) => isActive(tab.href))?.href ?? null;

  // The tab just tapped, remembered with the page it was tapped on: the capsule
  // moves at once instead of waiting for the next page to load, and the memory
  // lapses by itself as soon as the address changes.
  const [tapped, setTapped] = useState<{ href: string; on: string } | null>(null);
  const selectedHref = tapped && tapped.on === pathname ? tapped.href : activeHref;

  // Where the capsule sits: the selected tab's left edge and width inside the bar.
  // `slide` stays off for the first placement so it doesn't sweep in from the side on load.
  const [capsule, setCapsule] = useState<{ x: number; width: number; slide: boolean } | null>(null);
  const tabCount = left.length + right.length;

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const place = () => {
      const tab = selectedHref ? bar.querySelector<HTMLElement>(`[data-tab="${selectedHref}"]`) : null;
      setCapsule((prev) => (tab ? { x: tab.offsetLeft, width: tab.offsetWidth, slide: prev !== null } : null));
    };
    place();
    // Tab widths change with the screen (rotation, language switch).
    const observer = new ResizeObserver(place);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [selectedHref, tabCount, lang]);

  const link = (tab: Tab) => (
    <TabLink
      key={tab.href}
      tab={tab}
      label={navLabel(lang, tab.href)}
      selected={tab.href === selectedHref}
      onSelect={() => setTapped({ href: tab.href, on: pathname })}
    />
  );

  return (
    <nav
      aria-label={t("sidebar.mainMenu")}
      lang={lang}
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 md:hidden"
    >
      {/* Thick glass: the labels must stay readable over whatever scrolls
          behind — thin glass vanished over dark content (photos, the ID card's back). */}
      <div ref={barRef} className="glass-surface relative mx-auto flex max-w-md items-center gap-1 rounded-full p-1.5 [--glass-bg:var(--glass-thick)]">
        {capsule && (
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 left-0 h-14 rounded-full bg-white/60 shadow-[inset_0_1px_0_var(--glass-hi),0_1px_3px_rgb(43_27_18/0.12)] dark:bg-white/12",
              capsule.slide && cn("transition-transform duration-500 motion-reduce:transition-none", SPRING),
            )}
            style={{ width: capsule.width, transform: `translateX(${capsule.x}px)` }}
          />
        )}
        {left.map(link)}
        {canScan && (
          <Link
            href="/dashboard/scan"
            aria-label={t("common.action.scan")}
            className="press relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_-6px_var(--brand)]"
          >
            <QrCode className="size-6" />
          </Link>
        )}
        {right.map(link)}
      </div>
    </nav>
  );
}
