"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, CheckCheck } from "lucide-react";
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
import { disablePush, enablePush, pushState, setAppBadge, syncPush, type PushState } from "@/lib/push";
import { cn } from "@/lib/utils";

// How often to ask for new alerts while the tab is open; also checked whenever the tab regains focus.
const POLL_MS = 20_000;

// Re-registers this device's push subscription once per page load (both mounted bells share it).
let pushSynced = false;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The header bell: unread count, a toast when something new arrives, and the
 * latest alerts. Opening the list doesn't mark everything read — an alert is
 * read when it's clicked (which opens what it's about), or with "Mark all read".
 */
export function NotificationBell() {
  const router = useRouter();
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
            toast(n.data.title, {
              id: `notification-${n.id}`,
              description: n.data.body,
              action: n.link ? { label: "Open", onClick: () => openNotification(n) } : undefined,
            });
            // With push on, the service worker already shows it on this device.
            if (!pushOn) showSystemNotification(n.data.title, { body: n.data.body, tag: `notification-${n.id}`, onClick: () => openNotification(n) });
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
  }, []);

  async function togglePush() {
    setPushBusy(true);
    try {
      setPush(pushOn ? await disablePush() : await enablePush());
    } catch {
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
        render={<Button variant="outline" size="icon" className="relative size-9" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <Badge className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2 pr-1">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>
          <DropdownMenuSeparator />
          {notifications.length === 0 && <p className="p-3 text-sm text-muted-foreground">No notifications yet.</p>}
          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onClick={() => openNotification(notification)}
              className={cn("flex flex-col items-start gap-1 whitespace-normal", notification.read_at && "opacity-75")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className={cn("text-sm", notification.read_at ? "font-normal" : "font-medium")}>{notification.data.title}</span>
                {!notification.read_at && <span className="size-2 shrink-0 rounded-full bg-primary" />}
              </div>
              {notification.data.body && <span className="text-xs text-muted-foreground">{notification.data.body}</span>}
              {notification.resolved_at && (
                <Badge variant={notification.resolution === "rejected" ? "destructive" : "success"} className="capitalize">
                  {notification.resolution}
                  {notification.resolved_by ? ` by ${notification.resolved_by}` : ""}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo(notification.created_at)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-1 p-1">
          {(push === "off" || push === "on") && (
            <Button variant="ghost" size="sm" className="justify-start text-xs" disabled={pushBusy} onClick={togglePush}>
              {pushOn ? <BellOff className="size-3.5" /> : <BellRing className="size-3.5" />}
              {pushBusy ? "Just a moment…" : pushOn ? "Notifications on for this device — turn off" : "Turn on notifications on this device"}
            </Button>
          )}
          {push === "needs-install" && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              To get notifications on iPhone: tap Share → Add to Home Screen, then open the app from your Home Screen.
            </p>
          )}
          {push === "blocked" && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Notifications are blocked for this site in your browser settings.</p>
          )}
          {/* No push here (old browser, or not set up on the server): pop-ups while the app is open still work. */}
          {(push === "unsupported" || push === "unavailable") && permission === "default" && (
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={async () => setPermission(await requestSystemPermission())}>
              <BellRing className="size-3.5" />
              Show pop-ups when this tab isn&apos;t open
            </Button>
          )}
          {(push === "unsupported" || push === "unavailable") && permission === "denied" && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Pop-ups are blocked for this site in your browser settings.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
