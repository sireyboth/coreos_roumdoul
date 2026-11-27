"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TelegramReachPicker, type BranchOption } from "@/components/dashboard/access/telegram-group-fields";
import { api, type TelegramGroup, type TelegramLink } from "@/lib/api";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";

/** How often the dialog checks whether Telegram linked the group, while a link is open. */
const POLL_MS = 3000;

/**
 * Connect a Telegram group: choose its branches, get a one-time link, pick
 * the group in Telegram. The linking happens in Telegram (the server's
 * webhook), so while the link is open the dialog checks every few seconds
 * and closes by itself once a group appears (or an existing one is re-linked).
 */
export function TelegramConnectDialog({
  open,
  onOpenChange,
  branches,
  groups,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchOption[];
  groups: TelegramGroup[];
  onConnected: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [reach, setReach] = useState<number[] | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [busy, setBusy] = useState(false);

  // The groups as they were when the link was made: a new id, or a changed one, means "connected".
  // (Mounted fresh each time it opens — the page renders it only while open.)
  const before = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!open || !link) return;

    const timer = setInterval(async () => {
      try {
        const status = await api.telegram.status();
        const linked = status.groups.find((g) => before.current.get(g.id) !== g.updated_at);
        if (linked) {
          notifySuccess(t("access.telegramPage.connectedToast", { title: linked.title || t("access.telegramPage.untitled") }));
          onConnected();
          onOpenChange(false);
        }
      } catch {
        // A missed check is fine; the next one tries again.
      }
    }, POLL_MS);
    // The link expires: back to the first step.
    const stop = setTimeout(() => setLink(null), new Date(link.expires_at).getTime() - Date.now());

    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [open, link, onConnected, onOpenChange, t]);

  async function getLink() {
    setBusy(true);
    try {
      before.current = new Map(groups.map((g) => [g.id, g.updated_at]));
      const made = await api.telegram.link(reach);
      setLink(made);
      // Straight to Telegram; the buttons stay for a second try or another device.
      window.open(made.link, "_blank", "noopener");
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess(t("access.telegramPage.copied"));
    } catch (err) {
      notifyError(err);
    }
  }

  const steps = [t("access.telegramPage.step1"), t("access.telegramPage.step2"), t("access.telegramPage.step3")];
  const reachMissing = reach !== null && reach.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("access.telegramPage.connectTitle")}</DialogTitle>
          <DialogDescription>{t("access.telegramPage.connectDescription")}</DialogDescription>
        </DialogHeader>

        {!link ? (
          <TelegramReachPicker branches={branches} value={reach} onChange={setReach} />
        ) : (
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-semibold text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-400">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="size-4 animate-spin text-sky-600 dark:text-sky-400" />
                {t("access.telegramPage.waiting")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("access.telegramPage.linkReady", {
                  time: new Date(link.expires_at).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" }),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button render={<a href={link.link} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                  <ExternalLink className="size-4" />
                  {t("access.telegramPage.openTelegram")}
                </Button>
                <Button variant="outline" onClick={() => copy(link.link)}>
                  <Copy className="size-4" />
                  {t("access.telegramPage.copyLink")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("access.telegramPage.manualHint")}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
          {!link && (
            <Button onClick={getLink} disabled={busy || reachMissing}>
              <Link2 className="size-4" />
              {t("access.telegramPage.getLink")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
