"use client";

import { useEffect, useState } from "react";
import { BellRing, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

    if (result === "on") toast.success("Notifications are on for this device.");
    else if (result === "blocked") toast.error("Notifications are blocked. Turn them on for this site in your phone or browser settings.");
    else if (result === "off") snooze(); // Closed the browser's box without choosing: ask again later.
    else toast.error("Couldn't turn on notifications. Try again from the bell.");
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && later()}>
      <DialogContent>
        {state === "needs-install" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                Get notifications on your iPhone
              </DialogTitle>
              <DialogDescription>
                iPhone only sends notifications to apps on your Home Screen. Add it once:
              </DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                Tap the Share button <Share className="inline size-3.5 align-text-top" /> at the bottom of Safari.
              </li>
              <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              <li>Open the app from the new icon on your Home Screen.</li>
            </ol>
            <DialogFooter>
              <Button onClick={later}>Got it</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="size-4 text-primary" />
                Turn on notifications?
              </DialogTitle>
              <DialogDescription>
                Get alerts for attendance, approvals and other updates on this device — even when the app is closed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={later} disabled={busy}>
                Not now
              </Button>
              <Button onClick={allow} disabled={busy}>
                {busy ? "Just a moment…" : "Allow"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
