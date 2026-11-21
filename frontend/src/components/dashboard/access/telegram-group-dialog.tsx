"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlarmClock, CalendarPlus, CircleAlert, CircleCheck, Send, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TelegramDetailPicker, TelegramReachPicker, type BranchOption } from "@/components/dashboard/access/telegram-group-fields";
import { useMe } from "@/contexts/me-context";
import { api, type TelegramDetail, type TelegramEvent, type TelegramGroup } from "@/lib/api";
import { dateLocale, useLang, useT } from "@/lib/i18n";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** One soft-tinted icon per kind of post (soft tints: these repeat down the list). */
export const EVENT_LOOK: Record<TelegramEvent, { icon: LucideIcon; tile: string }> = {
  requests: { icon: CalendarPlus, tile: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400" },
  request_decisions: { icon: CircleCheck, tile: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400" },
  late_warnings: { icon: AlarmClock, tile: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400" },
};

/**
 * One linked group: which branches it covers, how much it shows, what it
 * gets (one Save for all three), plus Send test and Disconnect.
 */
export function TelegramGroupDialog({
  group,
  events: allEvents,
  botName,
  branches,
  onOpenChange,
  onChanged,
}: {
  group: TelegramGroup;
  events: TelegramEvent[];
  botName: string | null;
  branches: BranchOption[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const confirm = useConfirm();
  const { me } = useMe();

  // Mounted fresh for each group it opens (the page keys it by id), so it
  // starts from that group's saved choices.
  const [reach, setReach] = useState<number[] | null>(group.branch_ids);
  const [detail, setDetail] = useState<TelegramDetail>(group.detail);
  const [events, setEvents] = useState<TelegramEvent[]>(group.events);
  const [busy, setBusy] = useState(false);

  const title = group.title || t("access.telegramPage.untitled");
  const lateWarningsOff = me?.company?.late_warning_limit == null;
  const reachMissing = reach !== null && reach.length === 0;
  // A branch the group covered was deleted since: say so, so the admin can tidy it.
  const lostBranch = group.branch_ids?.some((id) => !branches.some((b) => b.id === id)) ?? false;

  async function act(action: () => Promise<unknown>, done: string, close = false) {
    setBusy(true);
    try {
      await action();
      notifySuccess(done);
      onChanged();
      if (close) onOpenChange(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: t("access.telegramPage.disconnectTitle", { title }),
      description: t("access.telegramPage.disconnectBody"),
      confirmLabel: t("access.telegramPage.disconnect"),
      destructive: true,
    });
    if (ok) await act(() => api.telegram.disconnect(group.id), t("access.telegramPage.disconnected"), true);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>
            {botName && <>@{botName} · </>}
            {t("access.telegramPage.since", { date: new Date(group.created_at).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" }) })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <TelegramReachPicker branches={branches} value={reach} onChange={setReach} />
            {lostBranch && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <CircleAlert className="size-3.5 shrink-0" />
                {t("access.telegramPage.removedBranch")}
              </p>
            )}
          </div>

          <TelegramDetailPicker value={detail} onChange={setDetail} />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("access.telegramPage.eventsTitle")}</legend>
            <ul className="divide-y rounded-lg border">
              {allEvents.map((event) => {
                const look = EVENT_LOOK[event];
                const on = events.includes(event);
                return (
                  <li key={event} className="flex items-start gap-3 p-3">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", look.tile)}>
                      <look.icon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <label htmlFor={`tg-${group.id}-${event}`} className="text-sm font-medium">
                        {t(`access.telegramPage.events.${event}.label`)}
                      </label>
                      <p className="text-xs text-muted-foreground">{t(`access.telegramPage.events.${event}.hint`)}</p>
                      {event === "late_warnings" && on && (
                        <>
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t("access.telegramPage.lateCaution")}</p>
                          {lateWarningsOff && (
                            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-amber-600 dark:text-amber-400">
                              <CircleAlert className="size-3.5 shrink-0" />
                              {t("access.telegramPage.lateOff")}
                              <Link href="/dashboard/attendance" className="font-medium underline underline-offset-2 hover:no-underline">
                                {t("access.telegramPage.lateOffAction")}
                              </Link>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <Switch
                      id={`tg-${group.id}-${event}`}
                      checked={on}
                      onCheckedChange={(next) => setEvents(next ? [...events, event] : events.filter((e) => e !== event))}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-px size-4 shrink-0 text-success" />
              {t("access.telegramPage.privacy")}
            </p>
          </fieldset>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={busy} className="text-destructive hover:text-destructive" onClick={disconnect}>
              <Unplug className="size-4" />
              {t("access.telegramPage.disconnect")}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => act(() => api.telegram.test(group.id), t("access.telegramPage.testSent"))}>
              <Send className="size-4" />
              {t("access.telegramPage.sendTest")}
            </Button>
          </div>
          <Button
            disabled={busy || reachMissing}
            onClick={() => act(() => api.telegram.update(group.id, { branch_ids: reach, detail, events }), t("access.telegramPage.saved"), true)}
          >
            {t("access.telegramPage.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
