"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useGlass } from "@/components/glass";
import { LoaderCard } from "@/components/ui/loader-card";
import { beginPageLoad, isPageLoading, subscribeBusy } from "@/lib/busy";
import { useT } from "@/lib/i18n";

// The page is locked at once; the veil and spinner only show if loading takes
// longer than this, so a fast (or cached) page never flashes.
const SHOW_AFTER_MS = 200;
// A request that hangs must never trap the user: after this, unlock anyway.
const GIVE_UP_AFTER_MS = 15_000;

/**
 * Wraps the page content (not the sidebar or top bar) and locks it while the
 * page's own data is still loading — see trackPageRead in lib/busy.ts.
 * Someone can still leave a slow page, but can't use a half-loaded one.
 */
export function PageLoadGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const loading = useSyncExternalStore(subscribeBusy, isPageLoading, () => false);
  const [visible, setVisible] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const t = useT();
  const isGlass = useGlass();

  // A layout effect runs before any page's useEffect, so the page's first
  // reads already fall inside the window.
  useLayoutEffect(() => {
    beginPageLoad();
  }, [pathname]);

  useEffect(() => {
    if (!loading) return;

    const show = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const giveUp = setTimeout(() => setGaveUp(true), GIVE_UP_AFTER_MS);

    return () => {
      clearTimeout(show);
      clearTimeout(giveUp);
      setVisible(false);
      setGaveUp(false);
    };
  }, [loading]);

  const locked = loading && !gaveUp;

  return (
    <div className="relative">
      {/* inert: no clicks, no keyboard, no focus inside until the data is there. */}
      <div inert={locked} aria-busy={locked}>
        {children}
      </div>

      {locked && (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.table.loading")}
          className={`absolute inset-0 z-40 cursor-progress transition-colors duration-200 ${visible ? (isGlass ? "bg-slate-950/15" : "bg-background/45") : "bg-transparent"}`}
        >
          {visible && (
            <>
              <div className="sticky top-0 h-0.5 overflow-hidden bg-primary/15">
                <div className="h-full w-1/4 rounded-full bg-primary" style={{ animation: "page-load-bar 1.1s ease-in-out infinite" }} />
              </div>
              {/* Pinned to the middle of the screen, however far the page is scrolled.
                  Clicks pass through it — the veil above is what locks the page. */}
              <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-6">
                <LoaderCard label={t("common.message.loading")} glass={isGlass} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
