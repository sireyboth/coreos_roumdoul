"use client";

import { useEffect, useState } from "react";
import { BellRing, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { translateNow, useT } from "@/lib/i18n";
import { enablePush, onPushChange, pushState, type PushState } from "@/lib/push";

const DAY_MS = 24 * 60 * 60 * 1000;
// "Not now" on this device: ask again after this long.
const SNOOZE_KEY = "push-prompt-snoozed-until";
const SNOOZE_MS = 3 * DAY_MS;
// Give the page a moment to settle before asking.
const DELAY_MS = 1500;

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    // Private mode: it just asks again next time.
  }
}

/**
 * Asks for notifications on its own when the app opens, so nobody has to find
 * the switch in the bell. The browser's own "Allow?" box can only come from a
 * tap, so this is the screen that gets that tap. On an iPhone in a Safari tab,
 * where push can't work at all, it explains Add to Home Screen instead.
 * Never shown once push is on, blocked, or unsupported here.
 */
export function PushPrompt() {
  const [state, setState] = useState<"off" | "needs-install" | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (snoozed()) return;
      pushState()
        .then((s) => {
          if (!cancelled && (s === "off" || s === "needs-install")) setState(s);
        })
        .catch(() => {});
    }, DELAY_MS);
    // Turned on from the bell meanwhile: nothing left to ask.
    const unsubscribe = onPushChange((s) => s !== "off" && setState(null));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  function later() {
    snooze();
    setState(null);
  }

  async function allow() {
    setBusy(true);
    let result: PushState;
    try {
      result = await enablePush();
    } catch (error) {
      console.error("Turning on push failed:", error);
      result = "unavailable";
    }
    setBusy(false);
    setState(null);

    if (result === "on") toast.success(translateNow("app.pushPrompt.result.on"));
    else if (result === "blocked") toast.error(translateNow("app.pushPrompt.result.blocked"));
    else if (result === "off") snooze(); // Closed the browser's box without choosing: ask again later.
    else toast.error(translateNow("app.pushPrompt.result.failed"));
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && later()}>
      <DialogContent>
        {state === "needs-install" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                {t("app.pushPrompt.iphone.title")}
              </DialogTitle>
              <DialogDescription>
                {t("app.pushPrompt.iphone.description")}
              </DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                {t("app.pushPrompt.iphone.step1Before")} <Share className="inline size-3.5 align-text-top" /> {t("app.pushPrompt.iphone.step1After")}
              </li>
              {/* The iPhone's own button names, as Safari shows them. */}
              <li>
                {t("app.pushPrompt.iphone.step2Before")} <strong>Add to Home Screen</strong>
                {t("app.pushPrompt.iphone.step2Middle")} <strong>Add</strong>
                {t("app.pushPrompt.iphone.step2After")}
              </li>
              <li>{t("app.pushPrompt.iphone.step3")}</li>
            </ol>
            <DialogFooter>
              <Button onClick={later}>{t("app.pushPrompt.iphone.gotIt")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                {t("app.pushPrompt.ask.title")}
              </DialogTitle>
              <DialogDescription>
                {t("app.pushPrompt.ask.description")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={later} disabled={busy}>
                {t("app.pushPrompt.ask.notNow")}
              </Button>
              <Button onClick={allow} disabled={busy}>
                {t(busy ? "app.pushPrompt.ask.wait" : "app.pushPrompt.ask.allow")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
