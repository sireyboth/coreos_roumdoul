// Notification bell (components/dashboard/notification-bell.tsx). Alert titles and
// bodies come from the server and are not translated here.

export const notifications = {
  // ── Bell & list ───────────────────────────────────────────────────
  title: "Notifications",
  bellUnread: "Notifications, {n} unread",
  markAllRead: "Mark all read",
  empty: "No notifications yet.",
  open: "Open",
  resolvedBy: "{status} by {name}",

  // ── Birthday card ─────────────────────────────────────────────────
  birthday: "Birthday",
  openYourCard: "Open your card",
  openCard: "Open the card",

  // ── How long ago ──────────────────────────────────────────────────
  ago: {
    justNow: "just now",
    minutes: "{n}m ago",
    hours: "{n}h ago",
    days: "{n}d ago",
  },

  // ── Notifications on this device ──────────────────────────────────
  device: {
    wait: "Just a moment…",
    turnOff: "Notifications on for this device — turn off",
    turnOn: "Turn on notifications on this device",
    iphone: "To get notifications on iPhone: tap Share → Add to Home Screen, then open the app from your Home Screen.",
    blocked: "Notifications are blocked for this site in your browser settings.",
    popups: "Show pop-ups when this tab isn't open",
    popupsBlocked: "Pop-ups are blocked for this site in your browser settings.",
  },
};
