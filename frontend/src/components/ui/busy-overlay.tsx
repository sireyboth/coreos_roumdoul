"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { isBusy, subscribeBusy } from "@/lib/busy";

// Input is blocked the moment work starts; the overlay itself only appears if
// the work is still running after this long, so quick saves don't flash.
const SHOW_AFTER_MS = 250;

const BLOCKED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "keydown", "keyup", "touchstart", "submit"];

/**
 * Freezes the whole app while a save/delete/export is running (see lib/busy.ts).
 * Events are stopped on window in the capture phase — before React, dialogs or
 * menus see them — so a click can't also close an open dialog mid-save, and
 * Enter/Escape can't resubmit or dismiss either.
 */
export function BusyOverlay() {
  const busy = useSyncExternalStore(subscribeBusy, isBusy, () => false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) return;

    const block = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    BLOCKED_EVENTS.forEach((type) => window.addEventListener(type, block, { capture: true }));
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);

    return () => {
      clearTimeout(timer);
      setVisible(false);
      BLOCKED_EVENTS.forEach((type) => window.removeEventListener(type, block, { capture: true }));
    };
  }, [busy]);

  if (!busy) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`fixed inset-0 z-100 flex cursor-wait items-center justify-center bg-background/40 backdrop-blur-[1px] transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {visible && (
        <div className="flex items-center gap-2.5 rounded-lg bg-popover px-4 py-2.5 text-sm font-medium text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <Loader2 className="size-4 animate-spin text-primary" />
          Working…
        </div>
      )}
    </div>
  );
}
