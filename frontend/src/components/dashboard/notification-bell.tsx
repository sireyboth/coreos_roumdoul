"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Cake, CheckCheck, Gift, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requestSystemPermission, showSystemNotification, systemPermission, type SystemPermission } from "@/lib/alert-signals";
import { api, type Notification } from "@/lib/api";
import { translateNow, useT, type TKey } from "@/lib/i18n";
import { alertStyle, alertTitle } from "@/lib/notification-style";
import { disablePush, enablePush, onPushChange, pushState, setAppBadge, syncPush, type PushState } from "@/lib/push";
import { cn } from "@/lib/utils";

// How often to ask for new alerts while the tab is open; also checked whenever the tab regains focus.
const POLL_MS = 20_000;

// Re-registers this device's push subscription once per page load (both mounted bells share it).
let pushSynced = false;

type T = ReturnType<typeof useT>;

function timeAgo(iso: string, t: T): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t("app.notifications.ago.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("app.notifications.ago.minutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("app.notifications.ago.hours", { n: hours });
  return t("app.notifications.ago.days", { n: Math.floor(hours / 24) });
}

// What someone did about an alert's subject; codes without a label show as is.
const RESOLUTIONS = ["approved", "rejected", "cancelled"];

function resolutionLabel(resolution: string, t: T): string {
  return RESOLUTIONS.includes(resolution) ? t(`common.status.${resolution}` as TKey) : resolution;
}

function AlertIcon({ type }: { type: string }) {
  const { icon: Icon, tone } = alertStyle(type);
  return (
    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm", tone)}>
      <Icon className="size-4" />
    </span>
  );
}

/** A birthday alert drawn as a small greeting card. */
function BirthdayAlertCard({ notification }: { notification: Notification }) {
  const isSelf = notification.data.is_self === true;
  const t = useT();
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-linear-to-br from-rose-500 via-pink-500 to-amber-400 p-3.5 text-white shadow-md shadow-rose-500/20",
        notification.read_at && "opacity-85",
      )}
    >
      {/* Confetti-like scatter of dots and crosses. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <pattern id={`bday-${notification.id}`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <circle cx="4" cy="4" r="1.6" fill="white" fillOpacity="0.28" />
            <path d="M18 14v6M15 17h6" stroke="white" strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#bday-${notification.id})`} />
      </svg>
      <Gift aria-hidden className="absolute -right-3 -bottom-3 size-20 rotate-12 text-white/15" />

      <div className="relative flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
          <Cake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
            {t("app.notifications.birthday")}
            <span className="size-0.5 rounded-full bg-white/70" />
            {timeAgo(notification.created_at, t)}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{alertTitle(notification.data.title)}</p>
          {notification.data.body && <p className="mt-0.5 text-xs text-white/85">{notification.data.body}</p>}
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm">
            <PartyPopper className="size-3.5" />
            {t(isSelf ? "app.notifications.openYourCard" : "app.notifications.openCard")}
          </span>
        </div>
        {!notification.read_at && <span className="mt-1 size-2 shrink-0 rounded-full bg-white" />}
      </div>
    </div>
  );
}

/**
 * The header bell: unread count, a toast when something new arrives, and the
 * latest alerts. Opening the list doesn't mark everything read — an alert is
 * read when it's clicked (which opens what it's about), or with "Mark all read".
 */
export function NotificationBell() {
  const router = useRouter();
  const t = useT();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // Only shown inside the open menu, so reading the browser here can't cause a hydration mismatch.
  const [permission, setPermission] = useState<SystemPermission>(systemPermission);
  // Push to this device (works with the app closed). null until checked.
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const pushOn = push === "on";
  // The newest unread id already seen, so only genuinely new alerts toast. null = first check.
  const latestSeen = useRef<number | null>(null);

  const openNotification = useCallback(
    (notification: Notification) => {
      if (!notification.read_at) {
        api.notifications.markAsRead(notification.id).catch(() => {});
        setNotifications((all) => all.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
        setUnread((count) => Math.max(0, count - 1));
      }
      setOpen(false);
      if (notification.link) router.push(notification.link);
    },
    [router],
  );

  const loadList = useCallback(() => api.notifications.list().then((list) => (setNotifications(list), list)), []);

  const check = useCallback(async () => {
    try {
      const { count, latest_id } = await api.notifications.unreadCount();
      setUnread(count);
      setAppBadge(count);

      const previous = latestSeen.current;
      const firstCheck = previous === null;
      const isNew = !firstCheck && latest_id !== null && latest_id > previous;
      latestSeen.current = Math.max(previous ?? 0, latest_id ?? 0);

      if (firstCheck || isNew) {
        const list = await loadList();
        if (isNew) {
          // A toast per new alert (at most three). The id keeps a second mounted bell from repeating it.
          const fresh = list.filter((n) => !n.read_at && !n.resolved_at && n.id > previous).slice(0, 3);
          fresh.forEach((n) => {
            toast(alertTitle(n.data.title), {
              id: `notification-${n.id}`,
              description: n.data.body,
              action: n.link ? { label: translateNow("app.notifications.open"), onClick: () => openNotification(n) } : undefined,
            });
            // With push on, the service worker already shows it on this device.
            if (!pushOn) showSystemNotification(alertTitle(n.data.title), { body: n.data.body, tag: `notification-${n.id}`, onClick: () => openNotification(n) });
          });
        }
      }
    } catch {
      // Offline or signed out — the next check tries again.
    }
  }, [loadList, openNotification, pushOn]);

  useEffect(() => {
    pushState().then(setPush).catch(() => setPush("unsupported"));
    if (!pushSynced) {
      pushSynced = true;
      syncPush();
    }
    // Turned on from the prompt (or the other mounted bell).
    return onPushChange(setPush);
  }, []);

  async function togglePush() {
    setPushBusy(true);
    try {
      setPush(pushOn ? await disablePush() : await enablePush());
    } catch (error) {
      console.error("Turning push on/off failed:", error);
      setPush(await pushState().catch(() => "unsupported" as const));
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    const first = setTimeout(check, 0);
    // Keeps checking in a background tab too — that's when the system notification matters
    // (browsers slow hidden-tab timers to about once a minute).
    const interval = setInterval(check, POLL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadList().catch(() => {});
  }

  async function markAllRead() {
    await api.notifications.markAllAsRead().catch(() => {});
    setNotifications((all) => all.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    setAppBadge(0);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" className="relative size-9" aria-label={unread ? t("app.notifications.bellUnread", { n: unread }) : t("app.notifications.title")} />}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <Badge className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </DropdownMenuTrigger>
      {/* Thick glass (glass-surface with --glass-thick, globals.css): the header's glass look, but
          mostly opaque so the text stays readable over whatever is behind. `!` wins over the
          menu's own solid background and ring; 20px corners around 6px padding → 14px items. */}
      <DropdownMenuContent
        align="end"
        className="glass-surface! [--glass-bg:var(--glass-thick)] max-h-[70vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[20px] p-1.5 text-ink [&_.text-muted-foreground]:text-ink-muted! [&_[data-highlighted]]:bg-ink/8! [&_[role=menuitem]]:rounded-[14px]"
      >
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2 pr-1">
            <DropdownMenuLabel>{t("app.notifications.title")}</DropdownMenuLabel>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                <CheckCheck className="size-3.5" />
                {t("app.notifications.markAllRead")}
              </Button>
            )}
          </div>
          <DropdownMenuSeparator />
          {notifications.length === 0 && <p className="p-3 text-sm text-muted-foreground">{t("app.notifications.empty")}</p>}
          {notifications.map((notification) =>
            notification.type === "birthday" ? (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => openNotification(notification)}
                className="my-1 p-0 whitespace-normal focus:bg-transparent"
              >
                <BirthdayAlertCard notification={notification} />
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => openNotification(notification)}
                className={cn("flex items-start gap-3 whitespace-normal py-2.5", notification.read_at && "opacity-75")}
              >
                <AlertIcon type={notification.type} />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cn("text-sm", notification.read_at ? "font-normal" : "font-medium")}>{alertTitle(notification.data.title)}</span>
                    {!notification.read_at && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {notification.data.body && <span className="text-xs text-muted-foreground">{notification.data.body}</span>}
                  {notification.resolved_at && (
                    <Badge variant={notification.resolution === "rejected" ? "destructive" : "success"} className="capitalize">
                      {notification.resolved_by
                        ? t("app.notifications.resolvedBy", { status: resolutionLabel(notification.resolution ?? "", t), name: notification.resolved_by })
                        : resolutionLabel(notification.resolution ?? "", t)}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{timeAgo(notification.created_at, t)}</span>
                </div>
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 p-1">
          {(push === "off" || push === "on") && (
            <Button variant="ghost" size="sm" className="justify-start text-xs" disabled={pushBusy} onClick={togglePush}>
              {pushOn ? <BellOff className="size-3.5" /> : <BellRing className="size-3.5" />}
              {t(pushBusy ? "app.notifications.device.wait" : pushOn ? "app.notifications.device.turnOff" : "app.notifications.device.turnOn")}
            </Button>
          )}
          {push === "needs-install" && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {t("app.notifications.device.iphone")}
            </p>
          )}
          {push === "blocked" && (
            <p className="px-2 py-1 text-xs text-muted-foreground">{t("app.notifications.device.blocked")}</p>
          )}
          {/* No push here (old browser, or not set up on the server): pop-ups while the app is open still work. */}
          {(push === "unsupported" || push === "unavailable") && permission === "default" && (
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={async () => setPermission(await requestSystemPermission())}>
              <BellRing className="size-3.5" />
              {t("app.notifications.device.popups")}
            </Button>
          )}
          {(push === "unsupported" || push === "unavailable") && permission === "denied" && (
            <p className="px-2 py-1 text-xs text-muted-foreground">{t("app.notifications.device.popupsBlocked")}</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
