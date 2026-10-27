"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, QrCode, type LucideIcon } from "lucide-react";
import { canSee, findNavItem } from "@/components/dashboard/nav";
import { useMe } from "@/contexts/me-context";
import { navLabel, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Tab = { href: string; icon: LucideIcon };

// Either side of the raised Scan button. Icons and permissions for the nav
// pages come from nav.ts, like everywhere else.
const LEFT = ["/dashboard/requests"];
const RIGHT = ["/dashboard/attendance", "/dashboard/profile"];

function TabLink({ tab, label, active }: { tab: Tab; label: string; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
      <Icon className={cn("size-5.5", active && "scale-110")} strokeWidth={active ? 2.3 : 1.8} />
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}

/** The app-style bar along the bottom of every page on phones. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { me } = useMe();
  const lang = useLang();
  const t = useT();

  const tabs = (hrefs: string[]): Tab[] =>
    hrefs.flatMap((href) => {
      const item = findNavItem(href);
      return item && me && canSee(item, me) ? [{ href, icon: item.icon }] : [];
    });

  const left: Tab[] = [{ href: "/dashboard/home", icon: House }, ...tabs(LEFT)];
  const right = tabs(RIGHT);
  const canScan = Boolean(me?.employee && me.modules.attendance);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const link = (tab: Tab) => <TabLink key={tab.href} tab={tab} label={navLabel(lang, tab.href)} active={isActive(tab.href)} />;

  return (
    <nav
      aria-label={t("sidebar.mainMenu")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.15)] backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {left.map(link)}
        {canScan && (
          <div className="flex flex-1 justify-center">
            <Link
              href="/dashboard/scan"
              aria-label={t("common.action.scan")}
              className="-mt-5 flex size-15 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-background transition-transform active:scale-95"
            >
              <QrCode className="size-6.5" />
            </Link>
          </div>
        )}
        {right.map(link)}
      </div>
    </nav>
  );
}
